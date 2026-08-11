import type { Company, Notification, Quote } from './types';
import { FREE_MONTHLY_QUOTES } from './constants';
import { quoteNumberLabel } from './utils';
import { suggestedFollowUpDate } from './quote-utils';

/**
 * Efeitos colaterais puros de uma mudança de status/criação de orçamento.
 * Usados tanto pelo modo Supabase quanto pelo modo local, para garantir
 * o mesmo comportamento em produção e demonstração.
 */
export interface SideEffectInput {
  quote: Quote;
  company: Company;
  /** Já existe follow-up pendente para este orçamento? */
  hasPendingFollowUp?: boolean;
  /** Já existe notificação de follow-up para este orçamento? */
  hasFollowUpNotification?: boolean;
  /** Já existe notificação de plano para esta empresa? */
  hasPlanNotification?: boolean;
  /** Quantidade de orçamentos enviados neste mês (plano grátis). */
  quotesThisMonth?: number;
}

export interface SideEffects {
  followUp: { scheduledFor: string; notes: string } | null;
  notifications: Omit<Notification, 'id' | 'companyId' | 'createdAt' | 'read'>[];
}

export function sideEffectsFor({ quote, company, hasPendingFollowUp, hasFollowUpNotification, hasPlanNotification, quotesThisMonth = 0 }: SideEffectInput): SideEffects {
  const notifications: SideEffects['notifications'] = [];
  let followUp: SideEffects['followUp'] = null;
  const label = quoteNumberLabel(quote.number);

  // Enviado → follow-up recomendado em 2 dias
  if (quote.status === 'enviado' && !hasPendingFollowUp) {
    followUp = {
      scheduledFor: suggestedFollowUpDate(),
      notes: 'Follow-up automático gerado ao enviar o orçamento.',
    };
    if (!hasFollowUpNotification) {
      notifications.push({
        type: 'followup',
        title: 'Follow-up recomendado',
        body: `Orçamento ${label} enviado para ${quote.customerName}. Recomendamos um follow-up em 2 dias.`,
        link: `/app/orcamentos/${quote.id}`,
      });
    }
  }

  // Aprovado
  if (quote.status === 'aprovado') {
    notifications.push({
      type: 'status',
      title: 'Orçamento aprovado 🎉',
      body: `${label} (${quote.customerName}) foi aprovado. Total: R$ ${quote.total.toFixed(2).replace('.', ',')}.`,
      link: `/app/orcamentos/${quote.id}`,
    });
  }

  // Aproximação do limite do plano gratuito
  if (company.plan === 'free' && !hasPlanNotification && quotesThisMonth >= FREE_MONTHLY_QUOTES - 1) {
    notifications.push({
      type: 'plan',
      title: 'Próximo do limite do plano grátis',
      body: `Você usou ${quotesThisMonth} de ${FREE_MONTHLY_QUOTES} orçamentos do plano grátis este mês. Considere o plano Pro para não parar de vender.`,
      link: '/app/planos',
    });
  }

  return { followUp, notifications };
}

/** Precisamos de um "agora" consistente para testes — centralizado aqui. */
export function monthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
