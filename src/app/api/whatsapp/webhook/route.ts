import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook do WhatsApp Business API (Meta Cloud API).
 *
 * GET (verificação):
 *   A Meta chama com ?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=...
 *   Respondemos com o challenge se o verify_token bater.
 *
 * POST (eventos):
 *   Recebe mensagens recebidas/status de entrega. Neste MVP registramos
 *   o recebimento no log e respondemos 200 sempre (a Meta reenvia em erro).
 */
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? 'ok', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (!VERIFY_TOKEN) {
    return NextResponse.json(
      { error: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado no servidor.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: 'Falha na verificação do webhook.' }, { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text().catch(() => '');
  if (!raw) return NextResponse.json({ received: true });

  try {
    const body = JSON.parse(raw) as {
      entry?: { changes?: { value?: { messages?: unknown[]; statuses?: unknown[] } }[] }[];
    };
    const changes = body.entry?.[0]?.changes?.[0]?.value;
    const messages = changes?.messages ?? [];
    const statuses = changes?.statuses ?? [];

    if (messages.length > 0) {
      console.log('[whatsapp-webhook] mensagens recebidas:', messages.length);
      // MVP: registrar futuramente na tabela (inbound). Por enquanto, log.
    }
    if (statuses.length > 0) {
      console.log('[whatsapp-webhook] atualizações de status:', statuses.length);
    }
  } catch {
    // payload inválido — ignora
  }

  // Sempre 200 (a Meta reenvia em caso de erro)
  return NextResponse.json({ received: true });
}
