import {
  Sparkles,
  FileText,
  Users,
  BellRing,
  KanbanSquare,
  BarChart3,
  MessageCircle,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PLANS } from '@/lib/plans';
import { formatPlanPrice } from '@/lib/plans';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Orçamentos com IA',
    text: 'Cole a mensagem do cliente e a IA identifica serviços, quantidades e preços do seu catálogo. Sem inventar valores.',
    color: 'bg-brand-50 text-brand-600',
  },
  {
    icon: FileText,
    title: 'PDF profissional',
    text: 'Orçamento em PDF com sua logo, termos e assinatura. Baixe e compartilhe em um clique.',
    color: 'bg-ink-100 text-ink-600',
  },
  {
    icon: Users,
    title: 'CRM de clientes',
    text: 'Histórico completo de cada cliente: orçamentos, valores, contatos e status.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: BellRing,
    title: 'Follow-ups automáticos',
    text: 'Receba lembretes de follow-up no momento certo e nunca mais deixe uma venda esfriar.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: KanbanSquare,
    title: 'Pipeline de vendas',
    text: 'Arrume seus orçamentos em colunas: novo, enviado, negociação, aprovado e perdido.',
    color: 'bg-sky-50 text-sky-600',
  },
  {
    icon: BarChart3,
    title: 'Métricas claras',
    text: 'Valor enviado, aprovado, taxa de conversão e ticket médio — sempre à mão.',
    color: 'bg-violet-50 text-violet-600',
  },
];

export function Features() {
  return (
    <section id="funcionalidades" className="scroll-mt-20 bg-ink-50/60 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Tudo que você precisa para vender mais
          </h2>
          <p className="mt-4 text-lg text-ink-500">
            Sem planilhas, sem modelos no Word, sem mensagens improvisadas.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-ink-200/70 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
              <span className={`grid size-11 place-items-center rounded-lg ${f.color}`}>
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link href="/auth/cadastro">
            <Button size="lg">Começar grátis</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ PREÇOS
export function Pricing() {
  return (
    <section id="precos" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">Planos simples e honestos</h2>
          <p className="mt-4 text-lg text-ink-500">
            Comece grátis e evolua quando fizer sentido. Cancele quando quiser.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlighted
                  ? 'border-brand-600 bg-ink-950 text-white shadow-card-hover lg:-translate-y-2'
                  : 'border-ink-200/70 bg-white shadow-card'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                  Mais popular
                </span>
              )}
              <h3 className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : 'text-ink-900'}`}>{plan.name}</h3>
              <p className={`mt-1 text-sm ${plan.highlighted ? 'text-ink-300' : 'text-ink-500'}`}>{plan.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className={`text-4xl font-bold tracking-tight ${plan.highlighted ? 'text-white' : 'text-ink-950'}`}>
                  {formatPlanPrice(plan)}
                </span>
                <span className={`text-sm ${plan.highlighted ? 'text-ink-400' : 'text-ink-400'}`}>/mês</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className={`mt-0.5 size-4 shrink-0 ${plan.highlighted ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    <span className={plan.highlighted ? 'text-ink-100' : 'text-ink-600'}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/cadastro" className="mt-8">
                <Button
                  variant={plan.highlighted ? 'default' : 'secondary'}
                  className={`w-full ${plan.highlighted ? 'bg-brand-500 hover:bg-brand-400' : ''}`}
                >
                  {plan.id === 'free' ? 'Começar grátis' : `Assinar ${plan.name}`}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-ink-400">
          Pagamento via Pix, boleto ou cartão · Preços em reais
        </p>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ FAQ
const FAQS = [
  {
    q: 'Preciso saber usar IA?',
    a: 'Não. A IA funciona sozinha: você cola a mensagem do cliente e ela sugere os serviços com os preços do seu próprio catálogo. Você apenas revisa e envia. Tudo em português e pensado para quem não é técnico.',
  },
  {
    q: 'Funciona pelo celular?',
    a: 'Sim. O OrçaAI é 100% responsivo — funciona perfeitamente no celular, tablet, notebook e desktop. Você consegue criar e enviar um orçamento com uma mão, direto do WhatsApp.',
  },
  {
    q: 'Posso enviar pelo WhatsApp?',
    a: 'Sim. Um toque no botão "Enviar pelo WhatsApp" abre a conversa com o cliente com a mensagem e o orçamento prontos. Futuramente teremos integração com a API oficial do WhatsApp.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Pode. Sem multa e sem fidelidade. Você cancela em um clique nas configurações e o plano volta para o gratuito ao final do ciclo.',
  },
  {
    q: 'Existe plano gratuito?',
    a: 'Sim! O plano gratuito permite criar até 5 orçamentos por mês, cadastrar seus serviços e gerar PDF básico — sem cartão de crédito.',
  },
  {
    q: 'Meus dados estão seguros?',
    a: 'Sim. Cada empresa só enxerga os próprios dados (isolamento por Row Level Security), senhas criptografadas e todas as rotas protegidas.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-ink-50/60 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">Perguntas frequentes</h2>
        </div>
        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl border border-ink-200/70 bg-white shadow-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="text-ink-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-500">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ CTA FINAL
export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-ink-950 py-16 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(700px 400px at 20% 20%, rgba(99,102,241,0.25), transparent), radial-gradient(700px 400px at 80% 80%, rgba(16,185,129,0.15), transparent)',
        }}
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <MessageCircle className="mx-auto size-10 text-brand-400" />
        <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Pare de perder vendas por demora no orçamento.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-300">
          Crie seu primeiro orçamento em menos de 2 minutos — de graça.
        </p>
        <div className="mt-8">
          <Link href="/auth/cadastro">
            <Button size="lg" className="bg-brand-500 px-8 hover:bg-brand-400">
              Começar grátis
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-ink-400">Sem cartão de crédito · Setup em 2 minutos</p>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ FOOTER
export function Footer() {
  return (
    <footer className="border-t border-ink-800 bg-ink-950 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-white">
            Orça<span className="text-brand-400">AI</span>
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Transforme pedidos de orçamento em vendas. Feito no Brasil 🇧🇷
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-400">
          <a href="#como-funciona" className="hover:text-white">Como funciona</a>
          <a href="#precos" className="hover:text-white">Preços</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
          <a href="/auth/login" className="hover:text-white">Entrar</a>
        </div>
      </div>
    </footer>
  );
}
