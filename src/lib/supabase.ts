import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Modo demonstração: roda sem Supabase/OpenAI, com dados no navegador. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

/** Cliente usado no navegador (client components). */
export function createBrowserSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, key);
}

/**
 * Tipos das tabelas (subset do schema). Mantidos aqui como referência;
 * em produção, gere tipos com `supabase gen types`.
 */
export interface CompaniesRow {
  id: string;
  owner_id: string;
  name: string;
  business_type: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  plan: 'free' | 'pro' | 'business';
  quote_counter: number;
  onboarded: boolean;
  created_at: string;
}

export interface ServicesRow {
  id: string;
  company_id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  duration_minutes: number | null;
  observations: string | null;
  active: boolean;
  created_at: string;
}

export interface CustomersRow {
  id: string;
  company_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  last_contact_at: string | null;
}

export interface QuotesRow {
  id: string;
  company_id: string;
  number: number;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  validity_days: number;
  valid_until: string;
  notes: string | null;
  terms: string | null;
  source_message: string | null;
  created_at: string;
  updated_at: string;
  viewed_at: string | null;
  approved_at: string | null;
}

export interface QuoteItemsRow {
  id: string;
  quote_id: string;
  service_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  price: number;
  observations: string | null;
}

export interface FollowUpsRow {
  id: string;
  company_id: string;
  quote_id: string;
  scheduled_for: string;
  notes: string | null;
  status: 'pendente' | 'concluido';
  created_at: string;
  completed_at: string | null;
}

export interface NotificationsRow {
  id: string;
  company_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface MessagesRow {
  id: string;
  company_id: string;
  quote_id: string;
  body: string;
  channel: string;
  created_at: string;
}

export interface SubscriptionsRow {
  id: string;
  company_id: string;
  plan: string;
  status: string;
  started_at: string;
  renews_at: string | null;
  provider: string | null;
  provider_id: string | null;
}

export interface PaymentsRow {
  id: string;
  company_id: string;
  plan: string;
  amount: number;
  status: string;
  provider: string | null;
  provider_id: string | null;
  created_at: string;
  paid_at: string | null;
}
