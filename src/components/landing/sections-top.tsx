import {
  MessageSquareText,
  Sparkles,
  FileText,
  Send,
  BellRing,
  CheckCircle2,
  ArrowDown,
  Clock,
  SearchX,
  ArchiveX,
  UserX,
  CalendarX,
  FileX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ------------------------------------------------------------------ HERO
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(600px 300px at 15% 0%, rgba(99,102,241,0.08), transparent), radial-gradient(700px 320px at 90% 10%, rgba(16,185,129,0.06), transparent)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Sparkles className="size-3.5" />
            IA que transforma mensagens em orçamentos
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl lg:text-6xl">
            Transforme pedidos de orçamento{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">em vendas.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-500">
            Crie, envie e acompanhe seus orçamentos em segundos — direto do WhatsApp,
            com a ajuda de IA que entende o pedido do cliente.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/auth/cadastro" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                Começar grátis
              </Button>
            </a>
            <a href="#como-funciona" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Ver como funciona
              </Button>
            </a>
          </div>
          <p className="mt-4 text-sm text-ink-400">Grátis para começar · Sem cartão de crédito · Feito para o Brasil</p>
        </div>

        {/* Mockup */}
        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  const steps = [
    { icon: MessageSquareText, label: 'Cliente chama no WhatsApp', color: 'text-emerald-600 bg-emerald-50' },
    { icon: Sparkles, label: 'IA entende o pedido', color: 'text-brand-600 bg-brand-50' },
    { icon: FileText, label: 'Orçamento criado', color: 'text-ink-600 bg-ink-100' },
    { icon: Send, label: 'Você envia em 1 toque', color: 'text-sky-600 bg-sky-50' },
    { icon: BellRing, label: 'Follow-up automático', color: 'text-amber-600 bg-amber-50' },
    { icon: CheckCircle2, label: 'Venda fechada', color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="mx-auto mt-14 max-w-4xl">
      <div className="rounded-2xl border border-ink-200/70 bg-white p-4 shadow-card-hover sm:p-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-100">
            <MessageSquareText className="size-5 text-emerald-600" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">Cliente (WhatsApp)</p>
            <p className="text-xs text-ink-400">hoje, 09:12</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-ink-50 p-4">
          <p className="text-sm text-ink-700">
            "Oi, queria saber quanto fica para instalar um ar condicionado de 12 mil BTUs e também quanto custa a
            limpeza de uma sala de 30 metros."
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-brand-600">
          <Sparkles className="size-4" />
          OrçaAI identificou os serviços do seu catálogo
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink-900">Instalação de ar-condicionado 12.000 BTUs</p>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <p className="mt-1 text-sm font-semibold text-ink-900">R$ 550</p>
            <p className="text-xs text-ink-400">1 × serviço · do seu catálogo</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink-900">Limpeza de ar-condicionado</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                <Clock className="size-3" /> 30 m² detectados
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-ink-900">R$ 120</p>
            <p className="text-xs text-ink-400">1 × serviço · do seu catálogo</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-900 px-4 py-3 text-white">
          <span className="text-sm font-medium">Total do orçamento</span>
          <span className="text-lg font-semibold">R$ 670</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${s.color}`}>
                <s.icon className="size-3.5" />
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              {i < steps.length - 1 && <ArrowDown className="hidden size-4 text-ink-300 sm:block sm:-rotate-90" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ PROBLEMA
const PROBLEMS = [
  { icon: Clock, title: 'Demora para montar o orçamento', text: 'Cada pedido vira uma tarefa manual de calcular, formatar e escrever.' },
  { icon: SearchX, title: 'Esquece de responder', text: 'Mensagens se perdem entre dezenas de conversas no WhatsApp.' },
  { icon: ArchiveX, title: 'Perde o histórico', text: 'Sem registro de valores, prazos e combinados de cada cliente.' },
  { icon: CalendarX, title: 'Não faz follow-up', text: 'Orçamentos enviados caem no esquecimento — e a venda morre.' },
  { icon: FileX, title: 'Orçamento pouco profissional', text: 'Uma imagem amadora ou texto corrido passa menos confiança.' },
];

export function Problem() {
  return (
    <section className="bg-ink-50/60 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Quantos clientes você perde porque demora para responder?
          </h2>
          <p className="mt-4 text-lg text-ink-500">
            Cada minuto de espera é uma chance de o cliente chamar o concorrente.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="rounded-xl border border-ink-200/70 bg-white p-5 shadow-card">
              <span className="grid size-10 place-items-center rounded-lg bg-rose-50">
                <p.icon className="size-5 text-rose-500" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-ink-900">{p.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{p.text}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl rounded-xl border border-brand-200 bg-brand-50 p-6 text-center">
          <p className="text-lg font-medium text-brand-900">
            No OrçaAI, um pedido simples vira um orçamento profissional em <strong>menos de 2 minutos</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ SOLUÇÃO
export function Solution() {
  const steps = [
    { icon: MessageSquareText, title: 'Cliente chama', text: 'No WhatsApp, Instagram ou e-mail.', color: 'bg-emerald-50 text-emerald-600' },
    { icon: Sparkles, title: 'IA entende o pedido', text: 'Você cola a mensagem e a IA identifica o serviço, a quantidade e o preço do seu catálogo.', color: 'bg-brand-50 text-brand-600' },
    { icon: FileText, title: 'Orçamento criado', text: 'Itens, desconto, validade e PDF profissional prontos para revisar.', color: 'bg-ink-100 text-ink-600' },
    { icon: Send, title: 'Cliente recebe', text: 'Mensagem pronta + link do WhatsApp. Envie em um toque.', color: 'bg-sky-50 text-sky-600' },
    { icon: BellRing, title: 'Follow-up', text: 'Lembretes automáticos para não deixar a venda esfriar.', color: 'bg-amber-50 text-amber-600' },
    { icon: CheckCircle2, title: 'Venda fechada', text: 'Aprovação com um clique e controle de tudo no seu painel.', color: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <section id="como-funciona" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">Do pedido à venda em segundos</h2>
          <p className="mt-4 text-lg text-ink-500">
            Um fluxo simples, do jeito que seu negócio precisa.
          </p>
        </div>

        <div className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-xl border border-ink-200/70 bg-white p-6 shadow-card">
              <span className="absolute right-4 top-4 text-4xl font-bold text-ink-100">{String(i + 1).padStart(2, '0')}</span>
              <span className={`grid size-11 place-items-center rounded-lg ${s.color}`}>
                <s.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ SOCIAL PROOF (chips)
export function Audience() {
  const items = [
    'Eletricistas', 'Encanadores', 'Técnicos de ar-condicionado', 'Instaladores', 'Pintores',
    'Empresas de limpeza', 'Assistência técnica', 'Fotógrafos', 'Designers', 'Marceneiros',
    'Mecânicos', 'Manutenção', 'Profissionais autônomos',
  ];
  return (
    <section className="border-y border-ink-100 bg-ink-50/40 py-10">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-ink-400">Feito para quem vive de prestar serviço no Brasil</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {items.map((it) => (
            <span key={it} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600">
              {it}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
