'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AppData } from '@/lib/types';
import { db } from '@/lib/db';
import { getVersion, subscribe } from '@/lib/store';

interface DataContextValue extends AppData {
  loading: boolean;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const INITIAL: AppData = {
  user: null,
  company: null,
  services: [],
  customers: [],
  quotes: [],
  followUps: [],
  notifications: [],
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(INITIAL);
  const [loading, setLoading] = useState(true);
  // getServerSnapshot é obrigatório para o pré-render no servidor (SSR)
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);

  const refresh = useCallback(async () => {
    try {
      const [user, company, services, customers, quotes, followUps, notifications] = await Promise.all([
        db.getCurrentUser(),
        db.getCompany(),
        db.listServices(),
        db.listCustomers(),
        db.listQuotes(),
        db.listFollowUps(),
        db.listNotifications(),
      ]);
      setData({ user, company, services, customers, quotes, followUps, notifications });
    } catch {
      setData({ ...INITIAL, user: null });
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega quando o store local muda (modo demonstração) ou na montagem
  useEffect(() => {
    refresh();
  }, [refresh, version]);

  // Recarrega em mudanças de sessão (login/logout)
  useEffect(() => {
    const unsub = db.onSessionChange(() => {
      setLoading(true);
      refresh();
    });
    return unsub;
  }, [refresh]);

  const value = useMemo<DataContextValue>(
    () => ({ ...data, loading, refresh }),
    [data, loading, refresh],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>.');
  return ctx;
}
