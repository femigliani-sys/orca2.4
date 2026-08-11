'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/db';
import { friendlyError } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('confirmado') ? (
      'Conta criada! Confirme seu e-mail antes de entrar.'
    ) : null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      await db.signIn(email, password);
      toast.success('Bem-vindo de volta! 👋');
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('/auth') ? next : '/app');
      router.refresh();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Entrar na sua conta"
      subtitle="Acesse seu painel e acompanhe seus orçamentos."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link href="/auth/cadastro" className="font-medium text-brand-600 hover:text-brand-700">
            Criar conta grátis
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {info && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{info}</div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link href="/auth/recuperar-senha" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Esqueci minha senha
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
