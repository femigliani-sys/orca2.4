/**
 * Interpretação via OpenAI (executada APENAS no servidor — a chave nunca
 * chega ao navegador). Regras rígidas: a IA só sugere serviços e preços
 * vindos do catálogo da empresa; nunca inventa valores.
 */
import type { AiInterpretResult, QuoteItem, Service } from '../types';
import { generateId, normalizeText, round2 } from '../utils';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `Você é o "OrçaAI", assistente de orçamentos para pequenos negócios brasileiros.
Sua tarefa é transformar a mensagem de um cliente em itens de orçamento.

REGRAS OBRIGATÓRIAS:
1. Use APENAS os serviços do catálogo fornecidos pelo usuário (empresa).
2. NUNCA invente preços, serviços, prazos ou disponibilidade.
3. Se o pedido do cliente corresponder a um serviço do catálogo, retorne-o com o preço exato do catálogo.
4. Extraia quantidades quando a mensagem indicar (ex.: "20 metros quadrados", "2 portas", "3 horas"). Se não houver quantidade explícita, use 1.
5. Se algo no pedido não bater com nenhum serviço do catálogo, adicione um resumo em "missing".
6. needsConfirmation deve ser true quando houver itens em "missing", quantidades presumidas ou qualquer incerteza.
7. Gere uma "message" curta e profissional em português que a empresa enviará ao cliente via WhatsApp, listando os itens com preços e o total. Se houver incerteza, a mensagem deve pedir confirmação do cliente.

Responda SOMENTE com JSON válido neste formato:
{"items":[{"serviceId":"id do catálogo","quantity":1,"observations":"opcional"}],"missing":["frase curta"],"summary":"resumo do que foi entendido","needsConfirmation":true,"message":"mensagem para o cliente"}`;

interface RawItem {
  serviceId?: string;
  quantity?: number;
  observations?: string;
}

function parseRaw(json: unknown): { items: RawItem[]; missing: string[]; summary: string; needsConfirmation: boolean; message?: string } {
  const obj = (json ?? {}) as Record<string, unknown>;
  return {
    items: Array.isArray(obj.items) ? (obj.items as RawItem[]) : [],
    missing: Array.isArray(obj.missing) ? (obj.missing as unknown[]).map(String) : [],
    summary: typeof obj.summary === 'string' ? obj.summary : '',
    needsConfirmation: Boolean(obj.needsConfirmation),
    message: typeof obj.message === 'string' ? obj.message : undefined,
  };
}

export async function openaiInterpret(message: string, services: Service[]): Promise<AiInterpretResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada no servidor.');

  const catalog = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    price: s.price,
    unit: s.unit,
    category: s.category,
  }));

  const userContent = `Catálogo de serviços da empresa (JSON):\n${JSON.stringify(catalog)}\n\nMensagem do cliente:\n"""${message.slice(0, 4000)}"""`;

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Falha na chamada da IA (${res.status}). ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('A IA não retornou uma resposta válida.');

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(content);
  } catch {
    throw new Error('A IA retornou JSON inválido.');
  }

  const parsed = parseRaw(parsedRaw);

  // Coerção com o catálogo: garante que preços/nomes venham do cadastro.
  const items: QuoteItem[] = [];
  const usedIds = new Set<string>();
  for (const raw of parsed.items) {
    let svc = raw.serviceId ? services.find((s) => s.id === raw.serviceId) : undefined;
    if (!svc && typeof raw.serviceId === 'string') {
      svc = services.find((s) => normalizeText(s.name) === normalizeText(raw.serviceId as string));
    }
    if (!svc || usedIds.has(svc.id)) continue;
    usedIds.add(svc.id);
    const qty = Math.max(1, Number(raw.quantity) || 1);
    items.push({
      id: generateId(),
      serviceId: svc.id,
      name: svc.name,
      description: svc.description,
      quantity: round2(qty),
      unit: svc.unit,
      price: svc.price, // preço SEMPRE do catálogo
      observations: raw.observations ?? svc.observations,
    });
  }

  return {
    items,
    missing: parsed.missing,
    summary: parsed.summary || (items.length === 0 ? 'Nenhum serviço do catálogo foi reconhecido.' : 'Pedido interpretado com sucesso.'),
    needsConfirmation: parsed.needsConfirmation || parsed.missing.length > 0 || items.length === 0,
    message: parsed.message,
  };
}
