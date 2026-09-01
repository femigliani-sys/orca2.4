/**
 * Interpretador LOCAL (sem OpenAI).
 * Funciona 100% offline, baseado nos dados do próprio negócio.
 * Regra de ouro: NUNCA inventa preços — só usa o catálogo cadastrado.
 *
 * Recursos:
 * - Normalização (minúsculas, sem acento, "12 mil" → 12000, "12.000" → 12000)
 * - Números por extenso ("vinte metros quadrados" → 20 m², "duas portas" → 2)
 * - Quantidades com "x" ("2x pintura", "3× serviço")
 * - Tolerância a erros de digitação (Levenshtein em tokens)
 * - Regra dos números: serviço com modelo (12.000 BTUs) só casa se o número bater
 * - Associação de quantidade por proximidade (matching ótimo)
 * - Remoção de serviços genéricos quando há um mais específico
 */
import type { AiInterpretResult, QuoteItem, Service } from '../types';
import { generateId, round2, formatCurrency } from '../utils';
import { DEFAULT_QUOTE_MESSAGE } from '../defaults';

// ---------------------------------------------------------------- Sinônimos
const SYNONYMS: Record<string, string> = {
  pintar: 'pintura', pinta: 'pintura', pintura: 'pintura', pintando: 'pintura', repintar: 'pintura',
  instalar: 'instalacao', instala: 'instalacao', instalacao: 'instalacao', instalando: 'instalacao',
  montar: 'montagem', monta: 'montagem', montagem: 'montagem',
  consertar: 'reparo', conserta: 'reparo', reparo: 'reparo', concertar: 'reparo',
  manutencao: 'manutencao', manter: 'manutencao', revisao: 'manutencao', revisar: 'manutencao',
  limpar: 'limpeza', limpa: 'limpeza', limpeza: 'limpeza', faxina: 'limpeza', faxinar: 'limpeza',
  trocar: 'troca', troca: 'troca', substituir: 'troca', substituicao: 'troca',
  ar: 'arcondicionado', condicionado: 'arcondicionado', arcondicionado: 'arcondicionado',
  split: 'split', colocar: 'instalacao', colocacao: 'instalacao',
  desentupir: 'desentupimento', desentupimento: 'desentupimento', entupida: 'desentupimento', entupido: 'desentupimento',
  reformar: 'reforma', reforma: 'reforma',
  dedetizar: 'dedetizacao', dedetizacao: 'dedetizacao',
  mudanca: 'mudanca', fretes: 'frete', frete: 'frete',
  portao: 'portao', portas: 'porta', porta: 'porta',
  tinta: 'pintura',
  eletrica: 'eletrica',
  hidraulica: 'hidraulica',
};

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'para', 'com', 'o', 'a', 'os', 'as', 'e', 'ou', 'no', 'na',
  'um', 'uma', 'uns', 'umas', 'por', 'quanto', 'queria', 'gostaria', 'preciso', 'voce', 'voces', 'meu',
  'minha', 'estou', 'seria', 'sobre', 'depois', 'tambem', 'ate', 'ja', 'se', 'que', 'qual', 'tem', 'ter',
  'quero', 'vcs', 'vc', 'obrigado', 'obrigada', 'oi', 'ola', 'bom', 'boa', 'dia', 'tarde', 'noite',
  'fica', 'ficar', 'custa', 'custo', 'valor', 'preco', 'saber', 'pedir', 'pedido', 'orçamento',
  'sem', 'ainda', 'mais', 'menos', 'muito', 'pouco', 'todo', 'toda', 'me', 'te', 'nos',
  'precisando', 'necessito', 'urgente', 'por favor', 'pf', 'obg', 'vou', 'quem', 'sendo', 'ser',
]);

// Palavras que indicam necessidades (para detectar pedidos sem serviço cadastrado)
const NEED_HINTS = new Set([
  'pintura', 'instalacao', 'montagem', 'reparo', 'manutencao', 'limpeza', 'troca',
  'conserto', 'reforma', 'projeto', 'consultoria', 'dedetizacao', 'mudanca', 'frete',
  'desentupimento', 'eletrica', 'hidraulica',
]);

// Números por extenso
const NUM_WORDS: Record<string, number> = {
  'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'tres': 3, 'quatro': 4, 'cinco': 5,
  'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10, 'onze': 11, 'doze': 12,
  'treze': 13, 'quatorze': 14, 'catorze': 14, 'quinze': 15, 'dezesseis': 16,
  'dezessete': 17, 'dezoito': 18, 'dezenove': 19, 'vinte': 20, 'trinta': 30,
  'quarenta': 40, 'cinquenta': 50, 'sessenta': 60, 'setenta': 70, 'oitenta': 80,
  'noventa': 90, 'cem': 100, 'cento': 100, 'duzentos': 200, 'trezentos': 300,
  'quatrocentos': 400, 'quinhentos': 500, 'seiscentos': 600, 'setecentos': 700,
  'oitocentos': 800, 'novecentos': 900, 'mil': 1000,
};

// ---------------------------------------------------------------- Normalização
function normalizeForMatch(input: string): string {
  let s = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // "12.000" / "12,000" → "12000" (separador de milhar)
  s = s.replace(/(\d)[.,](\d{3})\b/g, '$1$2');
  // "12 mil" → "12000" (valores por extenso)
  s = s.replace(/(\d+)\s*(?:mil|milhar)\b/g, (_, num) => `${parseInt(num, 10)}000`);
  // números por extenso antes de unidades ("vinte metros quadrados", "duas portas")
  s = expandNumberWords(s);
  // (o "2x" é tratado em extractQuantities — não remover aqui, senão some)
  // remove pontuação e espaços repetidos
  s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

const NUM_WORDS_KEYS = Object.keys(NUM_WORDS).join('|');
const UNITS_CONTEXT =
  'metros? quadrados?|m2s?|m²|metros? lineares?|portas?|janelas?|quartos?|comodos?|ambientes?|banheiros?|andares?|horas?|dias?|diarias?|pecas?|unidades?|splits?|aparelhos?|veiculos?|carros?|motos?|pneus?|meses?|semanas?|servicos?|projetos?|visitas?|tomadas?|pontos?';

function wordToNumber(w: string): number | null {
  const parts = w.split(/\s+e\s+/);
  let total = 0;
  for (const part of parts) {
    const words = part.split(/\s+/);
    if (words.length === 1) {
      const v = NUM_WORDS[part];
      if (v == null) return null;
      total += v;
    } else if (words.length === 2) {
      const [a, b] = words;
      if (NUM_WORDS[a] != null && b === 'mil') {
        total += NUM_WORDS[a] * 1000;
      } else if (NUM_WORDS[a] != null && NUM_WORDS[b] != null) {
        total += NUM_WORDS[a] + NUM_WORDS[b];
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  return total > 0 ? total : null;
}

function expandNumberWords(s: string): string {
  const re = new RegExp(
    `\\b(vinte e cinco|vinte e quatro|vinte e tres|vinte e dois|vinte e um|vinte e nove|vinte e oito|vinte e sete|vinte e seis|trinta e cinco|trinta e quatro|trinta e tres|trinta e dois|trinta e um|quarenta e cinco|quarenta e quatro|quarenta e tres|quarenta e dois|quarenta e um|cinquenta e cinco|cinquenta e quatro|cinquenta e tres|cinquenta e dois|cinquenta e um|sessenta e cinco|sessenta e quatro|sessenta e tres|sessenta e dois|sessenta e um|${NUM_WORDS_KEYS})\\s*(${UNITS_CONTEXT})`,
    'g',
  );
  return s.replace(re, (_m, numWord: string, unit: string) => {
    const n = wordToNumber(numWord);
    if (n == null) return `${numWord} ${unit}`;
    return `${n} ${unit}`;
  });
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

// ---------------------------------------------------------------- Fuzzy (typos)
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function tokensMatch(msgToken: string, nameToken: string): boolean {
  if (msgToken === nameToken) return true;
  // Números casam APENAS exatamente (evita "12000" casar com "18000")
  if (isNumberToken(msgToken) || isNumberToken(nameToken)) return false;
  if (msgToken.length < 4 || nameToken.length < 4) return false;
  const dist = levenshtein(msgToken, nameToken);
  if (dist <= 1) return true;
  if (dist <= 2 && nameToken.length >= 7) return true;
  return false;
}

// ---------------------------------------------------------------- Quantidades
interface QtyMatch {
  qty: number;
  unit: string | null; // null = genérica (ex.: "2x")
  raw: string;
  pos: number;
}

const QTY_PATTERNS: { re: RegExp; unit: string | null }[] = [
  { re: /(\d+(?:[,.]\d+)?)\s*(?:metros? quadrados?|m2s?|m²|metro quadrado)/g, unit: 'metro quadrado' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:metros? lineares?|m linear)/g, unit: 'metro linear' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:horas?)/g, unit: 'hora' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:dias?|diarias?)/g, unit: 'diária' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:pecas?)/g, unit: 'peça' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:unidades?)/g, unit: 'unidade' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:portas?|janelas?|comodos?|ambientes?|quartos?|banheiros?|andares?|tomadas?|pontos?)/g, unit: 'unidade' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:veiculos?|carros?|motos?|pneus?)/g, unit: 'unidade' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:aparelhos?|splits?)/g, unit: 'unidade' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:meses?|semanas?)/g, unit: 'mês' },
  { re: /(\d+(?:[,.]\d+)?)\s*(?:servicos?|projetos?|visitas?)/g, unit: 'serviço' },
  // "2x" / "3×" — quantidade genérica compatível com qualquer unidade
  { re: /(\d+(?:[,.]\d+)?)\s*[x×]\s*/g, unit: null },
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

  const matched = nameTokens.filter((t) => [...msgTokens].some((mt) => tokensMatch(mt, t)));
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
    return nameNumbers.length === matchedNumbers.length
      ? { service, score: 3, matchedTokens: matched, exact: false, reject: false }
      : { service, score: 0, matchedTokens: [], exact: false, reject: true };
  }

  // Mensagens curtas: se o número do modelo bateu, aceita com poucas palavras
  // ("12 mil btus" → sugere só o de 12.000; "ar 12000" → idem)
  if (nameNumbers.length > 0 && matchedNumbers.length === nameNumbers.length && nonNumberMatched.length >= 1) {
    return { service, score: 2.5 + nonNumberMatched.length, matchedTokens: matched, exact: false, reject: false };
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

  // Remove serviços genéricos quando existe um mais específico com o mesmo conceito
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
    if (q.unit === null) continue; // "2x" genérico não vira "missing"
    const hasCompatible = items.some((it) => unitsCompatible(it.unit, q.unit ?? ''));
    if (!hasCompatible && !missing.includes(`${q.raw} (${q.unit})`)) {
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

/** Posição do serviço na mensagem: posição da última palavra significativa do nome. */
function itemPosition(it: QuoteItem, normalizedMessage: string): number {
  const tokens = tokenize(normalizeForMatch(it.name)).filter((t) => !isNumberToken(t));
  if (tokens.length === 0) return -1;
  const positions = tokens.map((t) => normalizedMessage.lastIndexOf(t)).filter((p) => p !== -1);
  if (positions.length === 0) return -1;
  return Math.max(...positions);
}

/** Associa quantidades por matching ótimo (menor distância no texto). */
function assignQuantities(items: QuoteItem[], normalizedMessage: string, quantities: QtyMatch[]): boolean {
  if (quantities.length === 0) {
    for (const it of items) it.observations = 'quantidade presumida: 1';
    return items.length > 0;
  }

  const pairs: { itemIdx: number; qtyIdx: number; dist: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const pos = itemPosition(items[i], normalizedMessage);
    if (pos === -1) continue;
    for (let j = 0; j < quantities.length; j++) {
      const q = quantities[j];
      const compatible = q.unit === null || unitsCompatible(items[i].unit, q.unit);
      if (!compatible) continue;
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
  const names = items.map((i) => `${i.name} (${i.quantity} × ${formatCurrency(i.price)})`).join(', ');
  const estimated = round2(items.reduce((acc, it) => acc + it.quantity * it.price, 0));
  let base = `Identifiquei ${items.length} serviço${items.length > 1 ? 's' : ''}: ${names}.`;
  base += ` Total estimado: ${formatCurrency(estimated)}.`;
  if (missing.length > 0) {
    base += ` Não encontrei no catálogo: ${missing.join(', ')} — confirme com o cliente antes de enviar.`;
  } else {
    base += ' Revise e envie.';
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
