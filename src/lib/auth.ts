/**
 * Autenticação do MODO DEMONSTRAÇÃO (sem Supabase).
 * ⚠️ Hash simples apenas para viabilizar a demo local — em produção a
 * autenticação é feita pelo Supabase Auth (senha nunca passa pelo nosso código).
 */

export async function demoHash(password: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && 'subtle' in crypto) {
      const data = new TextEncoder().encode(`orcaai::${password}`);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // fallback
  }
  // Fallback determinístico (demo apenas)
  let h = 5381;
  const s = `orcaai::${password}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `fb_${(h >>> 0).toString(16)}`;
}
