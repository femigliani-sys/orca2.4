// Tipos centrais do OrçaAI.
// As entidades espelham o schema do Supabase (ver supabase/migrations/0001_init.sql)
// e são usadas tanto pelo modo Supabase quanto pelo modo demonstração (local).

export type ID = string;

// ---------------------------------------------------------------- Usuário
export interface User {
  id: ID;
  name: string;
  email: string;
  companyName: string;
  businessType: string;
  onboarded: boolean;
  createdAt: string; // ISO
}

// ---------------------------------------------------------------- Empresa
export interface CompanySettings {
  // Orçamentos
  quoteValidityDays: number;
  defaultMessage: string; // template com placeholders
  defaultNotes: string;
  terms: string;
  // Aparência / PDF
  showLogo: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showAddress: boolean;
  showCnpj: boolean;
  showSignature: boolean;
  signatureName: string;
  accentColor: string; // hex (PDF)
}

export interface Company {
  id: ID;
  ownerId: ID;
  name: string;
  businessType: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  cnpj?: string;
  logoUrl?: string; // dataURL (demo) ou URL do Supabase Storage
  settings: CompanySettings;
  plan: PlanId;
  quoteCounter: number;
  createdAt: string;
}

// ---------------------------------------------------------------- Serviços
export interface Service {
  id: ID;
  companyId: ID;
  name: string;
  description: string;
  price: number; // em reais (R$)
  unit: string; // serviço, hora, m², peça, unidade, diária...
  category: string;
  durationMinutes?: number | null;
  observations?: string;
  active: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------- Clientes
export interface Customer {
  id: ID;
  companyId: ID;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  lastContactAt?: string | null;
}

// ---------------------------------------------------------------- Orçamentos
export type QuoteStatus =
  | 'rascunho'
  | 'enviado'
  | 'visualizado'
  | 'negociacao'
  | 'aprovado'
  | 'recusado'
  | 'expirado';

export interface QuoteItem {
  id: ID;
  serviceId?: ID | null;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  price: number; // preço unitário
  observations?: string;
}

export interface Quote {
  id: ID;
  companyId: ID;
  number: number; // sequencial da empresa (#00042)
  customerId?: ID | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  status: QuoteStatus;
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  validityDays: number;
  validUntil: string; // ISO date
  notes?: string;
  terms?: string;
  sourceMessage?: string; // mensagem original do cliente (usada pela IA)
  createdAt: string;
  updatedAt: string;
  viewedAt?: string | null;
  approvedAt?: string | null;
}

export interface QuoteInput {
  customerId?: ID | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  status: QuoteStatus;
  items: QuoteItem[];
  discount: number;
  validityDays: number;
  notes?: string;
  terms?: string;
  sourceMessage?: string;
}

// ---------------------------------------------------------------- Follow-ups
export interface FollowUp {
  id: ID;
  companyId: ID;
  quoteId: ID;
  quoteNumber: number;
  customerName: string;
  value: number;
  scheduledFor: string; // ISO date
  notes?: string;
  status: 'pendente' | 'concluido';
  createdAt: string;
  completedAt?: string | null;
}

// ---------------------------------------------------------------- Notificações
export interface Notification {
  id: ID;
  companyId: ID;
  type: 'followup' | 'status' | 'plan' | 'system';
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------- Mensagens
export interface GeneratedMessage {
  id: ID;
  companyId: ID;
  quoteId: ID;
  body: string;
  channel: 'whatsapp' | 'email' | 'copiado';
  createdAt: string;
}

// ---------------------------------------------------------------- Assinatura
export type PlanId = 'free' | 'pro' | 'business';

export interface Subscription {
  id: ID;
  companyId: ID;
  plan: PlanId;
  status: 'ativo' | 'cancelado' | 'atrasado' | 'pendente';
  startedAt: string;
  renewsAt?: string | null;
  provider?: 'mercado_pago' | 'stripe' | 'simulado' | 'manual' | null;
  providerId?: string | null;
}

// ---------------------------------------------------------------- IA
export interface AiInterpretResult {
  items: QuoteItem[]; // serviços reconhecidos com preço do catálogo
  missing: string[]; // trechos/necessidades que não bateram com catálogo
  summary: string;
  needsConfirmation: boolean;
  message?: string; // mensagem sugerida pela IA (opcional)
}

// ---------------------------------------------------------------- Plano
export interface Plan {
  id: PlanId;
  name: string;
  price: number; // R$/mês (0 = grátis)
  tagline: string;
  features: string[];
  limits: {
    quotesPerMonth: number | null; // null = ilimitado
    services: number | null;
    customers: number | null;
    ai: boolean;
    pdfBranded: boolean;
    pipeline: boolean;
    followUps: boolean;
    metrics: boolean;
    multiUser: boolean;
    automations: boolean;
  };
  highlighted?: boolean;
}

// ---------------------------------------------------------------- Utilidades de contexto
export interface AppData {
  user: User | null;
  company: Company | null;
  services: Service[];
  customers: Customer[];
  quotes: Quote[];
  followUps: FollowUp[];
  notifications: Notification[];
}
