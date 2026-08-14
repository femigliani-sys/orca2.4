/**
 * Implementação SUPABASE (produção).
 * Todas as queries usam RLS: cada usuário só acessa dados da própria empresa.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Company,
  Customer,
  FollowUp,
  GeneratedMessage,
  Notification,
  Payment,
  PlanId,
  Quote,
  QuoteInput,
  QuoteStatus,
  Service,
  Subscription,
  User,
} from '../types';
import { DEFAULT_SETTINGS } from '../defaults';
import { buildQuote, computeTotals, suggestedFollowUpDate } from '../quote-utils';
import { monthStart, sideEffectsFor } from '../side-effects';
import type { DB } from './types';
import type {
  CompaniesRow,
  CustomersRow,
  FollowUpsRow,
  MessagesRow,
  NotificationsRow,
  PaymentsRow,
  QuoteItemsRow,
  QuotesRow,
  ServicesRow,
  SubscriptionsRow,
} from '../supabase';

const REQUIRED_ERROR = 'Sessão expirada. Entre novamente.';

export function createSupabaseDB(client: SupabaseClient): DB {
  // ------------------------------------------------------------ Helpers

  /**
   * Busca a empresa do usuário logado.
   * AUTO-CURA + ANTI-CORRIDA:
   * - Se o usuário não tiver empresa, cria uma (usando os metadados do cadastro).
   * - NUNCA usa maybeSingle: busca como lista para detectar/limpar duplicatas
   *   (evita o loop de "volta para o onboarding" quando há 2+ linhas).
   * - Se houver duplicatas (ex.: criadas por requisições paralelas), mantém a
   *   mais antiga e apaga o resto.
   */
  async function ensureCompany(userId: string): Promise<CompaniesRow> {
    const { data: rows, error: selError } = await client
      .from('companies')
      .select('*')
      .eq('owner_id', userId);

    if (selError) {
      throw new Error(`Falha ao consultar a empresa: ${selError.message}`);
    }

    if (rows && rows.length > 0) {
      if (rows.length > 1) {
        // Corrige duplicatas: mantém a mais antiga e remove as demais
        const sorted = [...(rows as CompaniesRow[])].sort((a, b) =>
          (a.created_at ?? '').localeCompare(b.created_at ?? ''),
        );
        const keep = sorted[0];
        await client.from('companies').delete().eq('owner_id', userId).neq('id', keep.id);
        return keep;
      }
      return rows[0] as CompaniesRow;
    }

    // Não existe → cria
    const {
      data: { user },
    } = await client.auth.getUser();
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const name = (meta.company_name as string) || 'Minha empresa';
    const businessType = (meta.business_type as string) || 'Profissional autônomo';

    const { data: inserted, error: insertError } = await client
      .from('companies')
      .insert({
        owner_id: userId,
        name,
        business_type: businessType,
        settings: { ...DEFAULT_SETTINGS },
        plan: 'free',
        quote_counter: 0,
        onboarded: false,
      })
      .select();

    if (!insertError && inserted && inserted.length > 0) {
      return inserted[0] as CompaniesRow;
    }

    // Se falhou (ex.: corrida com outra requisição que já criou), tenta ler de novo
    const { data: retry } = await client
      .from('companies')
      .select('*')
      .eq('owner_id', userId);
    if (retry && retry.length > 0) {
      return retry[0] as CompaniesRow;
    }

    if (insertError) {
      throw new Error(`Não foi possível criar a empresa: ${insertError.message}`);
    }
    throw new Error('Empresa não encontrada e não foi possível criá-la.');
  }

  async function requireCompany(): Promise<{ userId: string; company: CompaniesRow }> {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) throw new Error(REQUIRED_ERROR);
    const company = await ensureCompany(user.id);
    return { userId: user.id, company };
  }

  function mapCompany(row: CompaniesRow): Company {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      businessType: row.business_type,
      phone: row.phone ?? undefined,
      whatsapp: row.whatsapp ?? undefined,
      email: row.email ?? undefined,
      address: row.address ?? undefined,
      cnpj: row.cnpj ?? undefined,
      logoUrl: row.logo_url ?? undefined,
      settings: { ...DEFAULT_SETTINGS, ...(row.settings ?? {}) },
      plan: row.plan as PlanId,
      quoteCounter: row.quote_counter,
      createdAt: row.created_at,
    };
  }

  function mapService(row: ServicesRow): Service {
    return {
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      description: row.description,
      price: row.price,
      unit: row.unit,
      category: row.category,
      durationMinutes: row.duration_minutes,
      observations: row.observations ?? undefined,
      active: row.active,
      createdAt: row.created_at,
    };
  }

  function mapCustomer(row: CustomersRow): Customer {
    return {
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      lastContactAt: row.last_contact_at,
    };
  }

  function mapQuote(row: QuotesRow, items: QuoteItemLike[]): Quote {
    return {
      id: row.id,
      companyId: row.company_id,
      number: row.number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone ?? undefined,
      customerEmail: row.customer_email ?? undefined,
      status: row.status as QuoteStatus,
      items: items.map((it) => ({
        id: it.id,
        serviceId: it.service_id,
        name: it.name,
        description: it.description ?? undefined,
        quantity: it.quantity,
        unit: it.unit,
        price: it.price,
        observations: it.observations ?? undefined,
      })),
      subtotal: row.subtotal,
      discount: row.discount,
      total: row.total,
      validityDays: row.validity_days,
      validUntil: row.valid_until,
      notes: row.notes ?? undefined,
      terms: row.terms ?? undefined,
      sourceMessage: row.source_message ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      viewedAt: row.viewed_at,
      approvedAt: row.approved_at,
      shareToken: (row as QuotesRow & { share_token?: string }).share_token ?? undefined,
    };
  }

  type QuoteItemLike = QuoteItemsRow;

  function mapFollowUp(row: FollowUpsRow, quote: QuotesRow): FollowUp {
    return {
      id: row.id,
      companyId: row.company_id,
      quoteId: row.quote_id,
      quoteNumber: quote?.number ?? 0,
      customerName: quote?.customer_name ?? '',
      value: quote?.total ?? 0,
      scheduledFor: row.scheduled_for,
      notes: row.notes ?? undefined,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }

  function mapNotification(row: NotificationsRow): Notification {
    return {
      id: row.id,
      companyId: row.company_id,
      type: row.type as Notification['type'],
      title: row.title,
      body: row.body,
      link: row.link ?? undefined,
      read: row.read,
      createdAt: row.created_at,
    };
  }

  async function applySideEffects(company: CompaniesRow, quote: Quote): Promise<void> {
    const { data: followUps } = await client
      .from('follow_ups')
      .select('id')
      .eq('company_id', company.id)
      .eq('quote_id', quote.id)
      .eq('status', 'pendente');
    const { data: notifs } = await client
      .from('notifications')
      .select('id, type, link')
      .eq('company_id', company.id);

    const { data: quotesThisMonth } = await client
      .from('quotes')
      .select('created_at, status')
      .eq('company_id', company.id)
      .gte('created_at', monthStart().toISOString());

    const effects = sideEffectsFor({
      quote,
      company: mapCompany(company),
      hasPendingFollowUp: (followUps?.length ?? 0) > 0,
      hasFollowUpNotification: (notifs ?? []).some((n) => n.type === 'followup' && n.link === `/app/orcamentos/${quote.id}`),
      hasPlanNotification: (notifs ?? []).some((n) => n.type === 'plan'),
      quotesThisMonth: (quotesThisMonth ?? []).filter((q) => q.status !== 'rascunho').length,
    });

    if (effects.followUp) {
      await client.from('follow_ups').insert({
        company_id: company.id,
        quote_id: quote.id,
        scheduled_for: effects.followUp.scheduledFor,
        notes: effects.followUp.notes,
        status: 'pendente',
      });
    }
    for (const n of effects.notifications) {
      await client.from('notifications').insert({
        company_id: company.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link ?? null,
        read: false,
      });
    }
  }

  return {
    // ========================================================== Auth
    async signUp({ name, companyName, email, password, businessType }) {
      const { data, error } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim(), company_name: companyName.trim(), business_type: businessType },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Não foi possível criar a conta.');

      // Se a confirmação de e-mail estiver ATIVA, o Supabase não retorna sessão
      // aqui — e o RLS impede criar a empresa com auth.uid() nulo. Nesse caso,
      // a empresa é criada automaticamente no primeiro login (auto-cura).
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) return;

      const { error: cError } = await client.from('companies').insert({
        owner_id: data.user.id,
        name: companyName.trim(),
        business_type: businessType,
        settings: { ...DEFAULT_SETTINGS },
        plan: 'free',
        quote_counter: 0,
        onboarded: false,
      });
      if (cError) {
        // Se a criação falhar por qualquer motivo (ex.: RLS), não bloqueia o
        // cadastro — o auto-cura cria a empresa no primeiro uso.
        console.warn('[signUp] não foi possível criar a empresa agora:', cError.message);
      }
    },

    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },

    async signOut() {
      await client.auth.signOut();
    },

    async resetPassword(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/recuperar-senha`,
      });
      if (error) throw error;
    },

    async getSession() {
      const { data } = await client.auth.getSession();
      return { userId: data.session?.user.id ?? null };
    },

    async getCurrentUser() {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) return null;

      // Auto-cura: garante que a empresa exista (nunca retorna null sem motivo)
      let c: CompaniesRow | null = null;
      try {
        c = await ensureCompany(user.id);
      } catch (err) {
        console.warn('[getCurrentUser] empresa indisponível:', err instanceof Error ? err.message : err);
      }

      return {
        id: user.id,
        name: (user.user_metadata.name as string) ?? '',
        email: user.email ?? '',
        companyName: c?.name ?? '',
        businessType: c?.business_type ?? '',
        onboarded: c?.onboarded ?? false,
        createdAt: user.created_at,
      } satisfies User;
    },

    onSessionChange(cb) {
      const { data } = client.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },

    // ========================================================== Empresa
    async getCompany() {
      const { company } = await requireCompany();
      return mapCompany(company);
    },

    async updateCompany(patch) {
      const { company } = await requireCompany();
      const rowPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) rowPatch.name = patch.name;
      if (patch.businessType !== undefined) rowPatch.business_type = patch.businessType;
      if (patch.phone !== undefined) rowPatch.phone = patch.phone ?? null;
      if (patch.whatsapp !== undefined) rowPatch.whatsapp = patch.whatsapp ?? null;
      if (patch.email !== undefined) rowPatch.email = patch.email ?? null;
      if (patch.address !== undefined) rowPatch.address = patch.address ?? null;
      if (patch.cnpj !== undefined) rowPatch.cnpj = patch.cnpj ?? null;
      if (patch.logoUrl !== undefined) rowPatch.logo_url = patch.logoUrl ?? null;
      if (patch.plan !== undefined) rowPatch.plan = patch.plan;
      if (patch.settings !== undefined) rowPatch.settings = { ...company.settings, ...patch.settings };
      const { data, error } = await client
        .from('companies')
        .update(rowPatch)
        .eq('id', company.id)
        .select()
        .single();
      if (error) throw error;
      return mapCompany(data as CompaniesRow);
    },

    async completeOnboarding(patch) {
      // Atualização ÚNICA e atômica: nome + tipo + onboarded=true.
      // Antes eram 2 updates separados e o segundo podia falhar em silêncio,
      // deixando onboarded=false → o app "voltava" para o onboarding.
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('companies')
        .update({
          name: patch.name ?? company.name,
          business_type: patch.businessType ?? company.business_type,
          onboarded: true,
          settings: { ...company.settings, ...(patch.settings ?? {}) },
        })
        .eq('id', company.id)
        .select()
        .single();
      if (error) {
        throw new Error(`Não foi possível concluir o onboarding: ${error.message}`);
      }
      return undefined;
    },

    async uploadLogo(file) {
      const { company } = await requireCompany();
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `${company.id}/${Date.now()}-logo.${ext}`;
      const { error } = await client.storage.from('logos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = client.storage.from('logos').getPublicUrl(path);
      return data.publicUrl;
    },

    // ========================================================== Serviços
    async listServices() {
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('services')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ServicesRow[]).map(mapService);
    },

    async createService(input) {
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('services')
        .insert({
          company_id: company.id,
          name: input.name,
          description: input.description,
          price: input.price,
          unit: input.unit,
          category: input.category,
          duration_minutes: input.durationMinutes ?? null,
          observations: input.observations ?? null,
          active: input.active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return mapService(data as ServicesRow);
    },

    async updateService(id, patch) {
      const { company } = await requireCompany();
      const rowPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) rowPatch.name = patch.name;
      if (patch.description !== undefined) rowPatch.description = patch.description;
      if (patch.price !== undefined) rowPatch.price = patch.price;
      if (patch.unit !== undefined) rowPatch.unit = patch.unit;
      if (patch.category !== undefined) rowPatch.category = patch.category;
      if (patch.durationMinutes !== undefined) rowPatch.duration_minutes = patch.durationMinutes;
      if (patch.observations !== undefined) rowPatch.observations = patch.observations ?? null;
      if (patch.active !== undefined) rowPatch.active = patch.active;
      const { data, error } = await client
        .from('services')
        .update(rowPatch)
        .eq('id', id)
        .eq('company_id', company.id)
        .select()
        .single();
      if (error) throw error;
      return mapService(data as ServicesRow);
    },

    async deleteService(id) {
      const { company } = await requireCompany();
      const { error } = await client.from('services').delete().eq('id', id).eq('company_id', company.id);
      if (error) throw error;
    },

    async duplicateService(id) {
      const { company } = await requireCompany();
      const { data: original } = await client
        .from('services')
        .select('*')
        .eq('id', id)
        .eq('company_id', company.id)
        .single();
      if (!original) throw new Error('Serviço não encontrado.');
      const { data, error } = await client
        .from('services')
        .insert({
          company_id: company.id,
          name: `${original.name} (cópia)`,
          description: original.description,
          price: original.price,
          unit: original.unit,
          category: original.category,
          duration_minutes: original.duration_minutes,
          observations: original.observations,
          active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return mapService(data as ServicesRow);
    },

    async toggleService(id, active) {
      const { data, error } = await client
        .from('services')
        .update({ active })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapService(data as ServicesRow);
    },

    // ========================================================== Clientes
    async listCustomers() {
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('customers')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as CustomersRow[]).map(mapCustomer);
    },

    async getCustomer(id) {
      const { company } = await requireCompany();
      const { data } = await client
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('company_id', company.id)
        .single();
      return data ? mapCustomer(data as CustomersRow) : null;
    },

    async createCustomer(input) {
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('customers')
        .insert({
          company_id: company.id,
          name: input.name?.trim() || 'Cliente sem nome',
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,
          last_contact_at: input.lastContactAt ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapCustomer(data as CustomersRow);
    },

    async updateCustomer(id, patch) {
      const { company } = await requireCompany();
      const rowPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) rowPatch.name = patch.name;
      if (patch.phone !== undefined) rowPatch.phone = patch.phone ?? null;
      if (patch.email !== undefined) rowPatch.email = patch.email ?? null;
      if (patch.notes !== undefined) rowPatch.notes = patch.notes ?? null;
      if (patch.lastContactAt !== undefined) rowPatch.last_contact_at = patch.lastContactAt;
      const { data, error } = await client
        .from('customers')
        .update(rowPatch)
        .eq('id', id)
        .eq('company_id', company.id)
        .select()
        .single();
      if (error) throw error;
      return mapCustomer(data as CustomersRow);
    },

    async deleteCustomer(id) {
      const { company } = await requireCompany();
      const { error } = await client.from('customers').delete().eq('id', id).eq('company_id', company.id);
      if (error) throw error;
    },

    // ========================================================== Orçamentos
    async listQuotes() {
      const { company } = await requireCompany();
      const { data: rows, error } = await client
        .from('quotes')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const quotes = rows as QuotesRow[];
      if (quotes.length === 0) return [];
      const { data: itemRows } = await client
        .from('quote_items')
        .select('*')
        .in('quote_id', quotes.map((q) => q.id));
      const items = (itemRows as QuoteItemsRow[]) ?? [];
      return quotes.map((q) => mapQuote(q, items.filter((it) => it.quote_id === q.id)));
    },

    async getQuote(id) {
      const { company } = await requireCompany();
      const { data: row } = await client
        .from('quotes')
        .select('*')
        .eq('id', id)
        .eq('company_id', company.id)
        .single();
      if (!row) return null;
      const { data: itemRows } = await client
        .from('quote_items')
        .select('*')
        .eq('quote_id', id);
      return mapQuote(row as QuotesRow, (itemRows as QuoteItemsRow[]) ?? []);
    },

    async createQuote(input) {
      const { company } = await requireCompany();
      const appCompany = mapCompany(company);
      const number = company.quote_counter + 1;
      const quote = buildQuote(input, appCompany, number);

      const { data: row, error } = await client
        .from('quotes')
        .insert({
          company_id: company.id,
          number,
          customer_id: quote.customerId ?? null,
          customer_name: quote.customerName,
          customer_phone: quote.customerPhone ?? null,
          customer_email: quote.customerEmail ?? null,
          status: quote.status,
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          validity_days: quote.validityDays,
          valid_until: quote.validUntil,
          notes: quote.notes ?? null,
          terms: quote.terms ?? null,
          source_message: quote.sourceMessage ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      const inserted = row as QuotesRow;
      const { error: itemsError } = await client.from('quote_items').insert(
        input.items.map((it) => ({
          quote_id: inserted.id,
          service_id: it.serviceId ?? null,
          name: it.name,
          description: it.description ?? null,
          quantity: it.quantity,
          unit: it.unit,
          price: it.price,
          observations: it.observations ?? null,
        })),
      );
      if (itemsError) throw itemsError;

      await client.from('companies').update({ quote_counter: number }).eq('id', company.id);
      if (quote.customerId) {
        await client
          .from('customers')
          .update({ last_contact_at: new Date().toISOString() })
          .eq('id', quote.customerId)
          .eq('company_id', company.id);
      }

      const finalQuote = { ...quote, id: inserted.id, companyId: company.id };
      await applySideEffects(company, finalQuote);
      return finalQuote;
    },

    async updateQuoteStatus(id, status) {
      const { company } = await requireCompany();
      const now = new Date().toISOString();
      const rowPatch: Record<string, unknown> = { status, updated_at: now };
      if (status === 'aprovado') rowPatch.approved_at = now;
      const { data: row, error } = await client
        .from('quotes')
        .update(rowPatch)
        .eq('id', id)
        .eq('company_id', company.id)
        .select()
        .single();
      if (error) throw error;
      const { data: itemRows } = await client.from('quote_items').select('*').eq('quote_id', id);
      const updated = mapQuote(row as QuotesRow, (itemRows as QuoteItemsRow[]) ?? []);
      await applySideEffects(company, updated);
      return updated;
    },

    async updateQuote(id, patch) {
      const { company } = await requireCompany();
      const rowPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.status !== undefined) rowPatch.status = patch.status;
      if (patch.customerName !== undefined) rowPatch.customer_name = patch.customerName;
      if (patch.customerPhone !== undefined) rowPatch.customer_phone = patch.customerPhone ?? null;
      if (patch.customerEmail !== undefined) rowPatch.customer_email = patch.customerEmail ?? null;
      if (patch.notes !== undefined) rowPatch.notes = patch.notes ?? null;
      if (patch.terms !== undefined) rowPatch.terms = patch.terms ?? null;
      if (patch.validityDays !== undefined) {
        rowPatch.validity_days = patch.validityDays;
        const d = new Date();
        d.setDate(d.getDate() + patch.validityDays);
        rowPatch.valid_until = d.toISOString();
      }
      if (patch.discount !== undefined || patch.items !== undefined) {
        const current = await this.getQuote(id);
        if (current) {
          const items = patch.items ?? current.items;
          const discount = patch.discount ?? current.discount;
          const { subtotal, total } = computeTotals(items, discount);
          rowPatch.subtotal = subtotal;
          rowPatch.discount = discount;
          rowPatch.total = total;
          if (patch.items) {
            await client.from('quote_items').delete().eq('quote_id', id);
            await client.from('quote_items').insert(
              items.map((it) => ({
                quote_id: id,
                service_id: it.serviceId ?? null,
                name: it.name,
                description: it.description ?? null,
                quantity: it.quantity,
                unit: it.unit,
                price: it.price,
                observations: it.observations ?? null,
              })),
            );
          }
        }
      }
      const { data: row, error } = await client
        .from('quotes')
        .update(rowPatch)
        .eq('id', id)
        .eq('company_id', company.id)
        .select()
        .single();
      if (error) throw error;
      const { data: itemRows } = await client.from('quote_items').select('*').eq('quote_id', id);
      return mapQuote(row as QuotesRow, (itemRows as QuoteItemsRow[]) ?? []);
    },

    async markViewed(id) {
      const { data: row } = await client
        .from('quotes')
        .select('viewed_at, status')
        .eq('id', id)
        .single();
      if (!row) return;
      const patch: Record<string, unknown> = {};
      if (!row.viewed_at) {
        patch.viewed_at = new Date().toISOString();
        if (row.status === 'enviado') patch.status = 'visualizado';
        patch.updated_at = new Date().toISOString();
        await client.from('quotes').update(patch).eq('id', id);
      }
    },

    async deleteQuote(id) {
      const { company } = await requireCompany();
      const { error } = await client.from('quotes').delete().eq('id', id).eq('company_id', company.id);
      if (error) throw error;
    },

    // ========================================================== Follow-ups
    async listFollowUps() {
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('follow_ups')
        .select('*')
        .eq('company_id', company.id)
        .order('scheduled_for', { ascending: true });
      if (error) throw error;
      const rows = data as FollowUpsRow[];
      const quoteIds = [...new Set(rows.map((r) => r.quote_id))];
      const { data: qRows } = await client.from('quotes').select('*').in('id', quoteIds);
      const quoteMap = new Map((qRows as QuotesRow[]).map((q) => [q.id, q]));
      return rows.map((r) => mapFollowUp(r, quoteMap.get(r.quote_id) as QuotesRow));
    },

    async createFollowUp({ quoteId, scheduledFor, notes }) {
      const { company } = await requireCompany();
      const { data: qRow } = await client
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('company_id', company.id)
        .single();
      if (!qRow) throw new Error('Orçamento não encontrado.');
      const date = scheduledFor && !Number.isNaN(new Date(scheduledFor).getTime()) ? new Date(scheduledFor).toISOString() : suggestedFollowUpDate();
      const { data, error } = await client
        .from('follow_ups')
        .insert({ company_id: company.id, quote_id: quoteId, scheduled_for: date, notes: notes ?? null, status: 'pendente' })
        .select()
        .single();
      if (error) throw error;
      const inserted = data as FollowUpsRow;
      return mapFollowUp(inserted, qRow as QuotesRow);
    },

    async completeFollowUp(id) {
      const { company } = await requireCompany();
      const { error } = await client
        .from('follow_ups')
        .update({ status: 'concluido', completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('company_id', company.id);
      if (error) throw error;
    },

    async deleteFollowUp(id) {
      const { company } = await requireCompany();
      const { error } = await client.from('follow_ups').delete().eq('id', id).eq('company_id', company.id);
      if (error) throw error;
    },

    // ========================================================== Notificações
    async listNotifications() {
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as NotificationsRow[]).map(mapNotification);
    },

    async markAllNotificationsRead() {
      const { company } = await requireCompany();
      await client.from('notifications').update({ read: true }).eq('company_id', company.id);
    },

    async markNotificationRead(id) {
      await client.from('notifications').update({ read: true }).eq('id', id);
    },

    async addNotification(input) {
      const { company } = await requireCompany();
      await client.from('notifications').insert({
        company_id: company.id,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        read: false,
      });
    },

    // ========================================================== Mensagens
    async listMessages(quoteId) {
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('messages')
        .select('*')
        .eq('company_id', company.id)
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as MessagesRow[]).map((m) => ({
        id: m.id,
        companyId: m.company_id,
        quoteId: m.quote_id,
        body: m.body,
        channel: m.channel as GeneratedMessage['channel'],
        createdAt: m.created_at,
      }));
    },

    async createMessage({ quoteId, body, channel }) {
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('messages')
        .insert({ company_id: company.id, quote_id: quoteId, body, channel })
        .select()
        .single();
      if (error) throw error;
      const m = data as MessagesRow;
      return {
        id: m.id,
        companyId: m.company_id,
        quoteId: m.quote_id,
        body: m.body,
        channel: m.channel as GeneratedMessage['channel'],
        createdAt: m.created_at,
      };
    },

    // ========================================================== Assinatura
    async getSubscription() {
      const { company } = await requireCompany();
      const { data } = await client
        .from('subscriptions')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();
      if (!data) return null;
      const s = data as SubscriptionsRow;
      return {
        id: s.id,
        companyId: s.company_id,
        plan: s.plan as PlanId,
        status: s.status as Subscription['status'],
        startedAt: s.started_at,
        renewsAt: s.renews_at,
        provider: (s.provider as Subscription['provider']) ?? null,
        providerId: s.provider_id,
      };
    },

    async setPlan(plan) {
      const { company } = await requireCompany();
      const existing = await this.getSubscription();
      if (existing) {
        await client.from('subscriptions').update({ plan, status: 'ativo' }).eq('company_id', company.id);
      } else {
        await client.from('subscriptions').insert({
          company_id: company.id,
          plan,
          status: 'ativo',
          started_at: new Date().toISOString(),
          renews_at: null,
          provider: null,
          provider_id: null,
        });
      }
      await client.from('companies').update({ plan }).eq('id', company.id);
    },

    async listPayments() {
      const { company } = await requireCompany();
      const { data, error } = await client
        .from('payments')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data as PaymentsRow[]) ?? []).map((p) => ({
        id: p.id,
        companyId: p.company_id,
        plan: p.plan as PlanId,
        amount: Number(p.amount),
        status: p.status as Payment['status'],
        provider: p.provider,
        providerId: p.provider_id,
        createdAt: p.created_at,
        paidAt: p.paid_at,
      }));
    },

    async cancelSubscription() {
      const { company } = await requireCompany();
      await client
        .from('subscriptions')
        .update({ status: 'cancelado' })
        .eq('company_id', company.id);
      await client.from('companies').update({ plan: 'free' }).eq('id', company.id);
    },

    // No modo Supabase o checkout real é feito pela API route
    // /api/billing/checkout (que chama o Mercado Pago no servidor).
    // Estes métodos não são usados pelo navegador em produção.
    async startCheckout() {
      throw new Error('Use a API de checkout (Mercado Pago).');
    },
    async completeCheckout() {
      throw new Error('Use a API de checkout (Mercado Pago).');
    },
  };
}
