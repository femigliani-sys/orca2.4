'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AppData } from '@/lib/types';
import { db } from '@/lib/db';
import { getVersion, subscribe } from '@/lib/store';
import { friendlyError } from '@/lib/utils';

interface DataContextValue extends AppData {
  loading: boolean;
  refresh: () => Promise<void>;
  /** Erro de carregamento dos dados (exibido em um banner — nunca tela branca). */
  dataError: string | null;
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

const errMsg = (err: unknown) => friendlyError(err).slice(0, 200);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);

  const refresh = useCallback(async () => {
    try {
      // 1) Sessão: se não existir, sai limpo (tela de login normal)
      const session = await db.getSession();
      if (!session.userId) {
        setData({ ...INITIAL, user: null });
        setDataError(null);
        setLoading(false);
        return;
      }

      // 2) Usuário: se falhar, mantém um placeholder para NUNCA redirecionar em loop
      let user: AppData['user'] = null;
      try {
        user = await db.getCurrentUser();
      } catch (err) {
        setDataError(`Não foi possível carregar sua conta: ${errMsg(err)}`);
      }
      if (!user) {
        user = {
          id: session.userId,
          name: '',
          email: '',
          companyName: '',
          businessType: '',
          onboarded: false,
          createdAt: new Date().toISOString(),
        };
      }

      // 3) Dados: cada consulta com fallback individual — se uma tabela falhar,
      //    as outras carregam e o erro aparece no banner (sem tela branca).
      const failures: string[] = [];
      const safe = <T,>(p: Promise<T>, label: string): Promise<T | null> =>
        p.catch((e) => {
          failures.push(`${label}: ${errMsg(e)}`);
          return null;
        });

      const [company, services, customers, quotes, followUps, notifications] = await Promise.all([
        safe(db.getCompany(), 'empresa'),
        safe(db.listServices(), 'serviços'),
        safe(db.listCustomers(), 'clientes'),
        safe(db.listQuotes(), 'orçamentos'),
        safe(db.listFollowUps(), 'follow-ups'),
        safe(db.listNotifications(), 'notificações'),
      ]);

      setData({
        user,
        company,
        services: services ?? [],
        customers: customers ?? [],
        quotes: quotes ?? [],
        followUps: followUps ?? [],
        notifications: notifications ?? [],
      });
      setDataError(
        failures.length > 0
          ? `Não foi possível carregar alguns dados do Supabase: ${failures.join(' · ')}`
          : null,
      );
    } catch {
      setData({ ...INITIAL, user: null });
      setDataError(null);
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
    () => ({ ...data, loading, refresh, dataError }),
    [data, loading, refresh, dataError],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>.');
  return ctx;
}
