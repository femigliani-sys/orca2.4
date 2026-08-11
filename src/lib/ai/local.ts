/**
 * Interpretador LOCAL (sem OpenAI).
 * Funciona 100% offline, baseado nos dados do próprio negócio.
 * Regra de ouro: NUNCA inventa preços — só usa o catálogo cadastrado.
 *
 * Estratégia de matching:
 * - Nomes são normalizados (minúsculas, sem acento, sinônimos comuns).
 * - Se o serviço tem número no nome (ex.: "12.000 BTUs"), TODOS os números
 *   precisam aparecer na mensagem do cliente (evita sugerir 9.000 e 18.000
 *   quando o cliente pede 12.000).
 * - Quantidades são associadas ao serviço mais próximo no texto.
 */
import type { AiInterpretResult, QuoteItem, Service } from '../types';
import { generateId, normalizeText, round2, formatCurrency } from '../utils';
import { DEFAULT_QUOTE_MESSAGE } from '../defaults';

// ---------------------------------------------------------------- Sinônimos
const SYNONYMS: Record<string, string> = {
  pintar: 'pintura', pinta: 'pintura', pintura: 'pintura', pintando: 'pintura', repintar: 'pintura',
  instalar: 'instalacao', instala: 'instalacao', instalacao: 'instalacao', instalando: 'instalacao',
  montar: 'montagem', monta: 'montagem', montagem: 'montagem',
  consertar: 'reparo', conserta: 'reparo', reparo: 'reparo', concertar: 'reparo',
  manutencao: 'manutencao', manter: 'manutencao', revisao: 'manutencao', revisar: 'manutencao',
  limpar: 'limpeza', limpa: 'limpeza', limpeza: 'limpeza', faxina: 'limpeza',
  trocar: 'troca', troca: 'troca', substituir: 'troca',
  ar: 'arcondicionado', condicionado: 'arcondicionado', arcondicionado: 'arcondicionado',
  split: 'split', colocar: 'instalacao',
  desentupir: 'desentupimento', desentupimento: 'desentupimento', entupida: 'desentupimento', entupido: 'desentupimento',
  reformar: 'reforma', reforma: 'reforma',
  dedetizar: 'dedetizacao', dedetizacao: 'dedetizacao',
  mudanca: 'mudanca', fretes: 'frete', frete: 'frete',
};

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'para', 'com', 'o', 'a', 'os', 'as', 'e', 'ou', 'no', 'na',
  'um', 'uma', 'uns', 'umas', 'por', 'quanto', 'queria', 'gostaria', 'preciso', 'voce', 'voces', 'meu',
  'minha', 'estou', 'seria', 'sobre', 'depois', 'tambem', 'ate', 'ja', 'se', 'que', 'qual', 'tem', 'ter',
  'quero', 'vcs', 'vc', 'obrigado', 'obrigada', 'oi', 'ola', 'bom', 'boa', 'dia', 'tarde', 'noite',
  'fica', 'ficar', 'custa', 'custo', 'valor', 'preco', 'saber', 'pedir', 'pedido', 'orçamento',
  'sem', 'ainda', 'mais', 'menos', 'muito', 'pouco', 'todo', 'toda', 'me', 'te', 'nos',
]);

// Palavras que indicam necessidades (para detectar pedidos sem serviço cadastrado)
const NEED_HINTS = new Set([
  'pintura', 'instalacao', 'montagem', 'reparo', 'manutencao', 'limpeza', 'troca',
  'conserto', 'reforma', 'projeto', 'consultoria', 'dedetizacao', 'mudanca', 'frete',
  'desentupimento',
]);

// ---------------------------------------------------------------- Normalização
function normalizeForMatch(input: string): string {
  let s = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // "12.000" / "12,000" → "12000" (separador de milhar)
  s = s.replace(/(\d)[.,](\d{3})\b/g, '$1$2');
  // "12 mil" → "12000" (valores por extenso)
  s = s.replace(/(\d+)\s*(?:mil|milhar)\b/g, (_, num) => `${parseInt(num, 10)}000`);
  // remove pontuação e espaços repetidos
  s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function tokenize(normalized: string): string[] {
  return normalized
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => SYNONYMS[t] ?? t);
}

function isNumberToken(t: string): boolean {
  return /^\d+([.,]\d+)?$/.test(t);
}

// ---------------------------------------------------------------- Quantidades
interface QtyMatch {
  qty: number;
  unit: string | null;
  raw: string;
  pos: number; // posição no texto normalizado
}

const QTY_PATTERNS: { re: RegExp; unit: string }[] = [
  { re: /(\d+(?:[,.]\d+)?)\s*(?:metros? quadrados?|m2s?|m²|metro quadrado)/g, unit: 'metro quadrado' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:metros? lineares?|m linear)/g, unit: 'metro linear' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:horas?)/g, unit: 'hora' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:dias?|diarias?)/g, unit: 'diária' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:pecas?)/g, unit: 'peça' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:unidades?)/g, unit: 'unidade' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:portas?|janelas?|comodos?|ambientes?|quartos?|banheiros?|andares?)/g, unit: 'unidade' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:veiculos?|carros?|motos?|pneus?)/g, unit: 'unidade' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:aparelhos?|splits?)/g, unit: 'unidade' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:meses?|semanas?)/g, unit: 'mês' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:servicos?|projetos?|visitas?)/g, unit: 'serviço' },
];

function extractQuantities(message: string): QtyMatch[] {
  const n = normalizeForMatch(message);
  const results: QtyMatch[] = [];
  for (const { re, unit } of QTY_PATTERNS) {
    for (const m of n.matchAll(re)) {
      results.push({
        qty: parseFloat(m[1].replace(',', '.')),
        unit,
        raw: m[0],
        pos: m.index ?? 0,
      });
    }
  }
  return results.sort((a, b) => a.pos - b.pos);
}

// ---------------------------------------------------------------- Matching
interface MatchResult {
  service: Service;
  score: number;
  matchedTokens: string[];
  exact: boolean;
  reject: boolean;
}

function scoreService(service: Service, normalizedMessage: string, msgTokens: Set<string>): MatchResult {
  const nameN = normalizeForMatch(service.name);
  const nameTokens = tokenize(nameN);
  if (nameTokens.length === 0) {
    return { service, score: 0, matchedTokens: [], exact: false, reject: true };
  }

  // Frase inteira aparece na mensagem → match perfeito
  if (normalizedMessage.includes(nameN)) {
    return { service, score: 10, matchedTokens: nameTokens, exact: true, reject: false };
  }

  const matched = nameTokens.filter((t) => msgTokens.has(t));
  const nameNumbers = nameTokens.filter(isNumberToken);
  const matchedNumbers = matched.filter(isNumberToken);
  const nonNumberMatched = matched.filter((t) => !isNumberToken(t));

  // Regra dos números: serviço com modelo (ex.: 12.000 BTUs) só casa se o
  // número do catálogo aparecer na mensagem — evita sugerir 9.000/18.000.
  if (nameNumbers.length > 0 && matchedNumbers.length !== nameNumbers.length) {
    return { service, score: 0, matchedTokens: [], exact: false, reject: true };
  }

  const totalNonNumber = nameTokens.filter((t) => !isNumberToken(t)).length;
  if (totalNonNumber === 0) {
    // Só números no nome: exige que todos tenham sido citados
    return nameNumbers.length === matchedNumbers.length
      ? { service, score: 3, matchedTokens: matched, exact: false, reject: false }
      : { service, score: 0, matchedTokens: [], exact: false, reject: true };
  }

  const ratio = nonNumberMatched.length / totalNonNumber;
  if (ratio <= 0.5 || nonNumberMatched.length < 1) {
    return { service, score: 0, matchedTokens: [], exact: false, reject: true };
  }

  return { service, score: ratio + matchedNumbers.length, matchedTokens: matched, exact: false, reject: false };
}

// ---------------------------------------------------------------- Interpretação
export function localInterpret(message: string, services: Service[]): AiInterpretResult {
  const trimmed = message.trim();
  const normalized = normalizeForMatch(trimmed);
  const msgTokens = new Set(tokenize(normalized));
  const quantities = extractQuantities(trimmed);

  const activeServices = services.filter((s) => s.active);

  const scored = activeServices
    .map((s) => scoreService(s, normalized, msgTokens))
    .filter((m) => !m.reject)
    .sort((a, b) => b.score - a.score || b.service.name.localeCompare(a.service.name))
    .slice(0, 8);

  // Remove serviços genéricos quando existe um mais específico com o mesmo
  // conceito (ex.: "Pintura" some quando "Pintura de sala" também casa).
  const finalMatches: typeof scored = [];
  const allTokens = scored.map((m) => new Set(tokenize(normalizeForMatch(m.service.name)).filter((t) => !isNumberToken(t))));
  scored.forEach((m, i) => {
    const myTokens = allTokens[i];
    const isGenericOfAnother = scored.some((_, j) => {
      if (i === j) return false;
      const other = allTokens[j];
      return myTokens.size > 0 && myTokens.size < other.size && [...myTokens].every((t) => other.has(t));
    });
    if (!isGenericOfAnother) finalMatches.push(m);
  });

  const items: QuoteItem[] = [];
  const usedServiceIds = new Set<string>();

  for (const match of finalMatches.slice(0, 6)) {
    if (usedServiceIds.has(match.service.id)) continue;
    usedServiceIds.add(match.service.id);
    items.push({
      id: generateId(),
      serviceId: match.service.id,
      name: match.service.name,
      description: match.service.description,
      quantity: 1,
      unit: match.service.unit,
      price: match.service.price,
      observations: match.service.observations,
    });
  }

  // Associa quantidades ao serviço mais próximo no texto
  const presumedQty = assignQuantities(items, normalized, quantities);

  // Necessidades não atendidas pelo catálogo
  const missing: string[] = [];
  for (const token of msgTokens) {
    if (NEED_HINTS.has(token) && !items.some((it) => tokenize(normalizeForMatch(it.name)).includes(token))) {
      missing.push(token);
    }
  }
  for (const q of quantities) {
    const hasCompatible = items.some((it) => unitsCompatible(it.unit, q.unit ?? ''));
    if (!hasCompatible && q.unit && !missing.includes(`${q.raw} (${q.unit})`)) {
      missing.push(`${q.raw} (${q.unit})`);
    }
  }
  const uniqueMissing = [...new Set(missing)];

  const needsConfirmation =
    uniqueMissing.length > 0 || presumedQty || items.length === 0 || finalMatches.some((m) => !m.exact);

  return {
    items,
    missing: uniqueMissing,
    summary: buildSummary(items, uniqueMissing),
    needsConfirmation,
    message: undefined,
  };
}

function unitsCompatible(itemUnit: string, qtyUnit: string): boolean {
  const a = itemUnit.toLowerCase();
  const b = qtyUnit.toLowerCase();
  if (a.includes('metro quadrado') && b.includes('metro quadrado')) return true;
  if (a === b) return true;
  if ((a === 'peça' && b === 'unidade') || (a === 'unidade' && b === 'peça')) return true;
  return false;
}

/** Posição do serviço na mensagem: a posição da última palavra significativa do nome. */
function itemPosition(it: QuoteItem, normalizedMessage: string): number {
  const tokens = tokenize(normalizeForMatch(it.name)).filter((t) => !isNumberToken(t));
  if (tokens.length === 0) return -1;
  const positions = tokens
    .map((t) => normalizedMessage.lastIndexOf(t))
    .filter((p) => p !== -1);
  if (positions.length === 0) return -1;
  return Math.max(...positions);
}

/**
 * Associa quantidades por matching ótimo (menor distância no texto).
 * Retorna true se alguma quantidade ficou presumida.
 */
function assignQuantities(items: QuoteItem[], normalizedMessage: string, quantities: QtyMatch[]): boolean {
  if (quantities.length === 0) {
    for (const it of items) it.observations = 'quantidade presumida: 1';
    return items.length > 0;
  }

  // pares (item, qty) ordenados por distância
  const pairs: { itemIdx: number; qtyIdx: number; dist: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const pos = itemPosition(items[i], normalizedMessage);
    if (pos === -1) continue;
    for (let j = 0; j < quantities.length; j++) {
      const q = quantities[j];
      if (!unitsCompatible(items[i].unit, q.unit ?? '')) continue;
      pairs.push({ itemIdx: i, qtyIdx: j, dist: Math.abs(q.pos - pos) });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);

  const itemUsed = new Set<number>();
  const qtyUsed = new Set<number>();
  for (const p of pairs) {
    if (itemUsed.has(p.itemIdx) || qtyUsed.has(p.qtyIdx)) continue;
    if (p.dist > 60) continue;
    items[p.itemIdx].quantity = Math.max(1, round2(quantities[p.qtyIdx].qty));
    itemUsed.add(p.itemIdx);
    qtyUsed.add(p.qtyIdx);
  }

  let presumed = false;
  for (let i = 0; i < items.length; i++) {
    if (!itemUsed.has(i)) {
      items[i].quantity = 1;
      items[i].observations = 'quantidade presumida: 1';
      presumed = true;
    }
  }
  return presumed;
}

function buildSummary(items: QuoteItem[], missing: string[]): string {
  if (items.length === 0) {
    return 'Não encontrei serviços cadastrados compatíveis com este pedido. Cadastre o serviço ou selecione manualmente abaixo.';
  }
  const names = items
    .map((i) => `${i.name} (${i.quantity} × ${formatCurrency(i.price)})`)
    .join(', ');
  const base = `Identifiquei ${items.length} serviço${items.length > 1 ? 's' : ''} a partir da sua mensagem: ${names}.`;
  if (missing.length > 0) {
    return `${base} Não encontrei no catálogo: ${missing.join(', ')} — confirme com o cliente antes de enviar.`;
  }
  return base;
}

/** Gera a mensagem padrão do orçamento (usada pela IA local). */
export function localBuildMessage(
  items: QuoteItem[],
  total: number,
  validityDays: number,
  companyName: string,
  customerName: string,
): string {
  const lines = items.map((it) => {
    const lineTotal = round2(it.quantity * it.price);
    const qty = it.quantity !== 1 ? ` (${it.quantity} × ${formatCurrency(it.price)})` : '';
    return `• ${it.name}${qty} — ${formatCurrency(lineTotal)}`;
  });
  return DEFAULT_QUOTE_MESSAGE.replaceAll('{{customer}}', customerName)
    .replaceAll('{{items}}', lines.join('\n'))
    .replaceAll('{{total}}', formatCurrency(total))
    .replaceAll('{{validity}}', String(validityDays))
    .replaceAll('{{company}}', companyName)
    .trim();
}
