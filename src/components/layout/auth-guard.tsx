'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useData } from '@/components/providers/data-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/ui/logo';

/** Protege as rotas privadas (modo demonstração). Em produção o middleware faz isso no servidor. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useData();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    }
    if (!loading && user && !user.onboarded && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50">
        <Logo />
        <div className="w-64 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
