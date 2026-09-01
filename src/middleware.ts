import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Middleware: proteção de rotas no servidor (modo produção/Supabase).
 * No modo demonstração (sem env do Supabase) a proteção é feita no cliente.
 *
 * IMPORTANTE: qualquer falha do Supabase aqui (rede, chave inválida, etc.)
 * é tratada como "sem sessão" e deixa a navegação seguir — nunca retorna
 * 500 (que causaria tela branca). A proteção real continua no cliente.
 */
const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function middleware(request: NextRequest) {
  if (!isConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });
  let user: { id: string } | null = null;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      },
    );
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u;
  } catch (err) {
    // Supabase indisponível / chave inválida → segue sem sessão (sem 500)
    console.error('[middleware] falha ao validar sessão:', err instanceof Error ? err.message : err);
  }

  const { pathname } = request.nextUrl;

  // API privada: exige sessão (webhooks e links públicos ficam abertos)
  const isPrivateApi =
    pathname.startsWith('/api') &&
    !pathname.startsWith('/api/billing') &&
    !pathname.startsWith('/api/public') &&
    !pathname.startsWith('/api/whatsapp/webhook');
  if (isPrivateApi && !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  // Rotas do app exigem sessão
  if (pathname.startsWith('/app') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Já logado não vê páginas de auth
  if (pathname.startsWith('/auth') && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/app';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/api/:path*', '/auth/:path*'],
};
