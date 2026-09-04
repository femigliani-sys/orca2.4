import type { Plan, PlanId } from './types';
import { FREE_MAX_CUSTOMERS, FREE_MAX_SERVICES, FREE_MONTHLY_QUOTES } from './constants';

/**
 * Configuração centralizada de planos e preços.
 * Para alterar preços/limites do produto, edite SOMENTE este arquivo.
 */
export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Grátis',
    price: 0,
    tagline: 'Para começar a vender hoje.',
    features: [
      'Até 5 orçamentos por mês',
      'Cadastro de até 10 serviços',
      'Até 30 clientes',
      'Geração de PDF básico',
      'Compartilhamento via WhatsApp',
      'Link público do orçamento com pagamento (taxa de 2%)',
    ],
    limits: {
      quotesPerMonth: FREE_MONTHLY_QUOTES,
      services: FREE_MAX_SERVICES,
      customers: FREE_MAX_CUSTOMERS,
      ai: false,
      pdfBranded: false,
      pipeline: false,
      followUps: false,
      metrics: false,
      multiUser: false,
      automations: false,
      shareLinks: true,
      payments: true,
    },
    feePercent: 2,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 59,
    tagline: 'Para profissionais que querem fechar mais.',
    highlighted: true,
    features: [
      'Orçamentos ilimitados',
      'IA para interpretar pedidos',
      'PDF personalizado com sua marca',
      'Clientes ilimitados',
      'Pipeline de vendas',
      'Follow-ups automáticos e lembretes',
      'Métricas e taxa de conversão',
      'Link público do orçamento (cliente aprova online)',
      'Pagamento pelo link SEM taxas (100% para você)',
      'Sem marca d\'água',
    ],
    limits: {
      quotesPerMonth: null,
      services: null,
      customers: null,
      ai: true,
      pdfBranded: true,
      pipeline: true,
      followUps: true,
      metrics: true,
      multiUser: false,
      automations: false,
      shareLinks: true,
      payments: true,
    },
    feePercent: 0,
  },
  {
    id: 'business',
    name: 'Business',
    price: 99,
    tagline: 'Para equipes e operações maiores.',
    features: [
      'Tudo do plano Pro',
      'Múltiplos usuários',
      'Permissões por membro',
      'Automações de follow-up',
      'Relatórios avançados',
      'Link público do orçamento (cliente aprova online)',
      'Pagamento pelo link SEM taxas (100% para você)',
      'Prioridade no suporte',
    ],
    limits: {
      quotesPerMonth: null,
      services: null,
      customers: null,
      ai: true,
      pdfBranded: true,
      pipeline: true,
      followUps: true,
      metrics: true,
      multiUser: true,
      automations: true,
      shareLinks: true,
      payments: true,
    },
    feePercent: 0,
  },
];

export const PLAN_MAP = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, Plan>;

export function getPlan(id: PlanId): Plan {
  return PLAN_MAP[id] ?? PLAN_MAP.free;
}

export function planHasFeature(plan: PlanId, feature: keyof Plan['limits']): boolean {
  return Boolean(getPlan(plan).limits[feature]);
}

/** Retorna a limitação mensal do plano (null = ilimitado). */
export function quotesLimit(plan: PlanId): number | null {
  return getPlan(plan).limits.quotesPerMonth;
}

export function formatPlanPrice(plan: Plan): string {
  return plan.price === 0 ? 'R$ 0' : `R$${plan.price}`;
}

/** Preço em centavos (Mercado Pago trabalha com centavos). */
export function planPriceCents(plan: Plan): number {
  return Math.round(plan.price * 100);
}

// ---------------------------------------------------------------- Comissões
/** Percentual de comissão do OrçaAI sobre pagamentos pelo link (free=2%, pago=0%). */
export function platformFeePercent(planId: PlanId): number {
  return getPlan(planId).feePercent ?? (planId === 'free' ? 2 : 0);
}

/** Calcula a comissão do OrçaAI em R$ para um valor (centavos corretos). */
export function computePlatformFee(planId: PlanId, amount: number): { fee: number; seller: number } {
  const pct = platformFeePercent(planId);
  const fee = Math.round(amount * pct) / 100; // arredonda em 2 casas
  return { fee, seller: Math.max(0, Math.round((amount - fee) * 100) / 100) };
}
