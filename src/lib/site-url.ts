/**
 * URL base do site, segura para build e runtime.
 * Evita o erro "TypeError: Invalid URL" do Next.js quando a variável
 * NEXT_PUBLIC_SITE_URL está vazia ou mal formatada no ambiente (ex.: Vercel).
 */
export function getSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (!raw) return 'http://localhost:3000';
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return raw.replace(/\/+$/, ''); // remove barras finais
    }
  } catch {
    // valor inválido → usa fallback
  }
  return 'http://localhost:3000';
}

/** Constrói a URL base como objeto (para metadataBase do Next). */
export function getSiteUrlObject(): URL {
  try {
    return new URL(getSiteUrl());
  } catch {
    return new URL('http://localhost:3000');
  }
}
