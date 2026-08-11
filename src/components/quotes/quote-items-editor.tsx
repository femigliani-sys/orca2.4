'use client';

import { Plus, Trash2, Package } from 'lucide-react';
import type { QuoteItem, Service } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, generateId } from '@/lib/utils';
import { UNITS } from '@/lib/constants';

interface Props {
  items: QuoteItem[];
  services: Service[];
  onChange: (items: QuoteItem[]) => void;
}

/** Editor de itens do orçamento (múltiplos serviços). */
export function QuoteItemsEditor({ items, services, onChange }: Props) {
  function updateItem(id: string, patch: Partial<QuoteItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function addItem() {
    onChange([...items, { id: generateId(), name: '', quantity: 1, unit: 'serviço', price: 0 }]);
  }

  function removeItem(id: string) {
    onChange(items.length > 1 ? items.filter((it) => it.id !== id) : items);
  }

  function pickService(itemId: string, serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    updateItem(itemId, {
      serviceId: svc.id,
      name: svc.name,
      price: svc.price,
      unit: svc.unit,
      description: svc.description,
      observations: svc.observations,
    });
  }

  return (
    <div className="space-y-2">
      <div className="hidden items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-400 sm:grid sm:grid-cols-[1fr_150px_80px_90px_110px_40px]">
        <span>Serviço</span>
        <span>Catálogo</span>
        <span className="text-center">Qtd</span>
        <span>Unidade</span>
        <span className="text-right">Preço</span>
        <span />
      </div>

      {items.map((it) => (
        <div
          key={it.id}
          className="grid gap-2 rounded-xl border border-ink-200/70 bg-white p-3 shadow-sm sm:grid-cols-[1fr_150px_80px_90px_110px_40px] sm:items-center"
        >
          <div className="space-y-1">
            <Input
              value={it.name}
              onChange={(e) => updateItem(it.id, { name: e.target.value })}
              placeholder="Nome do serviço"
              className="border-transparent bg-ink-50/60 focus:bg-white"
            />
            {it.observations && <p className="px-1 text-[11px] text-amber-600">{it.observations}</p>}
          </div>
          <Select value={it.serviceId ?? ''} onValueChange={(v) => pickService(it.id, v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Usar catálogo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" disabled>
                <span className="inline-flex items-center gap-1.5">
                  <Package className="size-3.5" /> Escolha um serviço
                </span>
              </SelectItem>
              {services
                .filter((s) => s.active)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {formatCurrency(s.price)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            inputMode="decimal"
            min={0.01}
            step="any"
            value={it.quantity}
            onChange={(e) => updateItem(it.id, { quantity: Math.max(0.01, Number(e.target.value) || 0.01) })}
            className="h-9 text-center"
            aria-label="Quantidade"
          />
          <Select value={it.unit} onValueChange={(v) => updateItem(it.id, { unit: v })}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-400">R$</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={it.price}
              onChange={(e) => updateItem(it.id, { price: Math.max(0, Number(e.target.value) || 0) })}
              className="h-9 pl-7 text-right"
              aria-label="Preço"
            />
          </div>
          <div className="flex items-center justify-between sm:justify-end">
            <span className="text-sm font-semibold text-ink-900 sm:hidden">
              {formatCurrency(it.quantity * it.price)}
            </span>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => removeItem(it.id)}
              className="text-ink-300 hover:bg-rose-50 hover:text-rose-500"
              aria-label="Remover item"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={addItem} className="mt-1">
        <Plus className="size-4" /> Adicionar serviço
      </Button>

      {items.length === 0 && (
        <p className="text-sm text-ink-400">Adicione pelo menos um serviço ou use a IA ao lado.</p>
      )}
    </div>
  );
}
