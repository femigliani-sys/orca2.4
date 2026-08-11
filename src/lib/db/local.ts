/**
 * Implementação LOCAL (modo demonstração).
 * Persiste no localStorage do navegador (com fallback em memória).
 * Espelha fielmente o schema do Supabase para que a troca de backend
 * seja transparente para a aplicação.
 */
import type {
  Company,
  Customer,
  FollowUp,
  GeneratedMessage,
  Notification,
  PlanId,
  Quote,
  QuoteInput,
  QuoteStatus,
  Service,
  Subscription,
  User,
} from '../types';
import { demoHash } from '../auth';
import { DEFAULT_SETTINGS } from '../defaults';
import { notify } from '../store';
import { addDaysIso, generateId, isValidIsoDate, nowIso } from '../utils';
import { FREE_MONTHLY_QUOTES } from '../constants';
import { buildQuote, computeTotals, suggestedFollowUpDate } from '../quote-utils';
import { sideEffectsFor, monthStart } from '../side-effects';
import type { DB } from './types';

// ---------------------------------------------------------------- Storage
const memoryStore = new Map<string, string>();

function readLS(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function writeLS(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryStore.set(key, value);
  }
}

function removeLS(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    memoryStore.delete(key);
  }
}

function readJSON<T>(key: string, fallback: T): T {
  const raw = readLS(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  writeLS(key, JSON.stringify(value));
}

// ---------------------------------------------------------------- Chaves
const K_USERS = 'orcaai_users_v1';
const K_SESSION = 'orcaai_session_v1';

function userDataKey(userId: string): string {
  return `orcaai_data_${userId}`;
}

interface UserData {
  company: Company;
  onboarded: boolean;
  services: Service[];
  customers: Customer[];
  quotes: Quote[];
  followUps: FollowUp[];
  notifications: Notification[];
  messages: GeneratedMessage[];
  subscription: Subscription | null;
  pendingCheckout?: { id: string; plan: PlanId } | null;
}

function emptyUserData(company: Company): UserData {
  return {
    company,
    onboarded: false,
    services: [],
    customers: [],
    quotes: [],
    followUps: [],
    notifications: [],
    messages: [],
    subscription: null,
  };
}

interface StoredUser extends User {
  passwordHash: string;
}

// ---------------------------------------------------------------- Helpers
function getSessionUserId(): string | null {
  const session = readJSON<{ userId: string } | null>(K_SESSION, null);
  return session?.userId ?? null;
}

function getData(userId?: string): UserData | null {
  const id = userId ?? getSessionUserId();
  if (!id) return null;
  const data = readJSON<UserData | null>(userDataKey(id), null);
  if (!data?.company) return null;
  return normalizeData(data);
}

/**
 * Corrige dados antigos/parciais salvos no localStorage (versões anteriores
 * do app) para que nunca quebrem a interface com campos indefinidos.
 * Normaliza TODAS as coleções — não só a empresa.
 */
function normalizeData(data: UserData): UserData {
  const company = data.company;
  return {
    ...data,
    onboarded: Boolean(data.onboarded),
    company: {
      ...company,
      name: company.name ?? '',
      businessType: company.businessType ?? 'Profissional autônomo',
      plan: (company.plan as Company['plan']) || 'free',
      quoteCounter: Number(company.quoteCounter) || 0,
      settings: { ...DEFAULT_SETTINGS, ...(company.settings ?? {}) },
    },
    services: Array.isArray(data.services) ? data.services : [],
    customers: Array.isArray(data.customers) ? data.customers : [],
    followUps: Array.isArray(data.followUps) ? data.followUps : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    messages: Array.isArray(data.messages) ? data.messages : [],
    pendingCheckout: data.pendingCheckout ?? null,
    quotes: Array.isArray(data.quotes)
      ? data.quotes.map((q) => ({
          ...q,
          items: Array.isArray(q.items) ? q.items : [],
          number: Number(q.number) || 0,
          subtotal: Number(q.subtotal) || 0,
          discount: Number(q.discount) || 0,
          total: Number(q.total) || 0,
          validityDays: Number(q.validityDays) || 7,
          status: (q.status as Quote['status']) || 'rascunho',
          createdAt: q.createdAt ?? new Date().toISOString(),
          validUntil: q.validUntil ?? new Date().toISOString(),
        }))
      : [],
    subscription: data.subscription ?? null,
  };
}

function saveData(userId: string, data: UserData): void {
  writeJSON(userDataKey(userId), data);
}

function requireData(): { userId: string; data: UserData } {
  const userId = getSessionUserId();
  const data = getData(userId ?? undefined);
  if (!userId || !data) {
    throw new Error('Sessão expirada. Entre novamente.');
  }
  return { userId, data };
}

// ---------------------------------------------------------------- Notificações internas
async function pushNotification(
  userId: string,
  data: UserData,
  input: Omit<Notification, 'id' | 'companyId' | 'createdAt' | 'read'>,
): Promise<void> {
  data.notifications.unshift({
    id: generateId(),
    companyId: data.company.id,
    ...input,
    read: false,
    createdAt: nowIso(),
  });
  saveData(userId, data);
  notify();
}

// ---------------------------------------------------------------- DB local
export const localDB: DB = {
  // ============================================================ Auth
  async signUp({ name, companyName, email, password, businessType }) {
    const users = readJSON<StoredUser[]>(K_USERS, []);
    const normalizedEmail = email.trim().toLowerCase();
    if (users.some((u) => u.email === normalizedEmail)) {
      throw new Error('User already registered');
    }
    const id = generateId();
    const createdAt = nowIso();
    const user: StoredUser = {
      id,
      name: name.trim(),
      email: normalizedEmail,
      companyName: companyName.trim(),
      businessType,
      onboarded: false,
      createdAt,
      passwordHash: await demoHash(password),
    };
    users.push(user);
    writeJSON(K_USERS, users);

    const company: Company = {
      id: `co_${id}`,
      ownerId: id,
      name: companyName.trim(),
      businessType,
      settings: { ...DEFAULT_SETTINGS },
      plan: 'free',
      quoteCounter: 0,
      createdAt,
    };
    saveData(id, emptyUserData(company));
    writeJSON(K_SESSION, { userId: id });
    notify();
  },

  async signIn(email, password) {
    const users = readJSON<StoredUser[]>(K_USERS, []);
    const user = users.find((u) => u.email === email.trim().toLowerCase());
    if (!user) throw new Error('Invalid login credentials');
    const hash = await demoHash(password);
    if (hash !== user.passwordHash) throw new Error('Invalid login credentials');
    writeJSON(K_SESSION, { userId: user.id });
    notify();
  },

  async signOut() {
    removeLS(K_SESSION);
    notify();
  },

  async resetPassword(email) {
    const users = readJSON<StoredUser[]>(K_USERS, []);
    const user = users.find((u) => u.email === email.trim().toLowerCase());
    // Não informamos se o e-mail existe (segurança)
    void user;
  },

  async getSession() {
    return { userId: getSessionUserId() };
  },

  async getCurrentUser() {
    const id = getSessionUserId();
    if (!id) return null;
    const users = readJSON<StoredUser[]>(K_USERS, []);
    const stored = users.find((u) => u.id === id);
    if (!stored) return null;
    const data = getData(id);
    if (!data) return null;
    const user: User = {
      id: stored.id,
      name: stored.name,
      email: stored.email,
      companyName: data.company.name,
      businessType: data.company.businessType,
      onboarded: data.onboarded,
      createdAt: stored.createdAt,
    };
    return user;
  },

  onSessionChange(cb) {
    window.addEventListener('orcaai:session', cb);
    return () => window.removeEventListener('orcaai:session', cb);
  },

  // ============================================================ Empresa
  async getCompany() {
    const data = getData();
    return data?.company ?? null;
  },

  async updateCompany(patch) {
    const { userId, data } = requireData();
    data.company = { ...data.company, ...patch };
    saveData(userId, data);
    notify();
    return data.company;
  },

  async completeOnboarding(patch) {
    const { userId, data } = requireData();
    data.company = { ...data.company, ...patch };
    data.onboarded = true;
    saveData(userId, data);
    notify();
  },

  async uploadLogo(file) {
    return new Promise<string>((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Envie uma imagem válida.'));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error('Imagem muito grande (máx. 2MB).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.readAsDataURL(file);
    });
  },

  // ============================================================ Serviços
  async listServices() {
    return getData()?.services ?? [];
  },

  async createService(input) {
    const { userId, data } = requireData();
    const service: Service = {
      ...input,
      id: generateId(),
      companyId: data.company.id,
      createdAt: nowIso(),
      active: input.active ?? true,
    };
    data.services.unshift(service);
    saveData(userId, data);
    notify();
    return service;
  },

  async updateService(id, patch) {
    const { userId, data } = requireData();
    data.services = data.services.map((s) => (s.id === id ? { ...s, ...patch } : s));
    saveData(userId, data);
    notify();
    const updated = data.services.find((s) => s.id === id);
    if (!updated) throw new Error('Serviço não encontrado.');
    return updated;
  },

  async deleteService(id) {
    const { userId, data } = requireData();
    data.services = data.services.filter((s) => s.id !== id);
    saveData(userId, data);
    notify();
  },

  async duplicateService(id) {
    const { userId, data } = requireData();
    const original = data.services.find((s) => s.id === id);
    if (!original) throw new Error('Serviço não encontrado.');
    const copy: Service = {
      ...original,
      id: generateId(),
      name: `${original.name} (cópia)`,
      createdAt: nowIso(),
    };
    data.services.unshift(copy);
    saveData(userId, data);
    notify();
    return copy;
  },

  async toggleService(id, active) {
    const { userId, data } = requireData();
    data.services = data.services.map((s) => (s.id === id ? { ...s, active } : s));
    saveData(userId, data);
    notify();
    const updated = data.services.find((s) => s.id === id);
    if (!updated) throw new Error('Serviço não encontrado.');
    return updated;
  },

  // ============================================================ Clientes
  async listCustomers() {
    return getData()?.customers ?? [];
  },

  async getCustomer(id) {
    return getData()?.customers.find((c) => c.id === id) ?? null;
  },

  async createCustomer(input) {
    const { userId, data } = requireData();
    const customer: Customer = {
      id: generateId(),
      companyId: data.company.id,
      name: input.name?.trim() || 'Cliente sem nome',
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      createdAt: nowIso(),
      lastContactAt: input.lastContactAt ?? null,
    };
    data.customers.unshift(customer);
    saveData(userId, data);
    notify();
    return customer;
  },

  async updateCustomer(id, patch) {
    const { userId, data } = requireData();
    data.customers = data.customers.map((c) => (c.id === id ? { ...c, ...patch } : c));
    saveData(userId, data);
    notify();
    const updated = data.customers.find((c) => c.id === id);
    if (!updated) throw new Error('Cliente não encontrado.');
    return updated;
  },

  async deleteCustomer(id) {
    const { userId, data } = requireData();
    data.customers = data.customers.filter((c) => c.id !== id);
    saveData(userId, data);
    notify();
  },

  // ============================================================ Orçamentos
  async listQuotes() {
    return [...(getData()?.quotes ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getQuote(id) {
    return getData()?.quotes.find((q) => q.id === id) ?? null;
  },

  async createQuote(input) {
    const { userId, data } = requireData();
    const company = data.company;
    const number = company.quoteCounter + 1;
    const quote = buildQuote(input, company, number);

    company.quoteCounter = number;
    data.quotes.unshift(quote);

    // Atualiza o cliente (último contato) se já existir
    if (quote.customerId) {
      data.customers = data.customers.map((c) =>
        c.id === quote.customerId ? { ...c, lastContactAt: nowIso(), phone: quote.customerPhone || c.phone } : c,
      );
    }

    await applyQuoteSideEffects(userId, data, quote);

    saveData(userId, data);
    notify();
    return quote;
  },

  async updateQuoteStatus(id, status) {
    const { userId, data } = requireData();
    const quote = data.quotes.find((q) => q.id === id);
    if (!quote) throw new Error('Orçamento não encontrado.');
    quote.status = status;
    quote.updatedAt = nowIso();
    if (status === 'aprovado') quote.approvedAt = nowIso();
    if (status === 'visualizado' && !quote.viewedAt) quote.viewedAt = nowIso();
    await applyQuoteSideEffects(userId, data, quote);
    saveData(userId, data);
    notify();
    return quote;
  },

  async updateQuote(id, patch) {
    const { userId, data } = requireData();
    const idx = data.quotes.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Orçamento não encontrado.');
    const merged = { ...data.quotes[idx], ...patch, updatedAt: nowIso() };
    if (merged.items) {
      const totals = computeTotals(merged.items, merged.discount ?? 0);
      merged.subtotal = totals.subtotal;
      merged.total = totals.total;
    }
    data.quotes[idx] = merged;
    await applyQuoteSideEffects(userId, data, merged);
    saveData(userId, data);
    notify();
    return merged;
  },

  async markViewed(id) {
    const { userId, data } = requireData();
    const quote = data.quotes.find((q) => q.id === id);
    if (!quote) return;
    if (!quote.viewedAt) {
      quote.viewedAt = nowIso();
      if (quote.status === 'enviado') quote.status = 'visualizado';
      quote.updatedAt = nowIso();
      saveData(userId, data);
      notify();
    }
  },

  async deleteQuote(id) {
    const { userId, data } = requireData();
    data.quotes = data.quotes.filter((q) => q.id !== id);
    data.followUps = data.followUps.filter((f) => f.quoteId !== id);
    data.messages = data.messages.filter((m) => m.quoteId !== id);
    saveData(userId, data);
    notify();
  },

  // ============================================================ Follow-ups
  async listFollowUps() {
    return [...(getData()?.followUps ?? [])].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  },

  async createFollowUp({ quoteId, scheduledFor, notes }) {
    const { userId, data } = requireData();
    const quote = data.quotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Orçamento não encontrado.');
    const followUp: FollowUp = {
      id: generateId(),
      companyId: data.company.id,
      quoteId,
      quoteNumber: quote.number,
      customerName: quote.customerName,
      value: quote.total,
      scheduledFor: isValidIsoDate(scheduledFor) ? scheduledFor : suggestedFollowUpDate(),
      notes,
      status: 'pendente',
      createdAt: nowIso(),
      completedAt: null,
    };
    data.followUps.unshift(followUp);
    saveData(userId, data);
    notify();
    return followUp;
  },

  async completeFollowUp(id) {
    const { userId, data } = requireData();
    data.followUps = data.followUps.map((f) =>
      f.id === id ? { ...f, status: 'concluido', completedAt: nowIso() } : f,
    );
    saveData(userId, data);
    notify();
  },

  async deleteFollowUp(id) {
    const { userId, data } = requireData();
    data.followUps = data.followUps.filter((f) => f.id !== id);
    saveData(userId, data);
    notify();
  },

  // ============================================================ Notificações
  async listNotifications() {
    return getData()?.notifications ?? [];
  },

  async markAllNotificationsRead() {
    const { userId, data } = requireData();
    data.notifications = data.notifications.map((n) => ({ ...n, read: true }));
    saveData(userId, data);
    notify();
  },

  async markNotificationRead(id) {
    const { userId, data } = requireData();
    data.notifications = data.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveData(userId, data);
    notify();
  },

  async addNotification(input) {
    const { userId, data } = requireData();
    await pushNotification(userId, data, input);
  },

  // ============================================================ Mensagens
  async listMessages(quoteId) {
    return (getData()?.messages ?? []).filter((m) => m.quoteId === quoteId);
  },

  async createMessage({ quoteId, body, channel }) {
    const { userId, data } = requireData();
    const message: GeneratedMessage = {
      id: generateId(),
      companyId: data.company.id,
      quoteId,
      body,
      channel,
      createdAt: nowIso(),
    };
    data.messages.unshift(message);
    saveData(userId, data);
    notify();
    return message;
  },

  // ============================================================ Assinatura
  async getSubscription() {
    return getData()?.subscription ?? null;
  },

  async setPlan(plan) {
    const { userId, data } = requireData();
    data.subscription = {
      id: data.subscription?.id ?? generateId(),
      companyId: data.company.id,
      plan,
      status: 'ativo',
      startedAt: data.subscription?.startedAt ?? nowIso(),
      renewsAt: addDaysIso(30),
      provider: data.subscription?.provider ?? 'manual',
    };
    data.company = { ...data.company, plan };
    data.pendingCheckout = null;
    saveData(userId, data);
    notify();
  },

  async startCheckout({ plan }) {
    const { userId, data } = requireData();
    const checkoutId = generateId();
    data.pendingCheckout = { id: checkoutId, plan };
    data.subscription = {
      id: data.subscription?.id ?? generateId(),
      companyId: data.company.id,
      plan,
      status: 'pendente',
      startedAt: data.subscription?.startedAt ?? nowIso(),
      renewsAt: null,
      provider: 'simulado',
      providerId: checkoutId,
    };
    saveData(userId, data);
    notify();
    return { simulated: true, checkoutId };
  },

  async completeCheckout({ checkoutId }) {
    const { userId, data } = requireData();
    if (data.pendingCheckout?.id !== checkoutId) {
      throw new Error('Checkout não encontrado.');
    }
    const plan = data.pendingCheckout.plan;
    data.subscription = {
      id: data.subscription?.id ?? generateId(),
      companyId: data.company.id,
      plan,
      status: 'ativo',
      startedAt: nowIso(),
      renewsAt: addDaysIso(30),
      provider: 'simulado',
      providerId: checkoutId,
    };
    data.company = { ...data.company, plan };
    data.pendingCheckout = null;
    data.notifications.unshift({
      id: generateId(),
      companyId: data.company.id,
      type: 'plan',
      title: 'Pagamento aprovado 🎉',
      body: `Seu plano ${plan} foi ativado. Recursos liberados!`,
      link: '/app/planos',
      read: false,
      createdAt: nowIso(),
    });
    saveData(userId, data);
    notify();
  },
};

// ---------------------------------------------------------------- Side effects
/**
 * Efeitos automáticos ao criar/atualizar orçamentos:
 * - follow-up automático quando enviado
 * - notificações de status
 * - aviso de limite do plano gratuito
 */
async function applyQuoteSideEffects(userId: string, data: UserData, quote: Quote): Promise<void> {
  const company = data.company;
  const monthStartDate = monthStart();

  const quotesThisMonth = data.quotes.filter(
    (q) => new Date(q.createdAt).getTime() >= monthStartDate.getTime() && q.status !== 'rascunho',
  ).length;

  const effects = sideEffectsFor({
    quote,
    company,
    hasPendingFollowUp: data.followUps.some((f) => f.quoteId === quote.id && f.status === 'pendente'),
    hasFollowUpNotification: data.notifications.some(
      (n) => n.type === 'followup' && n.link === `/app/orcamentos/${quote.id}`,
    ),
    hasPlanNotification: data.notifications.some((n) => n.type === 'plan'),
    quotesThisMonth,
  });

  if (effects.followUp) {
    data.followUps.unshift({
      id: generateId(),
      companyId: company.id,
      quoteId: quote.id,
      quoteNumber: quote.number,
      customerName: quote.customerName,
      value: quote.total,
      scheduledFor: effects.followUp.scheduledFor,
      notes: effects.followUp.notes,
      status: 'pendente',
      createdAt: nowIso(),
      completedAt: null,
    });
  }

  for (const n of effects.notifications) {
    data.notifications.unshift({
      id: generateId(),
      companyId: company.id,
      ...n,
      read: false,
      createdAt: nowIso(),
    });
  }
}

/** Marca a visualização de um orçamento (usado por link público no futuro). */
export function localTouchQuote(quoteId: string): void {
  const userId = getSessionUserId();
  if (!userId) return;
  const data = getData(userId);
  if (!data) return;
  const quote = data.quotes.find((q) => q.id === quoteId);
  if (!quote || quote.viewedAt) return;
  quote.viewedAt = nowIso();
  if (quote.status === 'enviado') quote.status = 'visualizado';
  quote.updatedAt = nowIso();
  saveData(userId, data);
  notify();
}
