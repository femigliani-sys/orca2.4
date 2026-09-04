import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente ADMIN (service role) — usado APENAS em rotas de servidor sensíveis
 * (ex.: webhook do Mercado Pago) quando SUPABASE_SERVICE_ROLE_KEY está
 * configurada. Nunca exponha este cliente ao navegador.
 */
export function isServiceRoleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createAdminSupabase(): SupabaseClient | null {
  if (!isServiceRoleConfigured()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
