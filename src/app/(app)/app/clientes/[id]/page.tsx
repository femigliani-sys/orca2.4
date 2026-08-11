'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Trash2, Phone, Mail, User as UserIcon, FileText, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuoteStatusBadge } from '@/components/ui/status-badge';
import { db } from '@/lib/db';
import { formatCurrency, formatDateFull, formatDateTime, maskPhone, quoteNumberLabel, timeAgo } from '@/lib/utils';
import { effectiveStatus } from '@/lib/quote-utils';

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { customers, quotes, followUps, loading, refresh } = useData();
  const customer = useMemo(() => customers.find((c) => c.id === id), [customers, id]);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const customerQuotes = useMemo(
    () => quotes.filter((q) => q.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [quotes, id],
  );
  const customerFollowUps = useMemo(
    () => followUps.filter((f) => f.customerName === customer?.name),
    [followUps, customer],
  );

  const stats = useMemo(() => {
    const total = customerQuotes.reduce((acc, q) => acc + q.total, 0);
    const approved = customerQuotes.filter((q) => effectiveStatus(q) === 'aprovado');
    const approvedValue = approved.reduce((acc, q) => acc + q.total, 0);
    const last = customerQuotes[0] ?? null;
    return { total, approvedCount: approved.length, approvedValue, last };
  }, [customerQuotes]);

  function openEdit() {
    if (!customer) return;
    setForm({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      notes: customer.notes ?? '',
    });
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setSaving(true);
    try {
      await db.updateCustomer(customer.id, {
        name: form.name.trim(),
        phone: form.phone || undefined,
        email: form.email || undefined,
        notes: form.notes || undefined,
      });
      refresh();
      setEditOpen(false);
      toast.success('Cliente atualizado!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer() {
    if (!customer) return;
    try {
      await db.deleteCustomer(customer.id);
      refresh();
      toast.success('Cliente excluído.');
      router.push('/app/clientes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  if (loading || !customer) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const currentQuote = stats.last;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/clientes" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600">
          <ArrowLeft className="size-4" /> Clientes
        </Link>
        <PageHeader
          className="mt-1"
          title={customer.name}
          description={`Cliente desde ${formatDateFull(customer.createdAt)}`}
          actions={
            <>
              <Button variant="secondary" onClick={openEdit}>
                <Pencil className="size-4" /> Editar
              </Button>
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" /> Excluir
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">Orçamentos</p>
              <p className="mt-1.5 text-2xl font-bold text-ink-950">{customerQuotes.length}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-lg bg-ink-100 text-ink-600"><FileText className="size-5" /></span>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">Valor total</p>
              <p className="mt-1.5 text-2xl font-bold text-ink-950">{formatCurrency(stats.total)}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><TrendingUp className="size-5" /></span>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">Aprovados</p>
              <p className="mt-1.5 text-2xl font-bold text-emerald-600">{stats.approvedCount}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-5" /></span>
          </div>
          <p className="mt-1 text-xs text-ink-400">{formatCurrency(stats.approvedValue)} aprovados</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">Último orçamento</p>
              <p className="mt-1.5 text-sm font-bold text-ink-950">
                {currentQuote ? quoteNumberLabel(currentQuote.number) : '—'}
              </p>
            </div>
            {currentQuote && <QuoteStatusBadge quote={currentQuote} />}
          </div>
          <p className="mt-1 text-xs text-ink-400">
            {currentQuote ? timeAgo(currentQuote.createdAt) : 'nenhum ainda'}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Informações */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-ink-700">
              <UserIcon className="size-4 text-ink-400" /> {customer.name}
            </div>
            {customer.phone && (
              <div className="flex items-center gap-2 text-ink-700">
                <Phone className="size-4 text-ink-400" /> {customer.phone}
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-ink-700">
                <Mail className="size-4 text-ink-400" /> {customer.email}
              </div>
            )}
            {customer.notes && (
              <p className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">{customer.notes}</p>
            )}
            {!customer.phone && !customer.email && (
              <p className="text-xs text-ink-400">Nenhum contato cadastrado.</p>
            )}
          </CardContent>
        </Card>

        {/* Histórico de orçamentos */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de orçamentos</CardTitle>
              <CardDescription className="mt-1">{customerQuotes.length} orçamento(s) no total</CardDescription>
            </CardHeader>
            <CardContent>
              {customerQuotes.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Sem orçamentos ainda"
                  description={`Crie um orçamento para ${customer.name} na tela "Novo orçamento".`}
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {customerQuotes.map((q) => (
                    <li key={q.id}>
                      <Link href={`/app/orcamentos/${q.id}`} className="flex items-center gap-4 py-3 transition-colors hover:bg-ink-50/60">
                        <span className="font-mono text-sm font-medium text-ink-700">{quoteNumberLabel(q.number)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900">{q.items?.[0]?.name ?? '—'}</p>
                          <p className="text-xs text-ink-400">{formatDateTime(q.createdAt)}</p>
                        </div>
                        <span className="hidden text-sm font-semibold text-ink-900 sm:block">{formatCurrency(q.total)}</span>
                        <QuoteStatusBadge quote={q} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Histórico de contatos / follow-ups */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Histórico de contatos</CardTitle>
            </CardHeader>
            <CardContent>
              {customerFollowUps.length === 0 && customerQuotes.length === 0 ? (
                <p className="rounded-xl bg-ink-50 p-4 text-center text-xs text-ink-400">Nenhum contato registrado ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {customerQuotes.map((q) => (
                    <li key={q.id} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-sm">
                      <span className="text-ink-700">
                        <strong>Orçamento criado</strong> · {quoteNumberLabel(q.number)}
                      </span>
                      <span className="text-xs text-ink-400">{formatDateTime(q.createdAt)}</span>
                    </li>
                  ))}
                  {customerFollowUps.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-sm">
                      <span className="text-ink-700">
                        <strong>Follow-up</strong> · {quoteNumberLabel(f.quoteNumber)}
                      </span>
                      <span className="text-xs text-ink-400">{formatDateTime(f.scheduledFor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="e-name">Nome *</Label>
              <Input id="e-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="e-phone">Telefone</Label>
                <Input id="e-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} inputMode="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-email">E-mail</Label>
                <Input id="e-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-notes">Observações</Label>
              <Textarea id="e-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir cliente?"
        description={`${customer.name} e o vínculo com seus orçamentos serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={deleteCustomer}
      />
    </div>
  );
}
