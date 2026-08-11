'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Send, Save, Gem } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { QuoteItemsEditor } from '@/components/quotes/quote-items-editor';
import { AiPanel } from '@/components/quotes/ai-panel';
import { MessageCard } from '@/components/quotes/message-card';
import { db, isDemo } from '@/lib/db';
import { computeTotals } from '@/lib/quote-utils';
import { formatCurrency, generateId, friendlyError, maskPhone } from '@/lib/utils';
import { FREE_MONTHLY_QUOTES, VALIDITY_OPTIONS } from '@/lib/constants';
import { planHasFeature } from '@/lib/plans';
import type { QuoteItem, QuoteStatus } from '@/lib/types';

export default function NewQuotePage() {
  const { company, services, customers, quotes, refresh } = useData();
  const router = useRouter();

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([{ id: generateId(), name: '', quantity: 1, unit: 'serviço', price: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [validityDays, setValidityDays] = useState<number>(7);
  const [validityTouched, setValidityTouched] = useState(false);

  // Sincroniza com a validade padrão da empresa assim que carregar
  useEffect(() => {
    if (!validityTouched && company?.settings.quoteValidityDays) {
      setValidityDays(company.settings.quoteValidityDays);
    }
  }, [company, validityTouched]);
  const [notes, setNotes] = useState('');
  const [sourceMessage, setSourceMessage] = useState('');
  const [saving, setSaving] = useState<QuoteStatus | null>(null);

  const { subtotal, total } = useMemo(() => computeTotals(items, discount), [items, discount]);

  // Limite do plano gratuito
  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const quotesThisMonth = quotes.filter(
    (q) => new Date(q.createdAt).getTime() >= monthStart.getTime() && q.status !== 'rascunho',
  ).length;
  const atLimit = company?.plan === 'free' && quotesThisMonth >= FREE_MONTHLY_QUOTES;
  const aiEnabled = company ? planHasFeature(company.plan, 'ai') : false;

  function pickCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find((cu) => cu.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone ?? '');
      setCustomerEmail(c.email ?? '');
    }
  }

  function handleAiResult(aiItems: QuoteItem[], _missing: string[], _summary: string, source: string) {
    setItems(aiItems.length > 0 ? aiItems : items);
    setSourceMessage(source);
    toast.success('Sugestão da IA aplicada! Revise os itens antes de enviar.');
  }

  async function create(status: QuoteStatus) {
    if (atLimit) {
      toast.error('Você atingiu o limite do plano grátis. Faça upgrade para continuar.');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    const validItems = items.filter((it) => it.name.trim() && it.price >= 0);
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um serviço com nome.');
      return;
    }

    setSaving(status);
    try {
      // Cria/atualiza o cliente
      let finalCustomerId: string | null = customerId || null;
      if (!customerId && customerName.trim()) {
        const created = await db.createCustomer({
          name: customerName.trim(),
          phone: customerPhone || undefined,
          email: customerEmail || undefined,
        });
        finalCustomerId = created.id;
      } else if (customerId) {
        await db.updateCustomer(customerId, {
          phone: customerPhone || undefined,
          email: customerEmail || undefined,
        });
      }

      const quote = await db.createQuote({
        customerId: finalCustomerId,
        customerName: customerName.trim(),
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        status,
        items: validItems,
        discount,
        validityDays,
        notes: notes.trim() || undefined,
        sourceMessage: sourceMessage || undefined,
      });

      refresh();
      toast.success(
        status === 'enviado'
          ? `Orçamento ${'#' + String(quote.number).padStart(4, '0')} criado e enviado! 📤 Follow-up em 2 dias.`
          : `Rascunho ${'#' + String(quote.number).padStart(4, '0')} salvo.`,
      );
      router.push(`/app/orcamentos/${quote.id}`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(null);
    }
  }

  if (!company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const pseudoQuote = {
    items,
    total,
    validityDays,
    customerName: customerName.trim() || 'cliente',
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/orcamentos" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600">
          <ArrowLeft className="size-4" /> Orçamentos
        </Link>
        <PageHeader
          title="Novo orçamento"
          description="Preencha os dados, use a IA ou monte manualmente. Tudo em menos de 2 minutos."
          className="mt-1"
        />
      </div>

      {atLimit && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <p className="text-sm text-amber-800">
              <strong>Limite do plano grátis atingido:</strong> {quotesThisMonth}/{FREE_MONTHLY_QUOTES} orçamentos este
              mês. No plano Pro você cria sem limites e usa a IA.
            </p>
            <Link href="/app/planos">
              <Button size="sm">
                <Gem className="size-4" /> Fazer upgrade
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Coluna esquerda — dados */}
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
              <CardDescription className="mt-1">Quem vai receber este orçamento?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cliente cadastrado</Label>
                <Select value={customerId} onValueChange={pickCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="— Novo cliente —" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="c-name">Nome *</Label>
                  <Input
                    id="c-name"
                    placeholder="Ex.: João Silva"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-phone">Telefone / WhatsApp</Label>
                  <Input
                    id="c-phone"
                    placeholder="(11) 99999-9999"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(maskPhone(e.target.value))}
                    inputMode="tel"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">E-mail</Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="joao@email.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Serviços</CardTitle>
              <CardDescription className="mt-1">Adicione um ou mais serviços ao orçamento.</CardDescription>
            </CardHeader>
            <CardContent>
              <QuoteItemsEditor items={items} services={services} onChange={setItems} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Desconto e validade</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="discount">Desconto (R$)</Label>
                <Input
                  id="discount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Validade do orçamento</Label>
                <Select
                  value={String(validityDays)}
                  onValueChange={(v) => {
                    setValidityDays(Number(v));
                    setValidityTouched(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALIDITY_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={String(v.value)}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Observações (opcional)</Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    placeholder="Ex.: Valor não inclui materiais elétricos adicionais."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Totais */}
          <Card className="border-ink-200 bg-ink-950 text-white">
            <CardContent className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-8 text-ink-300">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between gap-8 text-ink-300">
                      <span>Desconto</span>
                      <span>- {formatCurrency(discount)}</span>
                    </div>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-xs uppercase tracking-wide text-ink-400">Total</p>
                  <p className="text-3xl font-bold tracking-tight">{formatCurrency(total)}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  className="flex-1 border-ink-700 bg-ink-800 text-white hover:bg-ink-700"
                  onClick={() => create('rascunho')}
                  loading={saving === 'rascunho'}
                  disabled={atLimit || saving !== null}
                >
                  <Save className="size-4" /> Salvar rascunho
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => create('enviado')}
                  loading={saving === 'enviado'}
                  disabled={atLimit || saving !== null}
                >
                  <Send className="size-4" /> Criar e enviar
                </Button>
              </div>
              <p className="mt-3 text-center text-xs text-ink-400">
                Ao enviar, um follow-up é agendado automaticamente para 2 dias.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Coluna direita — IA + mensagem */}
        <div className="space-y-6 lg:col-span-2">
          <AiPanel
            services={services}
            enabled={aiEnabled}
            onResult={handleAiResult}
          />
          {!aiEnabled && (
            <Card className="border-brand-200 bg-brand-50/50">
              <CardContent className="p-4">
                <p className="text-sm text-brand-800">
                  <strong>Dica:</strong> no plano Pro, cole a mensagem do cliente aqui e a IA preenche os itens com os
                  preços do seu catálogo.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Mensagem para o cliente</CardTitle>
              <CardDescription className="mt-1">
                Gere a mensagem e envie pelo WhatsApp com um clique.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.some((it) => it.name.trim()) ? (
                <MessageCard quote={pseudoQuote} company={company} phone={customerPhone} />
              ) : (
                <p className="rounded-xl bg-ink-50 p-4 text-sm text-ink-400">
                  A mensagem será gerada automaticamente quando houver itens no orçamento.
                </p>
              )}
            </CardContent>
          </Card>

          {isDemo() && company.plan === 'free' && (
            <p className="rounded-xl border border-ink-200 bg-white p-4 text-xs text-ink-400">
              💡 <strong>Modo demonstração:</strong> vá em <strong>Planos</strong> no menu para ativar o Pro e liberar a
              IA.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
