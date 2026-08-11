import type { DB } from './types';
import { localDB } from './local';
import { isDemoMode } from '../supabase';

let cached: DB | null = null;

/**
 * Instância única de banco.
 * - Sem Supabase configurado  → modo demonstração (localStorage)
 * - Com Supabase configurado  → Supabase (RLS protege os dados)
 *
 * A implementação Supabase é criada de forma LAZY (Proxy) para que o
 * cliente do navegador nunca seja instanciado durante o SSR.
 */
function createLazySupabaseDB(): DB {
  let impl: DB | null = null;
  return new Proxy({} as DB, {
    get(_target, prop) {
      if (!impl) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createSupabaseDB } = require('./supabase') as typeof import('./supabase');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createBrowserSupabase } = require('../supabase') as typeof import('../supabase');
        impl = createSupabaseDB(createBrowserSupabase());
      }
      const value = (impl as unknown as Record<string, unknown>)[prop as string];
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(impl) : value;
    },
  });
}

export function getDB(): DB {
  if (cached) return cached;
  if (isDemoMode()) {
    cached = localDB;
  } else {
    cached = createLazySupabaseDB();
  }
  return cached;
}

export const db = getDB();

export function isDemo(): boolean {
  return isDemoMode();
}
