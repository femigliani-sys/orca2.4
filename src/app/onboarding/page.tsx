'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Building2, Briefcase, Wrench, Plus, Trash2, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Logo } from '@/components/ui/logo';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/db';
import { BUSINESS_TYPES, SERVICE_CATEGORIES, UNITS } from '@/lib/constants';
import { cn, generateId, parseCurrencyInput } from '@/lib/utils';

interface DraftService {
  id: string;
  name: string;
  price: string;
  unit: string;
  description: string;
}

const STEPS = [
  { label: 'Empresa', icon: Building2 },
  { label: 'Negócio', icon: Briefcase },
  { label: 'Serviços', icon: Wrench },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [services, setServices] = useState<DraftService[]>([
    { id: generateId(), name: '', price: '', unit: 'serviço', description: '' },
  ]);
  const [saving, setSaving] = useState(false);

  // Guarda e pré-preencimento
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await db.getCurrentUser();
        if (!mounted) return;
        if (!user) {
          router.replace('/auth/login');
          return;
        }
        if (user.onboarded) {
          router.replace('/app');
          return;
        }
        const company = await db.getCompany();
        if (mounted) {
          setCompanyName(company?.name ?? user.companyName ?? '');
          setBusinessType(company?.businessType ?? user.businessType ?? '');
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  function addService() {
    setServices((s) => [...s, { id: generateId(), name: '', price: '', unit: 'serviço', description: '' }]);
  }

  function updateService(id: string, patch: Partial<DraftService>) {
    setServices((s) => s.map((sv) => (sv.id === id ? { ...sv, ...patch } : sv)));
  }

  function removeService(id: string) {
    setServices((s) => (s.length > 1 ? s.filter((sv) => sv.id !== id) : s));
  }

  async function finish(skipServices = false) {
    if (!companyName.trim()) {
      toast.error('Informe o nome da sua empresa.');
      return;
    }
    if (!businessType) {
      toast.error('Escolha o tipo de negócio.');
      return;
    }
    setSaving(true);
    try {
      await db.completeOnboarding({
        name: companyName.trim(),
        businessType,
      });
      if (!skipServices) {
        const valid = services.filter((s) => s.name.trim() && s.price.trim());
        for (const s of valid) {
          await db.createService({
            name: s.name.trim(),
            description: s.description.trim(),
            price: parseCurrencyInput(s.price),
            unit: s.unit,
            category: inferCategory(s.name),
            active: true,
          });
        }
        if (valid.length > 0) {
          toast.success(`${valid.length} serviço(s) cadastrado(s) com sucesso!`);
        }
      }
      toast.success('Tudo pronto! 🎉 Vamos criar seu primeiro orçamento.');
      router.replace('/app');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo deu errado.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="w-80 space-y-4">
          <Logo />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="border-b border-ink-200/70 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Logo />
          <span className="text-sm font-medium text-ink-400">
            Etapa {step + 1} de {STEPS.length}
          </span>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-4 pb-4">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex-1">
              <div
                className={cn(
                  'h-1 rounded-full transition-colors',
                  i <= step ? 'bg-brand-600' : 'bg-ink-100',
                )}
              />
              <p className={cn('mt-1.5 text-xs font-medium', i <= step ? 'text-brand-700' : 'text-ink-400')}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        {/* Etapa 1 — empresa */}
        {step === 0 && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-bold tracking-tight text-ink-950">Qual é o nome da sua empresa?</h1>
            <p className="mt-2 text-ink-500">É o nome que aparece no PDF e na mensagem para o cliente.</p>
            <div className="mt-6">
              <Label htmlFor="company">Nome da empresa</Label>
              <Input
                id="company"
                className="mt-1.5 h-12 text-base"
                placeholder="Ex.: Maria Silva Pinturas"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Etapa 2 — tipo de negócio */}
        {step === 1 && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-bold tracking-tight text-ink-950">Qual serviço você oferece?</h1>
            <p className="mt-2 text-ink-500">
              Isso ajuda a personalizar seu painel e as sugestões da IA.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt}
                  onClick={() => setBusinessType(bt)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                    businessType === bt
                      ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50/40',
                  )}
                >
                  <span className={cn('size-4 shrink-0 rounded-full border-2', businessType === bt ? 'border-brand-600 bg-brand-600' : 'border-ink-300')}>
                    {businessType === bt && <Check className="size-3 text-white" />}
                  </span>
                  {bt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Etapa 3 — primeiros serviços */}
        {step === 2 && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-bold tracking-tight text-ink-950">Cadastre seus primeiros serviços</h1>
            <p className="mt-2 text-ink-500">
              A IA usa esses serviços e preços para montar seus orçamentos — ela nunca inventa valores.
            </p>

            <div className="mt-6 space-y-4">
              {services.map((s, idx) => (
                <div key={s.id} className="rounded-xl border border-ink-200/70 bg-white p-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                      Serviço {idx + 1}
                    </span>
                    <button
                      onClick={() => removeService(s.id)}
                      className="rounded-md p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500"
                      aria-label="Remover serviço"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor={`name-${s.id}`}>Nome</Label>
                      <Input
                        id={`name-${s.id}`}
                        className="mt-1"
                        placeholder="Ex.: Pintura de sala (m²)"
                        value={s.name}
                        onChange={(e) => updateService(s.id, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`price-${s.id}`}>Preço (R$)</Label>
                      <Input
                        id={`price-${s.id}`}
                        className="mt-1"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={s.price}
                        onChange={(e) => updateService(s.id, { price: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Unidade</Label>
                      <Select value={s.unit} onValueChange={(v) => updateService(s.id, { unit: v })}>
                        <SelectTrigger className="mt-1">
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
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`desc-${s.id}`}>Descrição (opcional)</Label>
                      <Textarea
                        id={`desc-${s.id}`}
                        className="mt-1"
                        rows={2}
                        placeholder="Ex.: Pintura completa com tinta acrílica premium, 2 demãos."
                        value={s.description}
                        onChange={(e) => updateService(s.id, { description: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="secondary" className="mt-4" onClick={addService}>
              <Plus className="size-4" /> Adicionar outro serviço
            </Button>
          </div>
        )}

        {/* Navegação */}
        <div className="mt-10 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
          <div className="flex gap-2">
            {step === STEPS.length - 1 ? (
              <>
                <Button variant="secondary" onClick={() => finish(true)} disabled={saving} loading={saving}>
                  Pular
                </Button>
                <Button onClick={() => finish(false)} loading={saving} disabled={saving}>
                  <Sparkles className="size-4" /> Concluir
                </Button>
              </>
            ) : (
              <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === 0 ? !companyName.trim() : !businessType}>
                Continuar <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (/instala/i.test(n)) return 'Instalação';
  if (/manuten/i.test(n)) return 'Manutenção';
  if (/reparo|conserto|troca|corre/i.test(n)) return 'Reparo';
  if (/pint/i.test(n)) return 'Pintura';
  if (/limp/i.test(n)) return 'Limpeza';
  if (/mont/i.test(n)) return 'Montagem';
  if (/projeto|planta/i.test(n)) return 'Projeto';
  if (/consult/i.test(n)) return 'Consultoria';
  if (/material|peça|peca/i.test(n)) return 'Material';
  if (/deslocamento|frete/i.test(n)) return 'Deslocamento';
  return 'Outros';
}
