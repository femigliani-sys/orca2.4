'use client';

import { useMemo, useState } from 'react';
import {
  Sparkles,
  Send,
  Copy,
  Check,
  Bot,
  MessageSquareText,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { localInterpret } from '@/lib/ai/local';
import { localBuildMessage } from '@/lib/ai/local';
import type { AiInterpretResult, Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const DEMO_CATALOG: Service[] = [
  { id: 'd1', companyId: 'demo', name: 'Pintura de sala', description: 'Pintura completa de sala com tinta acrílica premium (2 demãos).', price: 40, unit: 'metro quadrado', category: 'Pintura', active: true, createdAt: '' },
  { id: 'd2', companyId: 'demo', name: 'Pintura de corredor', description: 'Pintura completa de corredor com tinta acrílica premium.', price: 35, unit: 'metro quadrado', category: 'Pintura', active: true, createdAt: '' },
  { id: 'd3', companyId: 'demo', name: 'Instalação de ar-condicionado 9.000 BTUs', description: 'Instalação padrão de aparelho split.', price: 450, unit: 'serviço', category: 'Instalação', active: true, createdAt: '' },
  { id: 'd4', companyId: 'demo', name: 'Instalação de ar-condicionado 12.000 BTUs', description: 'Instalação padrão de aparelho split.', price: 550, unit: 'serviço', category: 'Instalação', active: true, createdAt: '' },
  { id: 'd5', companyId: 'demo', name: 'Instalação de ar-condicionado 18.000 BTUs', description: 'Instalação padrão de aparelho split.', price: 700, unit: 'serviço', category: 'Instalação', active: true, createdAt: '' },
  { id: 'd6', companyId: 'demo', name: 'Troca de registro de água', description: 'Substituição de registro com material incluso.', price: 120, unit: 'serviço', category: 'Reparo', active: true, createdAt: '' },
  { id: 'd7', companyId: 'demo', name: 'Desentupimento de pia', description: 'Desentupimento com equipamento profissional.', price: 180, unit: 'serviço', category: 'Reparo', active: true, createdAt: '' },
];

const EXAMPLES = [
  'Oi, queria saber quanto fica para pintar uma sala de 20 metros quadrados e também o corredor.',
  'Quanto custa instalar um ar condicionado de 12 mil BTUs?',
  'Preciso trocar o registro de água do banheiro, e a pia da cozinha está entupida.',
];

interface Step {
  label: string;
}

export function InteractiveDemo() {
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<AiInterpretResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const steps: Step[] = useMemo(
    () => [
      { label: 'Lendo a mensagem do cliente…' },
      { label: 'Procurando no seu catálogo de serviços…' },
      { label: 'Montando o orçamento e a mensagem…' },
    ],
    [],
  );

  async function run(input: string) {
    if (!input.trim()) return;
    setMessage(input);
    setPhase('running');
    setStepIndex(0);
    setError('');
    setResult(null);
    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, 550));
      setStepIndex(i + 1);
    }
    try {
      const res = localInterpret(input, DEMO_CATALOG);
      setResult(res);
    } catch {
      setError('Não foi possível interpretar a mensagem.');
    }
    setPhase('done');
  }

  async function copyMessage() {
    if (!result) return;
    const total = result.items.reduce((acc, it) => acc + it.quantity * it.price, 0);
    const msg = localBuildMessage(result.items, total, 7, 'Pintores & Cia', 'João');
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar automaticamente.');
    }
  }

  const total = (result?.items ?? []).reduce((acc, it) => acc + it.quantity * it.price, 0);

  return (
    <section id="demonstracao" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Bot className="size-3.5" /> Experimente agora
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Veja a IA do OrçaAI em ação
          </h2>
          <p className="mt-4 text-lg text-ink-500">
            Cole uma mensagem de cliente — ou use um exemplo — e veja o orçamento sendo montado na hora, com os preços
            do catálogo (a IA nunca inventa valores).
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {/* Entrada */}
          <div className="flex flex-col rounded-2xl border border-ink-200/70 bg-white p-6 shadow-card">
            <label htmlFor="demo-msg" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <MessageSquareText className="size-4 text-emerald-500" /> Mensagem do cliente
            </label>
            <textarea
              id="demo-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='Ex.: "Oi, queria saber quanto fica para pintar uma sala de 20 metros quadrados e também o corredor."'
              className="mt-3 min-h-[110px] w-full resize-none rounded-xl border border-ink-200 bg-ink-50/50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => run(ex)}
                  className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  {ex.length > 44 ? `${ex.slice(0, 44)}…` : ex}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => run(message)} loading={phase === 'running'} disabled={!message.trim()} className="flex-1">
                <Sparkles className="size-4" /> Gerar orçamento com IA
              </Button>
              {result && (
                <Button variant="ghost" onClick={() => { setResult(null); setMessage(''); setPhase('idle'); }}>
                  <RotateCcw className="size-4" /> Limpar
                </Button>
              )}
            </div>

            {phase === 'running' && (
              <div className="mt-4 space-y-2">
                {steps.map((s, i) => (
                  <div
                    key={s.label}
                    className={`flex items-center gap-2 text-sm transition-opacity ${
                      i < stepIndex ? 'text-emerald-600' : i === stepIndex ? 'text-brand-600' : 'text-ink-300'
                    }`}
                  >
                    {i < stepIndex ? (
                      <Check className="size-4" />
                    ) : i === stepIndex ? (
                      <Sparkles className="size-4 animate-pulse" />
                    ) : (
                      <span className="size-4 rounded-full border-2 border-ink-200" />
                    )}
                    {s.label}
                  </div>
                ))}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </div>

          {/* Resultado */}
          <div className="flex flex-col rounded-2xl border border-ink-200/70 bg-ink-50/40 p-6">
            {!result ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-white shadow-card">
                  <Bot className="size-7 text-brand-500" />
                </span>
                <p className="mt-4 max-w-xs text-sm text-ink-500">
                  O orçamento sugerido vai aparecer aqui — com os preços exatos que você cadastrou.
                </p>
              </div>
            ) : (
              <div className="animate-fade-in space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-900">Orçamento sugerido</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                    <Sparkles className="size-3" /> Sugestão da IA
                  </span>
                </div>

                <div className="space-y-2">
                  {result.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between rounded-xl border border-ink-200/70 bg-white px-4 py-3 shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{it.name}</p>
                        <p className="text-xs text-ink-400">
                          {it.quantity > 1 ? `${it.quantity} × ` : ''}
                          {formatCurrency(it.price)} {it.unit}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-ink-900">{formatCurrency(it.quantity * it.price)}</p>
                    </div>
                  ))}
                </div>

                {result.missing.length > 0 && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <strong>Sem preço cadastrado:</strong> {result.missing.join(', ')}. O sistema pediria sua confirmação antes de enviar.
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-xl bg-ink-900 px-4 py-3 text-white">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-semibold">{formatCurrency(total)}</span>
                </div>

                <div className="rounded-xl border border-ink-200/70 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Mensagem pronta para o WhatsApp</p>
                    <button
                      onClick={copyMessage}
                      className="inline-flex items-center gap-1 rounded-md p-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? 'Copiada!' : 'Copiar'}
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
                    {localBuildMessage(result.items, total, 7, 'Pintores & Cia', 'João')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-ink-400">
          Demonstração com um catálogo de exemplo. Na sua conta, a IA usa <strong>os seus</strong> serviços e preços.
        </p>
      </div>
    </section>
  );
}
