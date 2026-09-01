import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { sendWhatsAppText, isWhatsAppConfigured, normalizeWaNumber } from '@/lib/whatsapp-api';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  to: z.string().min(8, 'Informe o número com DDD.').max(30),
  body: z.string().min(1).max(4000),
});

/**
 * POST /api/whatsapp/send
 * Envia uma mensagem de texto via WhatsApp Business API (Meta Cloud API).
 * - Autenticado (Supabase) — em modo demo, retorna que a API não está configurada.
 * - Rate limited (20 mensagens/minuto por empresa).
 * - A chave da Meta nunca sai do servidor.
 */
export async function POST(req: Request) {
  // Modo demonstração (sem Supabase): a API não está configurada mesmo
  if (!isSupabaseConfigured() || !isWhatsAppConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'WhatsApp Business API não configurada. Use o link wa.me (comportamento atual) ou configure as variáveis WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.',
      },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabase().catch(() => null);
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

  const rl = rateLimit(`wa:${company.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas mensagens em sequência. Aguarde um minuto.' },
      { status: 429 },
    );
  }

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

  const wa = normalizeWaNumber(parsed.data.to);
  if (!wa) return NextResponse.json({ error: 'Número de telefone inválido.' }, { status: 400 });

  const result = await sendWhatsAppText(wa, parsed.data.body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  // Registra a mensagem enviada (histórico) — falha não bloqueia o envio
  await supabase.from('messages').insert({
    company_id: company.id,
    quote_id: null,
    body: parsed.data.body,
    channel: 'whatsapp',
  }).then(
    () => {},
    () => {},
  );

  return NextResponse.json({ ok: true, messageId: result.messageId });
}
