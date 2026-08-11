import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Gera IDs curtos e únicos (suficiente para o MVP; o Supabase usa UUIDs nativos). */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addDaysIso(days: number, from?: Date): string {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isOverdue(iso: string): boolean {
  const d = parseISO(iso);
  d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

export function isValidIsoDate(iso: string): boolean {
  return !Number.isNaN(parseISO(iso).getTime());
}

// ---------------------------------------------------------------- Formatação
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return 'R$ 0,00';
  return brl.format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), "dd 'de' MMM", { locale: ptBR });
  } catch {
    return '—';
  }
}

export function formatDateFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return '—';
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return '—';
  }
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd/MM', { locale: ptBR });
  } catch {
    return '—';
  }
}

export function quoteNumberLabel(number: number): string {
  return `#${String(number).padStart(4, '0')}`;
}

// ---------------------------------------------------------------- Texto
/** Normaliza texto: minúsculas e sem acentos (para matching da IA local). */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripNonDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/** Número de WhatsApp para link wa.me (somente dígitos, com DDI 55). */
export function phoneToWa(phone: string): string {
  let digits = stripNonDigits(phone);
  if (!digits) return '';
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------- Erros amigáveis
export function friendlyError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const msg = error.message;
    const map: Record<string, string> = {
      'Invalid login credentials': 'E-mail ou senha incorretos.',
      'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
      'User already registered': 'Este e-mail já está cadastrado.',
      'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
      'Rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    };
    return map[msg] ?? msg;
  }
  return 'Algo deu errado. Tente novamente.';
}

// ---------------------------------------------------------------- Valores
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function maskPhone(input: string): string {
  const d = stripNonDigits(input).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
