'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, BellRing, CheckCheck, Clock, Gem, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn, timeAgo } from '@/lib/utils';
import type { Notification } from '@/lib/types';
import { db } from '@/lib/db';

function iconFor(type: Notification['type']) {
  if (type === 'followup') return <Clock className="size-4 text-amber-500" />;
  if (type === 'status') return <CheckCircle2 className="size-4 text-emerald-500" />;
  if (type === 'plan') return <Gem className="size-4 text-brand-500" />;
  return <AlertTriangle className="size-4 text-ink-400" />;
}

export function NotificationBell() {
  const { notifications, refresh } = useData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  async function markAll() {
    await db.markAllNotificationsRead();
    refresh();
  }

  async function openNotification(n: Notification) {
    if (!n.read) {
      await db.markNotificationRead(n.id);
      refresh();
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="iconSm" className="relative" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ''}`}>
          <Bell className="size-5 text-ink-500" />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-ink-900">Notificações</span>
          {unread > 0 && (
            <button onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              <CheckCheck className="size-3.5" /> Marcar todas
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-ink-400">Nenhuma notificação por aqui. 🎉</div>
          )}
          {notifications.slice(0, 15).map((n) => (
            <button
              key={n.id}
              onClick={() => openNotification(n)}
              className={cn(
                'flex w-full items-start gap-3 border-b border-ink-100 px-4 py-3 text-left transition-colors hover:bg-ink-50',
                !n.read && 'bg-brand-50/40',
              )}
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white shadow-sm">
                {iconFor(n.type)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink-900">{n.title}</span>
                  {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">{n.body}</span>
                <span className="mt-1 block text-[11px] text-ink-400">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="p-2">
          <DropdownMenuItem onSelect={() => { setOpen(false); router.push('/app/follow-ups'); }}>
            <BellRing className="size-4" /> Ver follow-ups
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
