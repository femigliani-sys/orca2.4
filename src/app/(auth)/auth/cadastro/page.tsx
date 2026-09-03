'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/db';
import { friendlyError } from '@/lib/utils';
import { BUSINESS_TYPES } from '@/lib/constants';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    companyName: '',
    email: '',
    password: '',
    businessType: '',
  });
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (value: string) => setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.companyName.trim() || !form.email.trim() || !form.password) {
      toast.error('Preencha todos os campos.');
      return;
    }
    if (form.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!form.businessType) {
      toast.error('Escolha o tipo de negócio.');
      return;
    }
    setLoading(true);
    try {
      await db.signUp({
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        email: form.email.trim(),
        password: form.password,
        businessType: form.businessType,
      });
      // Se o Supabase exigir confirmação de e-mail, não há sessão ainda →
      // leva para a página "verifique seu e-mail" (com opção de reenviar)
      const session = await db.getSession();
      if (!session.userId) {
        toast.success('Conta criada! Confirme seu e-mail para ativar.');
        router.replace(
          `/auth/confirmar-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`,
        );
      } else {
        toast.success('Conta criada! Vamos configurar seu negócio. 🚀');
        router.replace('/onboarding');
      }
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Criar sua conta grátis"
      subtitle="Comece a criar orçamentos profissionais em menos de 2 minutos."
      footer={
        <>
          Já tem conta?{' '}
          <Link href="/auth/login" className="font-medium text-brand-600 hover:text-brand-700">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              placeholder="Maria Silva"
              value={form.name}
              onChange={(e) => update('name')(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input
              id="companyName"
              placeholder="Maria Silva Pinturas"
              value={form.companyName}
              onChange={(e) => update('companyName')(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="voce@empresa.com.br"
            value={form.email}
            onChange={(e) => update('email')(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={form.password}
            onChange={(e) => update('password')(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="businessType">Tipo de negócio</Label>
          <Select value={form.businessType} onValueChange={update('businessType')}>
            <SelectTrigger id="businessType">
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((bt) => (
                <SelectItem key={bt} value={bt}>
                  {bt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Criar conta
        </Button>
        <p className="text-center text-xs text-ink-400">
          Ao criar a conta você concorda com nossos termos de uso.
        </p>
      </form>
    </AuthLayout>
  );
}
