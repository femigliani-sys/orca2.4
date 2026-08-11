'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/db';
import { friendlyError } from '@/lib/utils';
import { isDemo } from '@/lib/db';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Informe seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      await db.resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Enviaremos um link para você redefinir sua senha."
      footer={
        <>
          <Link href="/auth/login" className="font-medium text-brand-600 hover:text-brand-700">
            ← Voltar para o login
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-sm font-medium text-emerald-800">Pronto! 📩</p>
          <p className="mt-1.5 text-sm text-emerald-700">
            {isDemo()
              ? 'No modo demonstração a recuperação é simulada. Em produção, você receberá o link por e-mail (Supabase).'
              : 'Se existir uma conta com este e-mail, você receberá as instruções em instantes.'}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail cadastrado</Label>
            <Input
              id="email"
              type="email"
              placeholder="voce@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Enviar link de recuperação
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
