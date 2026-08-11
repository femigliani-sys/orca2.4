'use client';

import { useState } from 'react';
import { Copy, Check, MessageCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { buildQuoteMessage } from '@/lib/ai/templates';
import type { Company, Quote } from '@/lib/types';
import { buildWaLink } from '@/lib/whatsapp';

interface Props {
  quote: Pick<Quote, 'items' | 'total' | 'validityDays' | 'customerName'>;
  company: Pick<Company, 'name' | 'settings'>;
  phone?: string;
  onSend?: (channel: 'whatsapp' | 'copiado') => void;
}

/** Mensagem pronta + ações (copiar / WhatsApp). */
export function MessageCard({ quote, company, phone, onSend }: Props) {
  const [copied, setCopied] = useState(false);
  const message = buildQuoteMessage(quote, company);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onSend?.('copiado');
      toast.success('Mensagem copiada!');
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto manualmente.');
    }
  }

  function sendWhatsApp() {
    if (!phone) {
      toast.error('Adicione o telefone do cliente para enviar pelo WhatsApp.');
      return;
    }
    const link = buildWaLink(phone, message);
    if (!link) {
      toast.error('Telefone inválido.');
      return;
    }
    onSend?.('whatsapp');
    return link;
  }

  const waLink = phone ? buildWaLink(phone, message) : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-900">Mensagem pronta para o cliente</p>
        <button
          onClick={() => buildQuoteMessage(quote, company)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-400 hover:bg-ink-100 hover:text-ink-600"
          title="Reconstruir mensagem"
        >
          <RefreshCw className="size-3.5" /> Regenerar
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-xl bg-ink-50 p-4 text-sm leading-relaxed text-ink-700 scrollbar-thin">
        {message}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={copy} className="flex-1">
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          {copied ? 'Copiada!' : 'Copiar mensagem'}
        </Button>
        {waLink ? (
          <Button asChild variant="whatsapp" className="flex-1" onClick={() => onSend?.('whatsapp')}>
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" /> Enviar pelo WhatsApp
            </a>
          </Button>
        ) : (
          <Button variant="whatsapp" onClick={sendWhatsApp} className="flex-1">
            <MessageCircle className="size-4" /> Enviar pelo WhatsApp
          </Button>
        )}
      </div>
      {!phone && (
        <p className="text-xs text-amber-600">Adicione o telefone do cliente para habilitar o envio pelo WhatsApp.</p>
      )}
    </div>
  );
}
