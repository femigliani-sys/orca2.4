'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Search, Wrench, Copy, Pencil, Trash2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/db';
import { formatCurrency, generateId, parseCurrencyInput } from '@/lib/utils';
import { SERVICE_CATEGORIES, UNITS } from '@/lib/constants';
import type { Service } from '@/lib/types';

interface ServiceForm {
  id?: string;
  name: string;
  description: string;
  price: string;
  unit: string;
  category: string;
  durationMinutes: string;
  observations: string;
}

const EMPTY_FORM: ServiceForm = {
  name: '',
  description: '',
  price: '',
  unit: 'serviço',
  category: 'Outros',
  durationMinutes: '',
  observations: '',
};

export default function ServicesPage() {
  const { services, loading, refresh } = useData();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [services, search]);

  function openNew() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(s: Service) {
    setForm({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price > 0 ? String(s.price) : '',
      unit: s.unit,
      category: s.category,
      durationMinutes: s.durationMinutes ? String(s.durationMinutes) : '',
      observations: s.observations ?? '',
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Informe o nome do serviço.');
      return;
    }
    const price = parseCurrencyInput(form.price);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        unit: form.unit,
        category: form.category,
        durationMinutes: form.durationMinutes ? Math.max(1, Number(form.durationMinutes)) : null,
        observations: form.observations.trim() || undefined,
        active: true,
      };
      if (form.id) {
        await db.updateService(form.id, payload);
        toast.success('Serviço atualizado!');
      } else {
        await db.createService(payload);
        toast.success('Serviço cadastrado!');
      }
      refresh();
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(s: Service) {
    await db.toggleService(s.id, !s.active);
    refresh();
  }

  async function duplicate(s: Service) {
    await db.duplicateService(s.id);
    refresh();
    toast.success('Serviço duplicado.');
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await db.deleteService(toDelete.id);
      refresh();
      toast.success('Serviço excluído.');
      setToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    } finally {
      setDeleting(false);
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
        title="Meus serviços"
        description="Estes são os serviços que a IA usa para montar seus orçamentos."
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" /> Novo serviço
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <Input placeholder="Buscar por nome, categoria…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nenhum serviço cadastrado"
          description="Cadastre seus serviços com preço e unidade. A IA só sugere o que está no seu catálogo — sem preços inventados."
          action={
            <Button onClick={openNew}>
              <Plus className="size-4" /> Cadastrar primeiro serviço
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado" description="Tente outro termo de busca." />
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className={!s.active ? 'opacity-60' : ''}>
                    <TableCell>
                      <p className="font-medium text-ink-900">{s.name}</p>
                      {s.description && <p className="max-w-xs truncate text-xs text-ink-400">{s.description}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.category}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-ink-900">{formatCurrency(s.price)}</TableCell>
                    <TableCell className="text-ink-500">{s.unit}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={s.active} onCheckedChange={() => toggle(s)} aria-label={`Ativar/desativar ${s.name}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="iconSm" onClick={() => duplicate(s)} title="Duplicar">
                          <Copy className="size-4" />
                        </Button>
                        <Button variant="ghost" size="iconSm" onClick={() => openEdit(s)} title="Editar">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="iconSm" className="text-ink-300 hover:bg-rose-50 hover:text-rose-500" onClick={() => setToDelete(s)} title="Excluir">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((s) => (
              <Card key={s.id} className={!s.active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">{s.name}</p>
                      <p className="mt-0.5 text-xs text-ink-400">{s.category} · {s.unit}</p>
                    </div>
                    <p className="shrink-0 font-bold text-ink-950">{formatCurrency(s.price)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-ink-500">
                      <Switch checked={s.active} onCheckedChange={() => toggle(s)} /> Ativo
                    </label>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="iconSm" onClick={() => duplicate(s)}><Copy className="size-4" /></Button>
                      <Button variant="ghost" size="iconSm" onClick={() => openEdit(s)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="iconSm" className="text-ink-300 hover:text-rose-500" onClick={() => setToDelete(s)}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialog de serviço */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
            <DialogDescription>
              O preço e a unidade cadastrados são usados pela IA nas sugestões.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="svc-name">Nome *</Label>
              <Input id="svc-name" placeholder="Ex.: Instalação de ar-condicionado 12.000 BTUs" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-desc">Descrição</Label>
              <Textarea id="svc-desc" rows={2} placeholder="Ex.: Instalação padrão de aparelho split." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="svc-price">Preço (R$) *</Label>
                <Input id="svc-price" inputMode="decimal" placeholder="0,00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-dur">Duração estimada (min)</Label>
                <Input id="svc-dur" type="number" inputMode="numeric" min={1} placeholder="Ex.: 120" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-obs">Observações</Label>
              <Textarea id="svc-obs" rows={2} placeholder="Detalhes que devem aparecer no orçamento." value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} loading={saving}>Salvar serviço</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir serviço?"
        description={`"${toDelete?.name}" será removido do seu catálogo. Orçamentos já criados não são alterados.`}
        confirmLabel="Excluir"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
