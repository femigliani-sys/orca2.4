import type { QuoteStatus } from './types';

// ---------------------------------------------------------------- Status
export const QUOTE_STATUSES: { value: QuoteStatus; label: string; color: string; bg: string }[] = [
  { value: 'rascunho', label: 'Rascunho', color: 'text-slate-600', bg: 'bg-slate-100' },
  { value: 'enviado', label: 'Enviado', color: 'text-blue-700', bg: 'bg-blue-50' },
  { value: 'visualizado', label: 'Visualizado', color: 'text-sky-700', bg: 'bg-sky-50' },
  { value: 'negociacao', label: 'Em negociação', color: 'text-amber-700', bg: 'bg-amber-50' },
  { value: 'aprovado', label: 'Aprovado', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  { value: 'recusado', label: 'Recusado', color: 'text-rose-700', bg: 'bg-rose-50' },
  { value: 'expirado', label: 'Expirado', color: 'text-slate-500', bg: 'bg-slate-100' },
];

export const QUOTE_STATUS_MAP = Object.fromEntries(
  QUOTE_STATUSES.map((s) => [s.value, s]),
) as Record<QuoteStatus, (typeof QUOTE_STATUSES)[number]>;

// Status que contam como "enviados" para as métricas
export const SENT_STATUSES: QuoteStatus[] = ['enviado', 'visualizado', 'negociacao', 'aprovado', 'recusado', 'expirado'];

// Pipeline (Kanban) — estágios mapeados para status
export const PIPELINE_STAGES: { id: string; label: string; statuses: QuoteStatus[] }[] = [
  { id: 'novo', label: 'Novo', statuses: ['rascunho'] },
  { id: 'enviado', label: 'Orçamento enviado', statuses: ['enviado', 'visualizado'] },
  { id: 'negociacao', label: 'Negociação', statuses: ['negociacao'] },
  { id: 'aprovado', label: 'Aprovado', statuses: ['aprovado'] },
  { id: 'perdido', label: 'Perdido', statuses: ['recusado', 'expirado'] },
];

// ---------------------------------------------------------------- Unidades
export const UNITS = [
  { value: 'serviço', label: 'Serviço' },
  { value: 'unidade', label: 'Unidade' },
  { value: 'peça', label: 'Peça' },
  { value: 'hora', label: 'Hora' },
  { value: 'diária', label: 'Diária' },
  { value: 'metro quadrado', label: 'Metro quadrado (m²)' },
  { value: 'metro linear', label: 'Metro linear' },
  { value: 'mês', label: 'Mês' },
  { value: 'projeto', label: 'Projeto' },
  { value: 'visita', label: 'Visita' },
];

// ---------------------------------------------------------------- Tipos de negócio
export const BUSINESS_TYPES = [
  'Eletricista',
  'Encanador',
  'Técnico de ar-condicionado',
  'Instalador',
  'Pintor',
  'Empresa de limpeza',
  'Assistência técnica',
  'Fotógrafo',
  'Designer',
  'Marceneiro',
  'Mecânico',
  'Manutenção predial',
  'Profissional autônomo',
  'Outro',
];

// ---------------------------------------------------------------- Categorias de serviço
export const SERVICE_CATEGORIES = [
  'Instalação',
  'Manutenção',
  'Reparo',
  'Pintura',
  'Limpeza',
  'Montagem',
  'Projeto',
  'Consultoria',
  'Mão de obra',
  'Material',
  'Deslocamento',
  'Outros',
];

// ---------------------------------------------------------------- Outros
export const APP_NAME = 'OrçaAI';
export const APP_TAGLINE = 'Transforme pedidos de orçamento em vendas.';
export const FREE_MONTHLY_QUOTES = 5;
export const FREE_MAX_SERVICES = 10;
export const FREE_MAX_CUSTOMERS = 30;
export const FOLLOW_UP_DAYS = 2; // follow-up recomendado em N dias após envio

export const VALIDITY_OPTIONS = [
  { value: 3, label: '3 dias' },
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
  { value: 60, label: '60 dias' },
];
