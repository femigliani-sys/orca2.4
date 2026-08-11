'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';

const LINKS = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#precos', label: 'Preços' },
  { href: '#faq', label: 'FAQ' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors ${
        scrolled ? 'border-ink-200/70 bg-white/85 backdrop-blur' : 'border-transparent bg-white'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="OrçaAI — início">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/auth/login">
            <Button variant="ghost">Entrar</Button>
          </Link>
          <Link href="/auth/cadastro">
            <Button>Começar grátis</Button>
          </Link>
        </div>

        <button
          className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Abrir menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-100 bg-white px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Link href="/auth/login" className="flex-1">
                <Button variant="secondary" className="w-full">
                  Entrar
                </Button>
              </Link>
              <Link href="/auth/cadastro" className="flex-1">
                <Button className="w-full">Começar grátis</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
