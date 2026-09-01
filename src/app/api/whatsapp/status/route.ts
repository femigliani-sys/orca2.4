import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getWhatsAppConfigStatus } from '@/lib/whatsapp-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/whatsapp/status
 * Retorna o estado da configuração do WhatsApp Business API
 * (sem expor tokens). Usado na página de Configurações.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      webhookConfigured: false,
      phoneNumberId: null,
      webhookUrl: '',
      demo: true,
      guide: getWhatsAppConfigStatus().guide,
    });
  }

  const supabase = await createServerSupabase().catch(() => null);
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  return NextResponse.json(getWhatsAppConfigStatus());
}
