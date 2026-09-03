import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getSiteUrl } from '@/lib/site-url';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().trim().email('E-mail inválido.').max(200),
  origin: z.string().trim().url().optional().or(z.literal('')),
});

/**
 * POST /api/auth/resend-confirmation
 * Reenvia o e-mail de confirmação de cadastro pelo servidor.
 * O Supabase aplica rate limit (~3/h) — retornamos 429 com mensagem clara.
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
  const redirectTo = `${base.replace(/\/+$/, '')}/auth/confirmar-email`;

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    const code = (error as { code?: string }).code;
    const msg =
      code === 'over_email_send_rate_limit' || /rate.?limit/i.test(error.message)
        ? 'Limite de envio atingido. O provedor permite poucos e-mails por hora — aguarde alguns minutos e tente novamente.'
        : error.message;
    return NextResponse.json({ error: msg }, { status: 429 });
  }
  return NextResponse.json({ ok: true });
}
