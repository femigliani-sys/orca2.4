import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { ArrowLeft } from 'lucide-react';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-50 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(700px 400px at 20% 10%, rgba(99,102,241,0.08), transparent), radial-gradient(700px 400px at 85% 90%, rgba(16,185,129,0.06), transparent)',
        }}
      />
      <Link href="/" className="relative mb-8 flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600">
        <ArrowLeft className="size-4" /> Voltar para o site
      </Link>
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-ink-200/70 bg-white p-8 shadow-card-hover">
          <h1 className="text-xl font-semibold tracking-tight text-ink-950">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <p className="mt-6 text-center text-sm text-ink-500">{footer}</p>}
        <div className="mt-4 text-center text-xs text-ink-400">
          <Link href="/termos" className="underline-offset-2 hover:underline">
            Termos de Uso
          </Link>
          <span className="mx-1.5">·</span>
          <Link href="/privacidade" className="underline-offset-2 hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
