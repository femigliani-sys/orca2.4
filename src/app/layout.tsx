import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { GlobalErrorOverlay } from '@/components/dev/error-overlay';
import { CookieBanner } from '@/components/cookie-banner';
import { getSiteUrlObject } from '@/lib/site-url';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: getSiteUrlObject(),
  // URL canônica única (sem www) — igual ao sitemap
  alternates: {
    canonical: '/',
  },
  title: {
    default: 'OrçaAI — Transforme pedidos de orçamento em vendas',
    template: '%s · OrçaAI',
  },
  description:
    'Crie orçamentos profissionais em segundos, acompanhe seus clientes e nunca esqueça um follow-up. A IA do OrçaAI transforma pedidos do WhatsApp em orçamentos prontos.',
  keywords: ['orçamento', 'orcamento', 'SaaS', 'IA', 'WhatsApp', 'pequenos negócios', 'prestador de serviços'],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'OrçaAI — Transforme pedidos de orçamento em vendas',
    description:
      'Crie orçamentos profissionais em segundos, acompanhe seus clientes e nunca esqueça um follow-up.',
    type: 'website',
    locale: 'pt_BR',
    images: ['/icon-512.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
        <GlobalErrorOverlay />
        <CookieBanner />
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
