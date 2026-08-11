import type { CompanySettings } from './types';

/** Configurações padrão de uma empresa recém-criada. */
export const DEFAULT_SETTINGS: CompanySettings = {
  quoteValidityDays: 7,
  defaultMessage: '',
  defaultNotes: '',
  terms: 'Este orçamento é uma estimativa e não constitui contrato. Valores podem sofrer ajustes conforme a necessidade de materiais adicionais não previstos em visita técnica.',
  showLogo: true,
  showPhone: true,
  showEmail: true,
  showAddress: true,
  showCnpj: false,
  showSignature: true,
  signatureName: '',
  accentColor: '#4f46e5',
};

/** Mensagem padrão usada quando a empresa não personaliza (suporta placeholders). */
export const DEFAULT_QUOTE_MESSAGE = `Olá, {{customer}}!

Preparei seu orçamento:

{{items}}

Total: {{total}}

O orçamento é válido por {{validity}} dias.

Se estiver tudo certo, posso agendar o serviço para você.

Obrigado,
{{company}}`;

/** Termos padrão exibidos no PDF. */
export const DEFAULT_TERMS =
  '1. Este orçamento tem validade conforme indicado no documento.\n2. O pagamento pode ser feito via Pix, transferência ou cartão.\n3. Os serviços serão executados conforme combinado, com garantia por escrito quando aplicável.\n4. Materiais não incluídos serão informados antes do início do serviço.';
