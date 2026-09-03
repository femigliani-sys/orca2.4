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

type Info =
  | { text: string; tone: 'green' | 'blue'; link?: { href: string; label: string } }
  | null;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<Info>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('senha')) {
      return { text: 'Senha alterada com sucesso! Entre com sua nova senha.', tone: 'green' };
    }
    if (params.get('confirmado')) {
      return { text: 'Conta criada! Confirme seu e-mail antes de entrar.', tone: 'blue' };
    }
    return null;
  });

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
      const msg = friendlyError(err);
      toast.error(msg);
      // Se o e-mail não foi confirmado, oferece a tela de confirmação
      if (msg.toLowerCase().includes('confirme seu e-mail') || msg.toLowerCase().includes('not confirmed')) {
        setInfo({
          text: 'Seu e-mail ainda não foi confirmado.',
          tone: 'blue',
          link: {
            href: `/auth/confirmar-email?email=${encodeURIComponent(email.trim().toLowerCase())}`,
            label: 'Reenviar e-mail de confirmação →',
          },
        });
      }
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
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              info.tone === 'green'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            {info.text}
            {info.link && (
              <Link href={info.link.href} className="mt-1 block font-semibold text-sky-900 underline">
                {info.link.label}
              </Link>
            )}
          </div>
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
