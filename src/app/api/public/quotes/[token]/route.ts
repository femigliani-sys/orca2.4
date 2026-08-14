import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API PÚBLICA de orçamento (link compartilhado — plano Pro+).
 * NÃO exige autenticação. A segurança vem das funções `security definer`
 * do Postgres (migração 0005): só leem o orçamento cujo token é passado,
 * nunca os dados de outras empresas.
 *
 * GET  /api/public/quotes/[token]  → retorna o orçamento + empresa (e marca "visualizado")
 * POST /api/public/quotes/[token]  → aprova o orçamento (cliente confirma online)
 */

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function parseToken(param: string): string | null {
  const t = param.trim();
  // aceita uuid com/sem hífens
  const compact = t.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(compact)) return null;
  return t;
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = parseToken(params.token);
  if (!token) {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 404 });
  }

  const supabase = anonClient();
  const { data, error } = await supabase.rpc('get_public_quote', { p_token: token });

  if (error) {
    // Função não existe → migração 0005 não rodou
    return NextResponse.json(
      { error: 'Configuração pendente: execute a migração 0005 no Supabase.' },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
  }

  // Marca como visualizado (em segundo plano — não bloqueia a resposta)
  void supabase.rpc('mark_quote_viewed', { p_token: token }).then(
    () => {},
    () => {},
  );

  return NextResponse.json({ data });
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const token = parseToken(params.token);
  if (!token) {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 404 });
  }

  const supabase = anonClient();
  const { error } = await supabase.rpc('approve_quote_by_token', { p_token: token });
  if (error) {
    return NextResponse.json(
      { error: 'Não foi possível aprovar o orçamento. Recarregue e tente de novo.' },
      { status: 500 },
    );
  }

  // Retorna o orçamento atualizado (para a página mostrar o estado aprovado)
  const { data } = await supabase.rpc('get_public_quote', { p_token: token });
  return NextResponse.json({ ok: true, data });
}
