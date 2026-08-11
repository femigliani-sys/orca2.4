/**
 * Interface da IA usada pela aplicação (client).
 * - Modo demonstração: interpretador local (offline, sem custo)
 * - Modo produção:   API route /api/ai/interpret (OpenAI no servidor,
 *                    com rate limiting e sem expor chaves)
 */
import type { AiInterpretResult, Service } from '../types';
import { isDemoMode } from '../supabase';
import { localInterpret } from './local';

export async function interpretMessage(message: string, services: Service[]): Promise<AiInterpretResult> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error('Cole a mensagem do cliente primeiro.');

  if (isDemoMode()) {
    // Retardo artificial pequeno para dar feedback visual de "processando"
    await new Promise((r) => setTimeout(r, 450));
    return localInterpret(trimmed, services);
  }

  const res = await fetch('/api/ai/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: trimmed }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    data?: AiInterpretResult;
  };

  if (!res.ok || !json.data) {
    throw new Error(json.error || 'Não foi possível interpretar a mensagem agora. Tente novamente.');
  }
  return json.data;
}

export { localInterpret } from './local';
export { buildQuoteMessage } from './templates';
export type { AiInterpretResult } from '../types';
