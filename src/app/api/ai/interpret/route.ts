import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';
import { aiInterpretSchema } from '@/lib/validation';
import { openaiInterpret } from '@/lib/ai/openai';
import { localInterpret } from '@/lib/ai/local';
import type { Service } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/interpret
 * Interpreta a mensagem do cliente usando o catálogo de serviços da empresa.
 * - Exige autenticação (Supabase)
 * - Rate limited (10 chamadas/minuto por empresa)
 * - Usa OpenAI quando OPENAI_API_KEY existe; caso contrário, interpretador local
 * - A chave da OpenAI NUNCA sai do servidor
 */
export async function POST(req: Request) {
  // 1) Autenticação + identificação da empresa
  let supabase;
  try {
    supabase = await createServerSupabase();
  } catch {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado. Faça login para usar a IA.' }, { status: 401 });
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single();
  if (companyError || !company) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
  }

  // 2) Rate limiting (proteção das funções de IA)
  const rl = rateLimit(`ai:${company.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Você fez muitas chamadas em sequência. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  }

  // 3) Validação do input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const parsed = aiInterpretSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' }, { status: 400 });
  }

  // 4) Catálogo SEMPRE vindo do banco (nunca do cliente)
  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, price, unit, category, active, observations')
    .eq('company_id', company.id)
    .eq('active', true);

  const catalog: Service[] = ((services ?? []) as Record<string, unknown>[]).map((s) => ({
    id: String(s.id),
    companyId: company.id,
    name: String(s.name),
    description: String(s.description ?? ''),
    price: Number(s.price),
    unit: String(s.unit),
    category: String(s.category ?? 'Outros'),
    observations: s.observations ? String(s.observations) : undefined,
    active: true,
    createdAt: '',
  }));

  // 5) IA: OpenAI (se configurada) com fallback local
  let result;
  if (process.env.OPENAI_API_KEY) {
    try {
      result = await openaiInterpret(parsed.data.message, catalog);
    } catch {
      result = localInterpret(parsed.data.message, catalog);
      result.summary = `${result.summary} (interpretação local — verifique a chave da IA).`;
    }
  } else {
    result = localInterpret(parsed.data.message, catalog);
  }

  return NextResponse.json({ data: result });
}
