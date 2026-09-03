import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.').max(72),
});

/**
 * POST /api/auth/update-password
 * Define a nova senha usando a SESSÃO DO COOKIE (server-side).
 * Chamado após a troca do código de recuperação (que também ocorre no servidor).
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

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return NextResponse.json(
      { error: 'Não foi possível alterar a senha. Refaça o processo de recuperação e tente de novo.' },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
