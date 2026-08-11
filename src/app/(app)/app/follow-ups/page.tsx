'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BellRing, CheckCircle2, MessageCircle, Plus, CalendarClock, RotateCcw } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuoteStatusBadge } from '@/components/ui/status-badge';
import { db } from '@/lib/db';
import { buildQuoteMessage } from '@/lib/ai/templates';
import { buildWaLink } from '@/lib/whatsapp';
import { cn, formatDateFull, formatCurrency, quoteNumberLabel, timeAgo } from '@/lib/utils';
import { suggestedFollowUpDate } from '@/lib/quote-utils';
import type { FollowUp } from '@/lib/types';

export default function FollowUpsPage() {
  const { company, quotes, followUps, loading, refresh } = useData();
  const [tab, setTab] = useState('pendentes');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quoteId, setQuoteId] = useState('');
  const [date, setDate] = useState(suggestedFollowUpDate().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const pending = useMemo(
    () => followUps.filter((f) => f.status === 'pendente').sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    [followUps],
  );
  const completed = useMemo(
    () => followUps.filter((f) => f.status === 'concluido').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    [followUps],
  );

  const quoteOptions = useMemo(
    () => quotes.filter((q) => ['enviado', 'visualizado', 'negociacao'].includes(q.status)),
    [quotes],
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!quoteId) {
      toast.error('Escolha o orçamento.');
      return;
    }
    setSaving(true);
    try {
      await db.createFollowUp({
        quoteId,
        scheduledFor: date ? new Date(`${date}T12:00:00`).toISOString() : suggestedFollowUpDate(),
        notes: notes || undefined,
      });
      refresh();
      setDialogOpen(false);
      setQuoteId('');
      setNotes('');
      toast.success('Follow-up agendado! 🔔');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível agendar.');
    } finally {
      setSaving(false);
    }
  }

  async function complete(f: FollowUp) {
    await db.completeFollowUp(f.id);
    refresh();
    toast.success('Follow-up concluído! 🎯');
  }

  async function reopen(f: FollowUp) {
    // Reabrir: cria novamente como pendente
    await db.createFollowUp({
      quoteId: f.quoteId,
      scheduledFor: f.scheduledFor,
      notes: f.notes,
    });
    refresh();
    toast.success('Follow-up reaberto.');
  }

  function sendWhatsApp(f: FollowUp) {
    const quote = quotes.find((q) => q.id === f.quoteId);
    if (!quote || !company) {
      toast.error('Orçamento não encontrado.');
      return;
    }
    const phone = quote.customerPhone ?? '';
    if (!phone) {
      toast.error('Este orçamento não tem telefone do cliente.');
      return;
    }
    const message = buildQuoteMessage(quote, company);
    const link = buildWaLink(phone, message);
    if (!link) {
      toast.error('Telefone inválido.');
      return;
    }
    window.open(link, '_blank', 'noopener');
  }

  function FollowUpCard({ f }: { f: FollowUp }) {
    const quote = quotes.find((q) => q.id === f.quoteId);
    const overdue = f.status === 'pendente' && new Date(f.scheduledFor) < new Date();
    return (
      <Card className={cn('transition-shadow hover:shadow-card-hover', overdue && 'border-rose-200 bg-rose-50/40')}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink-900">{f.customerName}</p>
                {quote && <QuoteStatusBadge quote={quote} />}
              </div>
              <p className="mt-1 text-xs text-ink-400">
                Orçamento{' '}
                <Link href={`/app/orcamentos/${f.quoteId}`} className="font-mono font-medium text-brand-600 hover:text-brand-700">
                  {quoteNumberLabel(f.quoteNumber)}
                </Link>
                {' '}· {formatCurrency(f.value)}
              </p>
              {f.notes && <p className="mt-1 text-xs text-ink-500">{f.notes}</p>}
            </div>
            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', overdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700')}>
              <CalendarClock className="size-3.5" />
              {formatDateFull(f.scheduledFor)}
            </span>
          </div>

          {overdue && <Badge variant="danger" className="mt-2">Atrasado — envie hoje!</Badge>}

          <div className="mt-3 flex flex-wrap gap-2">
            {f.status === 'pendente' ? (
              <>
                <Button size="sm" variant="success" onClick={() => complete(f)}>
                  <CheckCircle2 className="size-4" /> Marcar como concluído
                </Button>
                <Button size="sm" variant="whatsapp" onClick={() => sendWhatsApp(f)}>
                  <MessageCircle className="size-4" /> Enviar mensagem
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => reopen(f)}>
                  <RotateCcw className="size-4" /> Reabrir
                </Button>
                <Link href={`/app/orcamentos/${f.quoteId}`}>
                  <Button size="sm" variant="ghost">Ver orçamento</Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading || !company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Lembretes para não deixar nenhuma venda esfriar."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Novo follow-up
          </Button>
        }
      />

      {pending.length > 0 && (
        <Card className="border-brand-200 bg-brand-50/60">
          <CardContent className="flex items-center gap-3 p-4">
            <BellRing className="size-5 shrink-0 text-brand-600" />
            <p className="text-sm text-brand-800">
              Você tem <strong>{pending.length} follow-up(s) pendente(s)</strong>
              {pending.some((f) => new Date(f.scheduledFor) < new Date()) && ' — alguns estão atrasados!'}
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes {pending.length > 0 && `(${pending.length})`}
          </TabsTrigger>
          <TabsTrigger value="concluidos">
            Concluídos {completed.length > 0 && `(${completed.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          {pending.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="Nenhum follow-up pendente"
              description="Ao enviar um orçamento, um follow-up é agendado automaticamente para 2 dias depois."
              action={
                <Link href="/app/orcamentos/novo">
                  <Button><Plus className="size-4" /> Criar orçamento</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3">
              {pending.map((f) => (
                <FollowUpCard key={f.id} f={f} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="concluidos" className="mt-4">
          {completed.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nada concluído ainda" description="Os follow-ups que você marcar como concluídos aparecem aqui." />
          ) : (
            <div className="grid gap-3">
              {completed.map((f) => (
                <FollowUpCard key={f.id} f={f} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo follow-up</DialogTitle>
            <DialogDescription>Escolha o orçamento e a data do lembrete.</DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Orçamento *</Label>
              <Select value={quoteId} onValueChange={setQuoteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o orçamento…" />
                </SelectTrigger>
                <SelectContent>
                  {quoteOptions.length === 0 && <SelectItem value="__none__" disabled>Nenhum orçamento enviado em aberto</SelectItem>}
                  {quoteOptions.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {quoteNumberLabel(q.number)} · {q.customerName} · {formatCurrency(q.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-date">Data do follow-up *</Label>
              <Input id="fu-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-notes">Observações</Label>
              <Input id="fu-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Perguntar se aprovou o orçamento." />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Agendar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
