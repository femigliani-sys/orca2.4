'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  Mail,
  MessageCircle,
  BookOpen,
  Sparkles,
  Wrench,
  FileText,
  CreditCard,
  Users,
  BellRing,
  Link2,
  MessageSquareText,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
  Send,
} from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getSupportConfig,
  buildSupportMailto,
  buildSupportWhatsApp,
} from '@/lib/support';

// ---------------------------------------------------------------- Guias
const GUIDES = [
  {
    title: 'Criar um orçamento com IA em 3 passos',
    icon: Sparkles,
    tone: 'bg-brand-50 text-brand-600',
    body: [
      '1. Abra "+ Novo orçamento".',
      '2. Cole a mensagem do cliente no painel "Gerar com IA" e revise os itens sugeridos (a IA usa só os preços do seu catálogo — nunca inventa).',
      '3. Preencha o cliente, escolha "Criar e enviar" e compartilhe a mensagem pelo WhatsApp ou PDF.',
    ],
    link: { href: '/app/orcamentos/novo', label: 'Criar orçamento agora' },
  },
  {
    title: 'Cadastrar e organizar meus serviços',
    icon: Wrench,
    tone: 'bg-ink-100 text-ink-600',
    body: [
      'Em "Meus serviços" você cadastra nome, preço, unidade e categoria de cada serviço.',
      'Dica: quanto mais completos os nomes (ex.: "Instalação de ar-condicionado 12.000 BTUs"), melhor a IA identifica o pedido.',
      'Você pode duplicar, editar, pausar (ativo/desativar) e buscar serviços.',
    ],
    link: { href: '/app/servicos', label: 'Ver meus serviços' },
  },
  {
    title: 'Link público do orçamento (Pro e Business)',
    icon: Link2,
    tone: 'bg-sky-50 text-sky-600',
    body: [
      'Na página do orçamento (planos Pro/Business) existe o card "Link público do orçamento".',
      'Envie o link para o cliente: ele vê o orçamento, baixa o PDF e pode aprovar online.',
      'Quando ele abre o link, o status muda para "Visualizado"; ao aprovar, você recebe notificação.',
    ],
    link: { href: '/app/planos', label: 'Ver planos' },
  },
  {
    title: 'Enviar pelo WhatsApp (wa.me ou API oficial)',
    icon: MessageCircle,
    tone: 'bg-emerald-50 text-emerald-600',
    body: [
      'Sem configuração: o botão abre o WhatsApp com a mensagem pronta (link wa.me).',
      'Com a WhatsApp Business API configurada (Configurações → WhatsApp), o envio é direto pela API da Meta.',
      'Sempre que o cliente tiver telefone com DDD no cadastro, o botão funciona.',
    ],
    link: { href: '/app/configuracoes', label: 'Configurar WhatsApp' },
  },
  {
    title: 'Planos, pagamento e assinatura',
    icon: CreditCard,
    tone: 'bg-violet-50 text-violet-600',
    body: [
      'Em "Planos" você assina Pro (R$59/mês) ou Business (R$99/mês), vê o histórico de pagamentos e pode cancelar quando quiser.',
      'Sem a chave do Mercado Pago, o checkout roda em modo simulado para teste.',
      'Ao pagar, os recursos (IA, pipeline, link público etc.) são liberados automaticamente.',
    ],
    link: { href: '/app/planos', label: 'Ver planos e cobrança' },
  },
  {
    title: 'Follow-ups e lembretes de venda',
    icon: BellRing,
    tone: 'bg-amber-50 text-amber-600',
    body: [
      'Todo orçamento enviado gera um follow-up automático para 2 dias depois.',
      'Na página "Follow-ups" você vê os pendentes, atrasados e concluídos, e pode concluir ou enviar mensagem.',
      'Crie lembretes manuais quando quiser.',
    ],
    link: { href: '/app/follow-ups', label: 'Ver follow-ups' },
  },
];

// ---------------------------------------------------------------- FAQ
const FAQS = [
  {
    q: 'Depois do login aparece a tela em branco / o painel não carrega.',
    a: 'Isso indica que o banco (Supabase) ainda não respondeu. Abra o projeto no Supabase → SQL Editor e execute as migrações 0001 até 0005 (arquivos em supabase/migrations/). Depois recarregue com Ctrl+Shift+R. O app mostra um aviso amarelo com o erro exato quando algo falha — envie esse texto para o suporte se continuar.',
  },
  {
    q: 'A IA não encontra meus serviços / diz "preço não cadastrado".',
    a: 'A IA só sugere serviços ativos do seu catálogo (nunca inventa preços). Cadastre os serviços em "Meus serviços" com nome, preço e unidade. Para reconhecer modelos, inclua o número no nome (ex.: "12.000 BTUs").',
  },
  {
    q: 'O botão do WhatsApp não envia.',
    a: 'Confirme que o cliente tem telefone com DDD (ex.: (11) 99999-9999). Sem a API oficial configurada, o app abre o wa.me com a mensagem pronta. Se configurou a API da Meta e ainda falha, pode ser a janela de 24h do WhatsApp — o app volta para o wa.me automaticamente.',
  },
  {
    q: 'Como libero a IA, pipeline e link público?',
    a: 'Esses recursos são do plano Pro (R$59/mês) e Business (R$99/mês). Em "Planos", clique em "Assinar Pro/Business" e complete o pagamento (no modo demonstração o checkout é simulado).',
  },
  {
    q: 'Como configuro o Supabase e as chaves?',
    a: 'Crie o projeto no Supabase e execute as migrações em supabase/migrations/. Depois adicione na Vercel (Settings → Environment Variables): NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (valor cru, sem espaços) e faça redeploy. Sem chaves, o app roda em modo demonstração (dados no navegador).',
  },
  {
    q: 'Onde ficam os dados do modo demonstração?',
    a: 'No navegador (localStorage). Limpar os dados do site (ou usar outra janela anônima) cria uma conta nova do zero.',
  },
];

// ---------------------------------------------------------------- Página
export default function SupportPage() {
  const { company, loading } = useData();
  const support = getSupportConfig();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [topic, setTopic] = useState('Dúvida');

  if (loading || !company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const subject = `[Suporte OrçaAI] ${topic} — ${company.name}`;
  const body = `Nome: ${name || '—'}\nE-mail: ${email || '—'}\nEmpresa: ${company.name}\nPlano: ${company.plan}\n\n${message}`;
  const waLink = buildSupportWhatsApp(body);

  function openMail() {
    const mailto = buildSupportMailto(subject, body, support.email);
    window.location.href = mailto;
    toast.success('Abrindo seu aplicativo de e-mail…');
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Central de ajuda e suporte"
        description="Guias rápidos, respostas para os problemas mais comuns e contato direto com a gente."
      />

      {/* Contato direto */}
      <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-white">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
              <LifeBuoy className="size-6 text-brand-600" />
            </span>
            <div>
              <p className="text-base font-semibold text-ink-900">Precisa de ajuda?</p>
              <p className="mt-1 max-w-xl text-sm text-ink-500">
                Nossa equipe responde de segunda a sexta, das 9h às 18h. Escolha o canal — e-mail ou WhatsApp — ou
                use o formulário abaixo para mandar o contexto completo.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className="gap-1.5 py-1">
                  <Mail className="size-3.5 text-brand-600" /> {support.email}
                </Badge>
                {support.whatsapp && (
                  <Badge variant="outline" className="gap-1.5 py-1">
                    <MessageCircle className="size-3.5 text-emerald-600" /> {support.whatsapp}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {support.url && (
            <a href={support.url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">
                <ExternalLink className="size-4" /> Abrir central de suporte
              </Button>
            </a>
          )}
        </CardContent>
      </Card>

      {/* Guias */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
          <BookOpen className="size-5 text-brand-600" /> Guias rápidos
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <Card key={g.title} className="flex flex-col transition-shadow hover:shadow-card-hover">
              <CardContent className="flex flex-1 flex-col p-5">
                <span className={cn('grid size-10 place-items-center rounded-lg', g.tone)}>
                  <g.icon className="size-5" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">{g.title}</h3>
                <ul className="mt-2 flex-1 space-y-1.5">
                  {g.body.map((line, i) => (
                    <li key={i} className="text-xs leading-relaxed text-ink-500">
                      {line}
                    </li>
                  ))}
                </ul>
                <Link href={g.link.href} className="mt-4 inline-flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
                  {g.link.label} <ChevronRight className="size-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Formulário */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
          <MessageSquareText className="size-5 text-brand-600" /> Enviar uma mensagem
        </h2>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Fale com a equipe</CardTitle>
            <CardDescription className="mt-1">
              Preencha o contexto e envie pelo seu e-mail ou WhatsApp — a mensagem já chega formatada para nós.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Seu nome</Label>
                <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria Silva" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-email">Seu e-mail</Label>
                <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-topic">Assunto</Label>
                <Input id="s-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex.: Dúvida sobre IA" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-msg">Mensagem</Label>
              <Textarea
                id="s-msg"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva o que está acontecendo. Se puder, cole o texto de qualquer erro que apareceu na tela."
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={openMail}>
                <Mail className="size-4" /> Enviar por e-mail
              </Button>
              {waLink ? (
                <Button variant="whatsapp" onClick={() => { window.open(waLink, '_blank', 'noopener'); }}>
                  <MessageCircle className="size-4" /> Enviar pelo WhatsApp
                </Button>
              ) : (
                <Button variant="secondary" disabled title="Configure NEXT_PUBLIC_SUPPORT_WHATSAPP para ativar">
                  <MessageCircle className="size-4" /> WhatsApp (não configurado)
                </Button>
              )}
            </div>
            {!support.whatsapp && (
              <p className="text-xs text-ink-400">
                Configure <code className="rounded bg-ink-100 px-1">NEXT_PUBLIC_SUPPORT_WHATSAPP</code> nas variáveis de
                ambiente para habilitar o contato por WhatsApp.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-lg font-semibold text-ink-950">Perguntas frequentes</h2>
        <div className="mt-4 space-y-2.5">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl border border-ink-200/70 bg-white shadow-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="shrink-0 text-ink-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed text-ink-500">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Atalhos */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-emerald-500" />
            <p className="text-sm text-ink-600">
              <strong>Resolveu sua dúvida?</strong> Continue aproveitando o OrçaAI.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/app">
              <Button variant="secondary">Ir para o dashboard</Button>
            </Link>
            <Link href="/app/orcamentos/novo">
              <Button>+ Novo orçamento</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
