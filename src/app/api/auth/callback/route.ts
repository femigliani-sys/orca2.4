import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  code: z.string().min(1),
});

/**
 * POST /api/auth/callback
 * Troca o código do link de recuperação/confirmação por uma sessão,
 * PELO SERVIDOR — lendo o code_verifier que ficou salvo em COOKIE quando o
 * pedido foi iniciado (rota /api/auth/reset-password). É o padrão que o
 * @supabase/ssr recomenda e elimina o erro "PKCE code verifier not found".
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
    return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
  }

  const { error } = await supabase.auth.exchangeCodeForSession(parsed.data.code);
  if (error) {
    return NextResponse.json(
      {
        error:
          'Não foi possível validar o link de recuperação. Solicite um novo link e abra-o no MESMO navegador/dispositivo em que você fez o pedido.',
        detail: error.message,
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
