'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Download,
  Copy,
  MessageCircle,
  Share2,
  Trash2,
  CalendarClock,
  CheckCircle2,
  Plus,
  BellRing,
  User,
  Link2,
  Lock,
  Check,
  Eye,
} from 'lucide-react';
import { planHasFeature } from '@/lib/plans';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { QuoteStatusBadge } from '@/components/ui/status-badge';
import { MessageCard } from '@/components/quotes/message-card';
import { db } from '@/lib/db';
import { downloadQuotePdf } from '@/lib/pdf';
import { buildWaLink } from '@/lib/whatsapp';
import { buildQuoteMessage } from '@/lib/ai/templates';
import { QUOTE_STATUSES, VALIDITY_OPTIONS } from '@/lib/constants';
import { effectiveStatus, isQuoteExpired, suggestedFollowUpDate } from '@/lib/quote-utils';
import { cn, formatCurrency, formatDateFull, formatDateTime, quoteNumberLabel } from '@/lib/utils';
import type { GeneratedMessage, QuoteStatus } from '@/lib/types';

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quoteId = params.id;

  const { company, quotes, followUps, refresh } = useData();
  const quote = useMemo(() => quotes.find((q) => q.id === quoteId), [quotes, quoteId]);

  const [messages, setMessages] = useState<GeneratedMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newFollowUpDate, setNewFollowUpDate] = useState(suggestedFollowUpDate().slice(0, 10));
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [paidInfos, setPaidInfos] = useState<Awaited<ReturnType<typeof db.listQuotePayments>>>([]);

  const quoteFollowUps = useMemo(
    () => followUps.filter((f) => f.quoteId === quoteId).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    [followUps, quoteId],
  );
  const pendingFollowUps = quoteFollowUps.filter((f) => f.status === 'pendente');

  const loadMessages = useCallback(async () => {
    if (!quoteId) return;
    try {
      const msgs = await db.listMessages(quoteId);
      setMessages(msgs);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }, [quoteId]);

  useEffect(() => {
    loadMessages();
    db.listQuotePayments(quoteId)
      .then(setPaidInfos)
      .catch(() => setPaidInfos([]));
  }, [loadMessages, quoteId]);

  if (!company || !quote) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const currentQuote = quote;
  const phone = currentQuote.customerPhone ?? '';
  const status = effectiveStatus(currentQuote);
  const waLink = phone ? buildWaLink(phone, buildQuoteMessage(currentQuote, company)) : '';
  const shareEnabled = planHasFeature(company.plan, 'shareLinks');
  const shareUrl =
    typeof window !== 'undefined' && currentQuote.shareToken
      ? `${window.location.origin}/o/${currentQuote.shareToken}`
      : '';

  async function changeStatus(next: QuoteStatus) {
    if (next === status) return;
    setChangingStatus(true);
    try {
      await db.updateQuoteStatus(currentQuote.id, next);
      refresh();
      toast.success(`Status atualizado para "${QUOTE_STATUSES.find((s) => s.value === next)?.label}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar.');
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleSend(channel: 'whatsapp' | 'copiado') {
    try {
      await db.createMessage({ quoteId: currentQuote.id, body: `[${channel === 'whatsapp' ? 'Enviado via WhatsApp' : 'Mensagem copiada'}]`, channel });
      await loadMessages();
    } catch {
      // não bloqueia a ação principal
    }
  }

  async function createFollowUp(e: React.FormEvent) {
    e.preventDefault();
    setCreatingFollowUp(true);
    try {
      await db.createFollowUp({
        quoteId: currentQuote.id,
        scheduledFor: newFollowUpDate ? new Date(`${newFollowUpDate}T12:00:00`).toISOString() : suggestedFollowUpDate(),
      });
      refresh();
      toast.success('Follow-up agendado! 🔔');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível agendar.');
    } finally {
      setCreatingFollowUp(false);
    }
  }

  async function completeFollowUp(id: string) {
    await db.completeFollowUp(id);
    refresh();
    toast.success('Follow-up concluído! 🎯');
  }

  async function shareQuote() {
    const text = `Orçamento ${quoteNumberLabel(currentQuote.number)} — ${currentQuote.customerName}\nTotal: ${formatCurrency(currentQuote.total)}\n\nCriado no OrçaAI`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Orçamento ${quoteNumberLabel(currentQuote.number)}`, text });
        return;
      } catch {
        // usuário cancelou — segue para fallback
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Orçamento copiado para compartilhar!');
    } catch {
      toast.error('Não foi possível compartilhar.');
    }
  }

  async function deleteQuote() {
    try {
      await db.deleteQuote(currentQuote.id);
      refresh();
      toast.success('Orçamento excluído.');
      router.push('/app/orcamentos');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/orcamentos" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600">
          <ArrowLeft className="size-4" /> Orçamentos
        </Link>
        <PageHeader
          className="mt-1"
          title={
            <span className="flex flex-wrap items-center gap-3">
              {quoteNumberLabel(quote.number)}
              <QuoteStatusBadge quote={quote} />
              {isQuoteExpired(quote) && status !== 'expirado' && <Badge variant="secondary">Expirado</Badge>}
            </span>
          }
          description={`${quote.customerName} · criado em ${formatDateFull(quote.createdAt)}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Select value={quote.status} onValueChange={(v) => changeStatus(v as QuoteStatus)} disabled={changingStatus}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="secondary" onClick={() => downloadQuotePdf(company, quote)}>
                <Download className="size-4" /> Baixar PDF
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Itens do orçamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-ink-100 rounded-xl border border-ink-100">
                {(quote.items ?? []).map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">{it.name}</p>
                      <p className="text-xs text-ink-400">
                        {it.quantity} × {it.unit} · {formatCurrency(it.price)}
                        {it.observations ? ` · ${it.observations}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-ink-900">{formatCurrency(it.quantity * it.price)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discount > 0 && (
                  <div className="flex justify-between text-ink-500">
                    <span>Desconto</span>
                    <span className="text-rose-600">- {formatCurrency(quote.discount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-ink-100 pt-2">
                  <span className="font-semibold text-ink-900">Total</span>
                  <span className="text-xl font-bold text-ink-950">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {quote.sourceMessage && (
            <Card>
              <CardHeader>
                <CardTitle>Mensagem original do cliente</CardTitle>
                <CardDescription className="mt-1">Pedido que deu origem a este orçamento.</CardDescription>
              </CardHeader>
              <CardContent>
                <blockquote className="rounded-xl border-l-4 border-emerald-400 bg-emerald-50/50 p-4 text-sm italic text-ink-600">
                  “{quote.sourceMessage}”
                </blockquote>
              </CardContent>
            </Card>
          )}

          {(quote.notes || quote.terms) && (
            <Card>
              <CardHeader>
                <CardTitle>Observações e termos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {quote.notes && (
                  <p className="whitespace-pre-line text-ink-600">
                    <span className="font-medium text-ink-900">Observações: </span>
                    {quote.notes}
                  </p>
                )}
                <p className="whitespace-pre-line text-xs text-ink-400">{quote.terms}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Mensagem para o cliente</CardTitle>
              <CardDescription className="mt-1">Copie ou envie direto pelo WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent>
              <MessageCard
                quote={quote}
                company={company}
                phone={phone}
                onSend={handleSend}
              />
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium text-ink-900">{quote.customerName}</p>
              {quote.customerPhone && <p className="text-ink-500">📱 {quote.customerPhone}</p>}
              {quote.customerEmail && <p className="text-ink-500">✉️ {quote.customerEmail}</p>}
              {!quote.customerPhone && !quote.customerEmail && (
                <p className="text-xs text-ink-400">Sem contato cadastrado.</p>
              )}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-ink-400">Validade:</span>
                <Select value={String(quote.validityDays)} onValueChange={async (v) => {
                  const days = Number(v);
                  await db.updateQuote(quote.id, { validityDays: days });
                  refresh();
                  toast.success('Validade atualizada.');
                }}>
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALIDITY_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={String(v.value)}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-ink-400">· até {formatDateFull(quote.validUntil)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Ações rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {waLink ? (
                  <Button asChild variant="whatsapp" className="w-full" onClick={() => void handleSend('whatsapp')}>
                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="size-4" /> WhatsApp
                    </a>
                  </Button>
                ) : (
                  <Button variant="whatsapp" className="w-full" onClick={() => toast.error('Adicione o telefone do cliente.')}>
                    <MessageCircle className="size-4" /> WhatsApp
                  </Button>
                )}
                <Button variant="secondary" className="w-full" onClick={shareQuote}>
                  <Share2 className="size-4" /> Compartilhar
                </Button>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" /> Excluir orçamento
              </Button>
            </CardContent>
          </Card>

          {/* Link público (plano Pro+) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-4 text-brand-600" /> Link público do orçamento
              </CardTitle>
              <CardDescription className="mt-1">
                Compartilhe este link: o cliente vê o orçamento, baixa o PDF e pode{' '}
                <strong>aprovar e pagar online</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shareEnabled ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-ink-500">{shareUrl || '…'}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={async () => {
                        if (!shareUrl) return;
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                          toast.success('Link copiado! Envie para o cliente.');
                        } catch {
                          toast.error('Não foi possível copiar.');
                        }
                      }}
                    >
                      {copiedLink ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                      {copiedLink ? 'Copiado!' : 'Copiar link'}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      disabled={!shareUrl}
                      onClick={() => {
                        if (shareUrl) window.open(shareUrl, '_blank', 'noopener');
                      }}
                    >
                      <Eye className="size-4" /> Visualizar
                    </Button>
                    <Button
                      size="sm"
                      variant="whatsapp"
                      className="flex-1"
                      disabled={!shareUrl || !phone}
                      onClick={() => {
                        if (!shareUrl || !phone) return;
                        const msg = `Olá, ${currentQuote.customerName}! Veja seu orçamento ${quoteNumberLabel(currentQuote.number)} por aqui: ${shareUrl}`;
                        const link = buildWaLink(phone, msg);
                        if (link) window.open(link, '_blank', 'noopener');
                      }}
                    >
                      <MessageCircle className="size-4" /> Enviar no WhatsApp
                    </Button>
                  </div>
                  <p className="text-[11px] text-ink-400">
                    Ao abrir o link, o orçamento é marcado como "Visualizado" automaticamente.
                    {' '}
                    {company.plan === 'free'
                      ? 'Plano grátis: taxa de 2% do OrçaAI por pagamento recebido.'
                      : `Plano ${company.plan === 'pro' ? 'Pro' : 'Business'}: pagamento 100% para você, sem taxas.`}
                  </p>
                  {paidInfos.filter((pp) => pp.status === 'aprovado').length > 0 && (
                    <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="size-3.5" /> Pagamento recebido pelo link!
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-4 py-5 text-center">
                  <Lock className="size-5 text-ink-300" />
                  <p className="text-xs text-ink-400">
                    Disponível no plano <strong>Pro</strong> e <strong>Business</strong>.
                  </p>
                  <Link href="/app/planos">
                    <Button size="sm" variant="outline">Fazer upgrade</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Follow-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="size-4 text-amber-500" /> Follow-ups
              </CardTitle>
              <CardDescription className="mt-1">
                {pendingFollowUps.length > 0
                  ? 'Follow-up recomendado em 2 dias após o envio.'
                  : 'Agende lembretes para não perder a venda.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={createFollowUp} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label htmlFor="fu-date" className="text-xs font-medium text-ink-600">Lembrete para</label>
                  <Input
                    id="fu-date"
                    type="date"
                    value={newFollowUpDate}
                    onChange={(e) => setNewFollowUpDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button type="submit" size="sm" loading={creatingFollowUp} disabled={creatingFollowUp}>
                  <Plus className="size-4" /> Agendar
                </Button>
              </form>

              {quoteFollowUps.length === 0 ? (
                <p className="rounded-xl bg-ink-50 p-4 text-center text-xs text-ink-400">
                  Nenhum follow-up agendado ainda.
                  <br />
                  {status === 'enviado' ? 'O envio deste orçamento gerou um lembrete automático.' : 'Ao enviar, um follow-up é criado automaticamente.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {quoteFollowUps.map((f) => {
                    const overdue = f.status === 'pendente' && new Date(f.scheduledFor) < new Date();
                    return (
                      <li
                        key={f.id}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5',
                          f.status === 'concluido' ? 'border-ink-100 bg-ink-50/60 opacity-70' : overdue ? 'border-rose-200 bg-rose-50/60' : 'border-ink-100 bg-white',
                        )}
                      >
                        <div className="min-w-0">
                          <p className={cn('flex items-center gap-1.5 text-sm font-medium', f.status === 'concluido' ? 'text-ink-400 line-through' : 'text-ink-900')}>
                            <CalendarClock className="size-3.5 text-amber-500" />
                            {formatDateFull(f.scheduledFor)}
                          </p>
                          {f.notes && <p className="truncate text-xs text-ink-400">{f.notes}</p>}
                          {overdue && <Badge variant="danger" className="mt-1">Atrasado</Badge>}
                        </div>
                        {f.status === 'pendente' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => completeFollowUp(f.id)}
                            title="Marcar como concluído"
                          >
                            <CheckCircle2 className="size-4 text-emerald-600" /> Concluir
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Histórico de mensagens */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de mensagens</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMsgs ? (
                <Skeleton className="h-20 w-full" />
              ) : messages.length === 0 ? (
                <p className="rounded-xl bg-ink-50 p-4 text-center text-xs text-ink-400">
                  Nenhuma mensagem enviada/copiada ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {messages.slice(0, 6).map((m) => (
                    <li key={m.id} className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs">
                      <p className="font-medium text-ink-700">
                        {m.channel === 'whatsapp' ? 'Enviado pelo WhatsApp' : m.channel === 'copiado' ? 'Copiada pelo usuário' : 'Enviado por e-mail'}
                      </p>
                      <p className="mt-0.5 text-ink-400">{formatDateTime(m.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {quote.customerId && (
            <Link
              href={`/app/clientes/${quote.customerId}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <User className="size-4" /> Ver perfil do cliente
            </Link>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Excluir orçamento ${quoteNumberLabel(quote.number)}?`}
        description="Esta ação não pode ser desfeita. Os follow-ups e mensagens vinculados também serão removidos."
        confirmLabel="Excluir"
        destructive
        onConfirm={deleteQuote}
      />
    </div>
  );
}
