'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Users,
  KanbanSquare,
  BellRing,
  Wrench,
  Settings,
  Gem,
  Menu,
  X,
  LogOut,
  Sparkles,
  ChevronRight,
  LifeBuoy,
} from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { db, isDemo } from '@/lib/db';
import { getPlan } from '@/lib/plans';
import { FREE_MONTHLY_QUOTES } from '@/lib/constants';
import { NotificationBell } from './notification-bell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, X as CloseIcon } from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/orcamentos', label: 'Orçamentos', icon: FileText },
  { href: '/app/orcamentos/novo', label: 'Novo orçamento', icon: PlusCircle, highlight: true },
  { href: '/app/clientes', label: 'Clientes', icon: Users },
  { href: '/app/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { href: '/app/follow-ups', label: 'Follow-ups', icon: BellRing, badge: true },
  { href: '/app/servicos', label: 'Meus serviços', icon: Wrench },
  { href: '/app/suporte', label: 'Suporte', icon: LifeBuoy },
  { href: '/app/configuracoes', label: 'Configurações', icon: Settings },
  { href: '/app/planos', label: 'Planos', icon: Gem },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/app') return pathname === '/app';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-200/70 bg-white lg:flex">
        <SidebarContent isActive={isActive} />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-4 py-4">
              <Logo />
              <Button variant="ghost" size="iconSm" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
                <X className="size-5" />
              </Button>
            </div>
            <SidebarContent isActive={isActive} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Topbar mobile */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-ink-200/70 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="iconSm" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </Button>
          <Logo iconOnly />
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <UserMenu compact />
        </div>
      </header>

      {/* Conteúdo */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-ink-200/70 bg-white/80 px-6 backdrop-blur lg:flex">
          <div className="flex items-center gap-2">
            {isDemo() && (
              <Badge variant="outline" className="gap-1">
                <Sparkles className="size-3 text-brand-500" />
                Modo demonstração — dados salvos neste navegador
              </Badge>
            )}
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <DataErrorBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ isActive, onNavigate }: { isActive: (href: string) => boolean; onNavigate?: () => void }) {  const { user, company, followUps, quotes } = useData();
  const router = useRouter();
  const pendingFollowUps = followUps.filter((f) => f.status === 'pendente').length;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const quotesThisMonth = quotes.filter(
    (q) => new Date(q.createdAt).getTime() >= monthStart.getTime() && q.status !== 'rascunho',
  ).length;
  const remaining = Math.max(0, FREE_MONTHLY_QUOTES - quotesThisMonth);
  const plan = getPlan((company?.plan as 'free' | 'pro' | 'business') ?? 'free');

  return (
    <>
      <div className="flex h-14 items-center border-b border-ink-100 px-4">
        <Link href="/app" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                item.highlight && !active && 'bg-brand-50 text-brand-700 hover:bg-brand-100',
                item.highlight && active && 'bg-brand-600 text-white hover:bg-brand-700',
                !item.highlight && active && 'bg-ink-100 text-ink-900',
                !item.highlight && !active && 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              <Icon className={cn('size-5', item.highlight && !active && 'text-brand-600', item.highlight && active && 'text-white')} />
              <span className="flex-1">{item.label}</span>
              {item.badge && pendingFollowUps > 0 && (
                <span className="grid min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {pendingFollowUps}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {company && (
        <div className="mx-3 mb-3 rounded-lg border border-ink-100 bg-ink-50/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink-600">Plano {plan.name}</span>
            {company.plan === 'free' && <span className="text-ink-400">{quotesThisMonth}/{FREE_MONTHLY_QUOTES} orçamentos</span>}
          </div>
          {company.plan === 'free' ? (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${Math.min(100, (quotesThisMonth / FREE_MONTHLY_QUOTES) * 100)}%` }}
                />
              </div>
              <button
                onClick={() => router.push('/app/planos')}
                className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {remaining > 0 ? `Faltam ${remaining} orçamentos grátis` : 'Sem orçamentos grátis restantes'} <ChevronRight className="size-3.5" />
              </button>
            </>
          ) : (
            <p className="mt-1 text-xs text-ink-400">Recursos completos liberados 🎉</p>
          )}
        </div>
      )}

      <div className="border-t border-ink-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{user?.name}</p>
            <p className="truncate text-xs text-ink-400">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              void db.signOut();
              router.replace('/');
            }}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, company, refresh } = useData();
  const router = useRouter();
  const plan = getPlan((company?.plan as 'free' | 'pro' | 'business') ?? 'free');

  async function logout() {
    await db.signOut();
    refresh();
    router.replace('/');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-ink-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            compact && 'p-1',
          )}
          aria-label="Menu do usuário"
        >
          <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {initials(user?.name)}
          </span>
          {!compact && (
            <span className="hidden text-left sm:block">
              <span className="block max-w-[140px] truncate text-sm font-medium text-ink-900">{user?.name}</span>
              <span className="block text-xs text-ink-400">Plano {plan.name}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block text-sm font-semibold text-ink-900">{user?.name}</span>
          <span className="mt-0.5 block text-xs font-normal text-ink-400">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/app/planos')}>
          <Gem className="size-4" /> Planos e cobrança
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/app/configuracoes')}>
          <Settings className="size-4" /> Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-rose-600 focus:text-rose-600">
          <LogOut className="size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

/** Banner amarelo com o erro do Supabase — em vez de tela branca, o usuário vê o que falhou. */
function DataErrorBanner() {
  const { dataError } = useData();
  const [hidden, setHidden] = useState(false);
  if (!dataError || hidden) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">Não foi possível carregar os dados do banco</p>
          <p className="mt-1 break-words text-xs text-amber-800">{dataError}</p>
          <p className="mt-2 text-xs text-amber-700">
            Verifique se a migração SQL (<code className="rounded bg-amber-100 px-1">0001_init.sql</code>) foi executada
            no SQL Editor do Supabase e se as chaves estão corretas (sem espaços). Caso o problema continue, abra o
            console do navegador (F12) e envie o erro.
          </p>
        </div>
        <button onClick={() => setHidden(true)} className="rounded p-1 text-amber-500 hover:bg-amber-100" aria-label="Fechar aviso">
          <CloseIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
