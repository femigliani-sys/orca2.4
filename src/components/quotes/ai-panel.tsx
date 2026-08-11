'use client';

import { useState } from 'react';
import { Sparkles, Check, MessageSquareText, AlertTriangle, Loader2 } from 'lucide-react';
import { interpretMessage } from '@/lib/ai';
import type { QuoteItem, Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Props {
  services: Service[];
  enabled: boolean;
  onResult: (items: QuoteItem[], missing: string[], summary: string, sourceMessage: string) => void;
}

const EXAMPLES = [
  'Oi, queria saber quanto fica para pintar uma sala de 20 metros quadrados e também o corredor.',
  'Quanto custa instalar um ar condicionado de 12 mil BTUs?',
];

const STEPS = ['Lendo a mensagem…', 'Buscando no seu catálogo…', 'Montando a sugestão…'];

/** Painel "Gerar com IA" do criador de orçamento. */
export function AiPanel({ services, enabled, onResult }: Props) {
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [summary, setSummary] = useState('');

  async function run(input: string) {
    const text = input.trim();
    if (!text) {
      setError('Cole a mensagem do cliente primeiro.');
      return;
    }
    setMessage(text);
    setPhase('running');
    setStepIndex(0);
    setError('');
    setMissing([]);
    for (let i = 0; i < STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 500));
      setStepIndex(i + 1);
    }
    try {
      const res = await interpretMessage(text, services);
      setMissing(res.missing ?? []);
      setSummary(res.summary ?? '');
      onResult(res.items, res.missing ?? [], res.summary ?? '', text);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível interpretar a mensagem.');
      setPhase('idle');
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-xl border border-ink-200/70 bg-ink-50/50 p-5 text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-white shadow-card">
          <Sparkles className="size-5 text-ink-300" />
        </span>
        <p className="mt-3 text-sm font-semibold text-ink-900">IA disponível no plano Pro</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-ink-500">
          A IA interpreta a mensagem do cliente, sugere serviços do seu catálogo e monta o orçamento — sem inventar
          preços.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-900">Gerar com IA</p>
          <p className="text-xs text-ink-500">Cole a mensagem do cliente e deixe a IA montar o orçamento</p>
        </div>
      </div>

      <Textarea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          if (error) setError('');
        }}
        placeholder='Ex.: "Oi, queria saber quanto fica para pintar uma sala de 20 metros quadrados e também o corredor."'
        className="mt-3 min-h-[90px] bg-white"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => run(ex)}
            disabled={phase === 'running'}
            className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
          >
            <MessageSquareText className="size-3" />
            {ex.length > 34 ? `${ex.slice(0, 34)}…` : ex}
          </button>
        ))}
      </div>

      <Button
        onClick={() => run(message)}
        disabled={phase === 'running' || !message.trim()}
        loading={phase === 'running'}
        className="mt-3 w-full"
      >
        <Sparkles className="size-4" /> Gerar orçamento com IA
      </Button>

      {phase === 'running' && (
        <div className="mt-3 space-y-1.5 rounded-lg bg-white p-3">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex items-center gap-2 text-xs transition-colors',
                i < stepIndex ? 'text-emerald-600' : i === stepIndex ? 'text-brand-600' : 'text-ink-300',
              )}
            >
              {i < stepIndex ? (
                <Check className="size-3.5" />
              ) : i === stepIndex ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <span className="size-3.5 rounded-full border-2 border-ink-200" />
              )}
              {s}
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      )}

      {phase === 'done' && (
        <div className="mt-3 space-y-2">
          {summary && (
            <p className="rounded-lg bg-white p-3 text-xs leading-relaxed text-ink-600">{summary}</p>
          )}
          {missing.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong>Sem preço cadastrado:</strong> {missing.join(', ')}. Adicione o serviço abaixo ou ajuste
                manualmente antes de enviar.
              </span>
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={() => setMessage('')}>
            Nova mensagem
          </Button>
        </div>
      )}
    </div>
  );
}
