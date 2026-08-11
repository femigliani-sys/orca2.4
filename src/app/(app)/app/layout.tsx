import { DataProvider } from '@/components/providers/data-provider';
import { AuthGuard } from '@/components/layout/auth-guard';
import { AppShell } from '@/components/layout/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <AuthGuard>
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </DataProvider>
  );
}
