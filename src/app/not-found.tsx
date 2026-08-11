import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <h1 className="mt-8 text-6xl font-bold tracking-tight text-ink-950">404</h1>
        <p className="mt-3 text-ink-500">Página não encontrada.</p>
        <Link href="/" className="mt-6 inline-block">
          <Button>Voltar para o início</Button>
        </Link>
      </div>
    </div>
  );
}
