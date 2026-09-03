import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getSiteUrl } from '@/lib/site-url';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().trim().email('E-mail inválido.').max(200),
  /** Origem atual do navegador — garante que o link volte para onde o pedido foi feito. */
  origin: z.string().trim().url().optional().or(z.literal('')),
});

/**
 * POST /api/auth/reset-password
 * Inicia a recuperação de senha PELO SERVIDOR (@supabase/ssr guarda o
 * code_verifier em COOKIE). Isso elimina o erro
 * "PKCE code verifier not found in storage" ao clicar no link do e-mail.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabase().catch(() => null);
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' }, { status: 400 });
  }

  const base = parsed.data.origin?.trim() || getSiteUrl();
  const redirectTo = `${base.replace(/\/+$/, '')}/auth/recuperar-senha`;

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  if (error) {
    // Mapeia o rate limit do Supabase para uma mensagem amigável
    const code = (error as { code?: string }).code;
    const msg =
      code === 'over_email_send_rate_limit' || /rate.?limit/i.test(error.message)
        ? 'Você enviou muitos e-mails de recuperação em pouco tempo. Aguarde alguns minutos e tente novamente.'
        : error.message;
    return NextResponse.json({ error: msg }, { status: 429 });
  }
  return NextResponse.json({ ok: true });
}
