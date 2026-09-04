'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, FileText, Palette, Upload, X, MessageCircle, CheckCircle2, XCircle, Send, CreditCard, Link2, Unplug, Receipt } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db, isDemo } from '@/lib/db';
import { getSiteUrl } from '@/lib/site-url';
import { BUSINESS_TYPES, VALIDITY_OPTIONS } from '@/lib/constants';
import { DEFAULT_SETTINGS, DEFAULT_QUOTE_MESSAGE } from '@/lib/defaults';
import { buildWaLink } from '@/lib/whatsapp';
import type { CompanySettings } from '@/lib/types';

export default function SettingsPage() {
  const { company, loading, refresh } = useData();
  const [tab, setTab] = useState('empresa');
  const [saving, setSaving] = useState<null | 'empresa' | 'orcamentos' | 'aparencia'>(null);

  // Formulário empresa
  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [cnpj, setCnpj] = useState('');

  // Formulário orçamentos
  const [validity, setValidity] = useState<number>(7);
  const [defaultMessage, setDefaultMessage] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');
  const [terms, setTerms] = useState('');

  // Formulário aparência
  const [settings, setSettings] = useState<CompanySettings>({ ...DEFAULT_SETTINGS });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

  // WhatsApp Business API
  const [waStatus, setWaStatus] = useState<{ configured: boolean; webhookConfigured: boolean; phoneNumberId: string | null; webhookUrl: string; demo: boolean; guide: string } | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  // Pagamentos (conta MP do vendedor)
  const [payAccount, setPayAccount] = useState<Awaited<ReturnType<typeof db.getPaymentAccount>>>(null);
  const [quotePayments, setQuotePayments] = useState<Awaited<ReturnType<typeof db.listQuotePayments>>>([]);
  const [connectingPay, setConnectingPay] = useState(false);
  const [payInfo, setPayInfo] = useState<string | null>(null);

  const loadPayments = async () => {
    try {
      const [acc, list] = await Promise.all([db.getPaymentAccount(), db.listQuotePayments()]);
      setPayAccount(acc);
      setQuotePayments(list);
    } catch { /* silencioso */ }
  };


  useEffect(() => {
    fetch('/api/whatsapp/status')
      .then((r) => r.json())
      .then((j) => setWaStatus(j))
      .catch(() => setWaStatus(null));
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setBusinessType(company.businessType);
    setPhone(company.phone ?? '');
    setWhatsapp(company.whatsapp ?? '');
    setEmail(company.email ?? '');
    setAddress(company.address ?? '');
    setCnpj(company.cnpj ?? '');
    setValidity(company.settings.quoteValidityDays || 7);
    setDefaultMessage(company.settings.defaultMessage);
    setDefaultNotes(company.settings.defaultNotes);
    setTerms(company.settings.terms);
    setSettings({ ...DEFAULT_SETTINGS, ...company.settings });
    setLogoUrl(company.logoUrl);
  }, [company]);

  if (loading || !company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  async function saveEmpresa() {
    if (!name.trim()) {
      toast.error('O nome da empresa é obrigatório.');
      return;
    }
    setSaving('empresa');
    try {
      await db.updateCompany({
        name: name.trim(),
        businessType,
        phone: phone || undefined,
        whatsapp: whatsapp || undefined,
        email: email || undefined,
        address: address || undefined,
        cnpj: cnpj || undefined,
      });
      refresh();
      toast.success('Dados da empresa salvos!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(null);
    }
  }

  async function saveOrcamentos() {
    setSaving('orcamentos');
    try {
      await db.updateCompany({
        settings: {
          ...settings,
          quoteValidityDays: validity,
          defaultMessage,
          defaultNotes,
          terms,
        },
      });
      refresh();
      toast.success('Preferências de orçamento salvas!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(null);
    }
  }

  async function saveAparencia() {
    setSaving('aparencia');
    try {
      await db.updateCompany({ settings, logoUrl });
      refresh();
      toast.success('Aparência salva!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(null);
    }
  }

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await db.uploadLogo(file);
      setLogoUrl(url);
      await db.updateCompany({ logoUrl: url });
      refresh();
      toast.success('Logo atualizada!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.');
    } finally {
      setUploadingLogo(false);
    }
  }

  function toggleSetting(key: keyof CompanySettings) {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  }

  const inputCls = 'mt-1.5';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Dados da empresa, padrões de orçamento e aparência do PDF."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="empresa"><Building2 className="mr-1.5 size-4" /> Empresa</TabsTrigger>
          <TabsTrigger value="orcamentos"><FileText className="mr-1.5 size-4" /> Orçamentos</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageCircle className="mr-1.5 size-4" /> WhatsApp</TabsTrigger>
          <TabsTrigger value="pagamentos"><CreditCard className="mr-1.5 size-4" /> Pagamentos</TabsTrigger>
          <TabsTrigger value="aparencia"><Palette className="mr-1.5 size-4" /> Aparência</TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------- Empresa */}
        <TabsContent value="empresa">
          <Card>
            <CardHeader>
              <CardTitle>Dados da empresa</CardTitle>
              <CardDescription className="mt-1">Esses dados aparecem no PDF e na mensagem enviada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-name">Nome da empresa *</Label>
                  <Input id="s-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de negócio</Label>
                  <Select value={businessType} onValueChange={setBusinessType}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((bt) => (
                        <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-phone">Telefone</Label>
                  <Input id="s-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 4002-8922" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-wa">WhatsApp</Label>
                  <Input id="s-wa" className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-email">E-mail</Label>
                  <Input id="s-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com.br" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-cnpj">CNPJ</Label>
                  <Input id="s-cnpj" className={inputCls} value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-address">Endereço</Label>
                <Input id="s-address" className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade/UF" />
              </div>
              <div className="flex justify-end">
                <Button onClick={saveEmpresa} loading={saving === 'empresa'}>Salvar empresa</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------- Orçamentos */}
        <TabsContent value="orcamentos">
          <Card>
            <CardHeader>
              <CardTitle>Padrões de orçamento</CardTitle>
              <CardDescription className="mt-1">Aplicados automaticamente em todo novo orçamento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Validade padrão</Label>
                  <Select value={String(validity)} onValueChange={(v) => setValidity(Number(v))}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VALIDITY_OPTIONS.map((v) => (
                        <SelectItem key={v.value} value={String(v.value)}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-msg">Mensagem padrão para o cliente</Label>
                <Textarea
                  id="s-msg"
                  className={inputCls}
                  rows={6}
                  value={defaultMessage}
                  onChange={(e) => setDefaultMessage(e.target.value)}
                  placeholder={DEFAULT_QUOTE_MESSAGE}
                />
                <p className="text-xs text-ink-400">
                  Placeholders disponíveis: {'{{customer}}'} {'{{items}}'} {'{{total}}'} {'{{validity}}'} {'{{company}}'}. Deixe
                  vazio para usar o modelo padrão.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-notes">Observações padrão</Label>
                <Textarea id="s-notes" className={inputCls} rows={2} value={defaultNotes} onChange={(e) => setDefaultNotes(e.target.value)} placeholder="Ex.: Valor não inclui materiais adicionais." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-terms">Termos padrão</Label>
                <Textarea id="s-terms" className={inputCls} rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button onClick={saveOrcamentos} loading={saving === 'orcamentos'}>Salvar padrões</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------- WhatsApp */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="size-4 text-emerald-600" /> WhatsApp Business API
              </CardTitle>
              <CardDescription className="mt-1">
                Envie orçamentos direto pela API oficial da Meta (sem depender do link wa.me).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {waStatus === null ? (
                <p className="text-sm text-ink-400">Verificando configuração…</p>
              ) : (
                <>
                  {/* Status */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={`flex items-start gap-3 rounded-xl border p-4 ${waStatus.configured ? 'border-emerald-200 bg-emerald-50' : 'border-ink-200 bg-ink-50/60'}`}>
                      {waStatus.configured ? (
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 size-5 shrink-0 text-ink-400" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {waStatus.configured ? 'API configurada ✓' : 'API não configurada'}
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          {waStatus.configured
                            ? `Número ativo: ${waStatus.phoneNumberId}`
                            : waStatus.demo
                              ? 'Você está no modo demonstração — as mensagens usam o link wa.me.'
                              : 'As mensagens usam o link wa.me enquanto a API não estiver configurada.'}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-start gap-3 rounded-xl border p-4 ${waStatus.webhookConfigured ? 'border-emerald-200 bg-emerald-50' : 'border-ink-200 bg-ink-50/60'}`}>
                      {waStatus.webhookConfigured ? (
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 size-5 shrink-0 text-ink-400" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900">
                          {waStatus.webhookConfigured ? 'Webhook configurado ✓' : 'Webhook pendente'}
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          {waStatus.webhookUrl && (
                            <>
                              URL para o painel da Meta:
                              <code className="mt-1 block break-all rounded bg-white px-1.5 py-0.5 text-[11px] text-ink-600">
                                {waStatus.webhookUrl}
                              </code>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Guia */}
                  <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Como configurar</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-600">
                      <li>Crie um app em <strong>Meta for Developers</strong> e conecte seu WhatsApp Business.</li>
                      <li>Copie o <strong>Token de Acesso</strong> e o <strong>ID do Número</strong>.</li>
                      <li>Adicione as variáveis <code className="rounded bg-white px-1">WHATSAPP_ACCESS_TOKEN</code> e <code className="rounded bg-white px-1">WHATSAPP_PHONE_NUMBER_ID</code> no ambiente (Vercel → Settings → Environment Variables) e faça redeploy.</li>
                      <li>No painel da Meta, configure o webhook com a URL acima e o <code className="rounded bg-white px-1">WHATSAPP_WEBHOOK_VERIFY_TOKEN</code> de sua escolha.</li>
                    </ol>
                  </div>

                  {/* Teste */}
                  <div className="rounded-xl border border-ink-100 p-4">
                    <p className="text-sm font-semibold text-ink-900">Enviar mensagem de teste</p>
                    <p className="mt-1 text-xs text-ink-500">
                      Envia "Olá! Este é um teste do OrçaAI ✓" para o número abaixo.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Input
                        placeholder="(11) 99999-9999"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className="sm:max-w-xs"
                        inputMode="tel"
                      />
                      <Button
                        variant="whatsapp"
                        onClick={async () => {
                          if (!testPhone.trim()) {
                            toast.error('Informe o número para o teste.');
                            return;
                          }
                          setTesting(true);
                          try {
                            const res = await fetch('/api/whatsapp/send', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                to: testPhone,
                                body: 'Olá! Este é um teste do OrçaAI ✓',
                              }),
                            });
                            const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                            if (!res.ok || !json.ok) {
                              toast.info(json.error || 'API não configurada — enviando pelo link wa.me.');
                              const link = buildWaLink(testPhone, 'Olá! Este é um teste do OrçaAI ✓');
                              if (link) window.open(link, '_blank', 'noopener');
                            } else {
                              toast.success('Mensagem enviada pelo WhatsApp Business API ✓');
                            }
                          } catch {
                            toast.error('Falha ao enviar.');
                          } finally {
                            setTesting(false);
                          }
                        }}
                        loading={testing}
                      >
                        {!testing && <Send className="size-4" />}
                        {testing ? 'Enviando…' : 'Enviar teste'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------- Pagamentos pelo link */}
        <TabsContent value="pagamentos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-4 text-emerald-600" /> Receber pagamentos pelo link do orçamento
              </CardTitle>
              <CardDescription className="mt-1">
                Quando o cliente abre o link público do orçamento, ele pode <strong>"Aprovar e pagar"</strong>.
                O pagamento é processado pelo Mercado Pago e creditado na SUA conta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`flex items-start gap-3 rounded-xl border p-4 ${payAccount?.status === 'ativo' ? 'border-emerald-200 bg-emerald-50' : 'border-ink-200 bg-ink-50/60'}`}>
                  {payAccount?.status === 'ativo' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-ink-400" />}
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{payAccount?.status === 'ativo' ? 'Conta conectada ✓' : 'Conta não conectada'}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {payAccount?.status === 'ativo'
                        ? `Mercado Pago (${payAccount.mpUserId ?? 'simulada'}) — pronto para receber.`
                        : 'Conecte sua conta do Mercado Pago para receber os pagamentos dos seus orçamentos.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-ink-100 bg-ink-50/60 p-4">
                  <Receipt className="mt-0.5 size-5 shrink-0 text-ink-400" />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Taxa do seu plano</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {company.plan === 'free'
                        ? 'Plano Grátis: o OrçaAI recebe 2% de cada pagamento (você recebe 98% na hora).'
                        : `Plano ${company.plan === 'pro' ? 'Pro' : 'Business'}: 100% do valor vai para você — sem taxas.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {payAccount?.status === 'ativo' ? (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await db.disconnectPaymentAccount();
                      setPayAccount(null);
                      toast.success('Conta de pagamento desconectada.');
                    }}
                  >
                    <Unplug className="size-4" /> Desconectar conta
                  </Button>
                ) : (
                  <Button
                    variant="whatsapp"
                    loading={connectingPay}
                    onClick={async () => {
                      setConnectingPay(true);
                      try {
                        if (isDemo()) {
                          // Simulação: conecta conta simulada
                          const acc = await db.connectPaymentAccount({ provider: 'simulado', mpUserId: 'simulado' });
                          setPayAccount(acc);
                          toast.success('Conta conectada (simulação) — teste o fluxo de pagamento pelo link!');
                        } else {
                          const res = await fetch('/api/mp/account');
                          const json = (await res.json().catch(() => ({}))) as {
                            connectUrl?: string | null;
                            warning?: string | null;
                            error?: string;
                          };
                          if (json.error) throw new Error(json.error);
                          if (json.connectUrl) {
                            window.location.href = json.connectUrl; // OAuth do Mercado Pago
                          } else {
                            toast.warning(json.warning || 'Configure a aplicação marketplace (MERCADO_PAGO_MARKETPLACE_CLIENT_ID).');
                          }
                        }
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Falha ao conectar.');
                      } finally {
                        setConnectingPay(false);
                      }
                    }}
                  >
                    <Link2 className="size-4" /> Conectar conta Mercado Pago
                  </Button>
                )}
              </div>
              {payInfo && <p className="text-xs text-amber-600">{payInfo}</p>}

              {!isDemo() && (
                <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4 text-xs text-ink-500">
                  <p className="font-semibold text-ink-700">Para receber pagamentos reais:</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                    <li>Sua aplicação no Mercado Pago precisa ser <strong>Marketplace</strong> (aceita pagamentos por outros vendedores).</li>
                    <li>Adicione no ambiente: <code className="rounded bg-white px-1">MERCADO_PAGO_MARKETPLACE_CLIENT_ID</code> e <code className="rounded bg-white px-1">MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET</code> (secret do app). Não use o MERCADO_PAGO_ACCESS_TOKEN como secret.</li>
                    <li>No painel do MP, cadastre a URL de redirect (sem barra dupla): <code className="rounded bg-white px-1">{`${getSiteUrl()}/api/mp/callback`}</code>.</li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recebidos pelo link */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Pagamentos recebidos pelo link</CardTitle>
              <CardDescription className="mt-1">Cobranças dos seus orçamentos aprovados e pagos.</CardDescription>
            </CardHeader>
            <CardContent>
              {quotePayments.length === 0 ? (
                <p className="rounded-xl bg-ink-50 p-4 text-center text-xs text-ink-400">
                  Nenhum pagamento ainda. Compartilhe o link de um orçamento (aba do orçamento) e peça para o cliente pagar.
                </p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {quotePayments.slice(0, 10).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-ink-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.amount)}</p>
                        <p className="text-xs text-ink-400">{new Date(p.createdAt).toLocaleDateString('pt-BR')} · {p.payerName ?? 'cliente'}</p>
                      </div>
                      <div className="text-right text-xs text-ink-500">
                        <p>{p.platformFee > 0 ? 'Taxa OrçaAI: ' + new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.platformFee) : 'Sem taxa'}</p>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.status === 'aprovado' ? 'bg-emerald-50 text-emerald-700' : p.status === 'pendente' ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-500'}`}>
                          {p.status === 'aprovado' ? 'Aprovado' : p.status === 'pendente' ? 'Pendente' : p.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------- Aparência */}
        <TabsContent value="aparencia">
          <Card>
            <CardHeader>
              <CardTitle>Logotipo</CardTitle>
              <CardDescription className="mt-1">Usado no PDF e nos orçamentos compartilhados.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {logoUrl ? (
                <div className="relative">
                  <img src={logoUrl} alt="Logo da empresa" className="h-16 w-16 rounded-xl border border-ink-200 object-contain bg-white p-1" />
                  <button
                    onClick={async () => {
                      setLogoUrl(undefined);
                      await db.updateCompany({ logoUrl: undefined });
                      refresh();
                    }}
                    className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-ink-900 text-white hover:bg-ink-700"
                    aria-label="Remover logo"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-ink-300 text-ink-300">
                  <Upload className="size-6" />
                </div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0])} disabled={uploadingLogo} />
                <Button asChild variant="secondary">
                  <span>{uploadingLogo ? 'Enviando…' : logoUrl ? 'Trocar logo' : 'Enviar logo'}</span>
                </Button>
              </label>
              <p className="text-xs text-ink-400">PNG ou JPG, até 2MB.</p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Informações exibidas no PDF</CardTitle>
              <CardDescription className="mt-1">Escolha o que aparece no orçamento em PDF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ToggleRow label="Mostrar logo" checked={settings.showLogo} onChange={() => toggleSetting('showLogo')} />
                <ToggleRow label="Mostrar telefone" checked={settings.showPhone} onChange={() => toggleSetting('showPhone')} />
                <ToggleRow label="Mostrar e-mail" checked={settings.showEmail} onChange={() => toggleSetting('showEmail')} />
                <ToggleRow label="Mostrar endereço" checked={settings.showAddress} onChange={() => toggleSetting('showAddress')} />
                <ToggleRow label="Mostrar CNPJ" checked={settings.showCnpj} onChange={() => toggleSetting('showCnpj')} />
                <ToggleRow label="Campo de assinatura" checked={settings.showSignature} onChange={() => toggleSetting('showSignature')} />
              </div>
              {settings.showSignature && (
                <div className="space-y-1.5">
                  <Label htmlFor="s-sig">Nome para assinatura</Label>
                  <Input id="s-sig" className={inputCls} value={settings.signatureName} onChange={(e) => setSettings({ ...settings, signatureName: e.target.value })} placeholder="Ex.: Maria Silva" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="s-color">Cor de destaque do PDF</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="s-color"
                    value={/^#[0-9a-fA-F]{6}$/.test(settings.accentColor) ? settings.accentColor : '#4f46e5'}
                    onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-ink-200 bg-white p-1"
                  />
                  <Input value={settings.accentColor} onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })} className="w-32" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveAparencia} loading={saving === 'aparencia'}>Salvar aparência</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-4 py-3">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
