'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, Search, Users } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { QuoteStatusBadge } from '@/components/ui/status-badge';
import { db } from '@/lib/db';
import { formatCurrency, formatDate, maskPhone } from '@/lib/utils';
import { effectiveStatus } from '@/lib/quote-utils';

type Filter = 'todos' | 'com-orcamento' | 'sem-orcamento' | 'aprovados';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'com-orcamento', label: 'Com orçamento' },
  { value: 'sem-orcamento', label: 'Sem orçamento' },
  { value: 'aprovados', label: 'Com aprovação' },
];

export default function CustomersPage() {
  const { customers, quotes, loading, refresh } = useData();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; total: number; approved: number; last: string | null }>();
    for (const q of quotes) {
      if (!q.customerId) continue;
      const s = map.get(q.customerId) ?? { count: 0, total: 0, approved: 0, last: null };
      s.count += 1;
      s.total += q.total;
      const st = effectiveStatus(q);
      if (st === 'aprovado') s.approved += 1;
      if (!s.last || q.createdAt > s.last) s.last = q.createdAt;
      map.set(q.customerId, s);
    }
    return map;
  }, [quotes]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const s = stats.get(c.id);
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone ?? '').includes(search) ||
        (c.email ?? '').toLowerCase().includes(search.toLowerCase());
      let matchesFilter = true;
      if (filter === 'com-orcamento') matchesFilter = (s?.count ?? 0) > 0;
      if (filter === 'sem-orcamento') matchesFilter = (s?.count ?? 0) === 0;
      if (filter === 'aprovados') matchesFilter = (s?.approved ?? 0) > 0;
      return matchesSearch && matchesFilter;
    });
  }, [customers, stats, search, filter]);

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    setSaving(true);
    try {
      await db.createCustomer({
        name: form.name.trim(),
        phone: form.phone || undefined,
        email: form.email || undefined,
        notes: form.notes || undefined,
      });
      refresh();
      setDialogOpen(false);
      setForm({ name: '', phone: '', email: '', notes: '' });
      toast.success('Cliente cadastrado!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Seu histórico completo de clientes e orçamentos."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Novo cliente
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Buscar por nome, telefone ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente ainda"
          description="Cadastre clientes ou crie orçamentos — os clientes são salvos automaticamente."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" /> Cadastrar cliente
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado" description="Ajuste a busca ou o filtro." />
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Orçamentos</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead>Último contato</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const s = stats.get(c.id);
                  const lastQuote = s?.last ? quotes.find((q) => q.customerId === c.id && q.createdAt === s.last) : undefined;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/app/clientes/${c.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                          {c.name}
                        </Link>
                        {c.email && <p className="text-xs text-ink-400">{c.email}</p>}
                      </TableCell>
                      <TableCell className="text-ink-500">{c.phone ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={s?.count ? 'default' : 'secondary'}>{s?.count ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-ink-900">{formatCurrency(s?.total ?? 0)}</TableCell>
                      <TableCell className="text-ink-500">{s?.last ? formatDate(s.last) : '—'}</TableCell>
                      <TableCell>{lastQuote ? <QuoteStatusBadge quote={lastQuote} /> : <Badge variant="secondary">Novo</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((c) => {
              const s = stats.get(c.id);
              const lastQuote = s?.last ? quotes.find((q) => q.customerId === c.id && q.createdAt === s.last) : undefined;
              return (
                <Link key={c.id} href={`/app/clientes/${c.id}`}>
                  <Card className="transition-shadow hover:shadow-card-hover">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-ink-900">{c.name}</p>
                        {lastQuote ? <QuoteStatusBadge quote={lastQuote} /> : <Badge variant="secondary">Novo</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-400">{c.phone ?? c.email ?? 'sem contato'}</p>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-ink-500">{s?.count ?? 0} orçamento(s)</span>
                        <span className="font-semibold text-ink-900">{formatCurrency(s?.total ?? 0)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>Preencha as informações de contato.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createCustomer} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nome *</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: João Silva" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Telefone / WhatsApp</Label>
                <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(11) 99999-9999" inputMode="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">E-mail</Label>
                <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="joao@email.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-notes">Observações</Label>
              <Textarea id="c-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex.: Prefere contato à tarde." />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Cadastrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
