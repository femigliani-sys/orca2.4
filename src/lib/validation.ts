import { z } from 'zod';

/** Schemas de validação (zod) — usados nas API routes e em pontos sensíveis. */

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  companyName: z.string().trim().min(2, 'Informe o nome da empresa.').max(120),
  email: z.string().trim().email('E-mail inválido.').max(200),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.').max(72),
  businessType: z.string().trim().min(2).max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido.').max(200),
  password: z.string().min(1, 'Informe a senha.').max(72),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('E-mail inválido.').max(200),
});

export const aiInterpretSchema = z.object({
  message: z.string().trim().min(3, 'Mensagem muito curta.').max(4000),
});

export const quoteItemSchema = z.object({
  serviceId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(500).optional(),
  quantity: z.number().min(0.01).max(1_000_000),
  unit: z.string().trim().min(1).max(50),
  price: z.number().min(0).max(100_000_000),
  observations: z.string().max(500).optional(),
});

export const quoteCreateSchema = z.object({
  customerId: z.string().nullable().optional(),
  customerName: z.string().trim().min(1, 'Informe o nome do cliente.').max(200),
  customerPhone: z.string().max(30).optional(),
  customerEmail: z.string().email('E-mail do cliente inválido.').max(200).optional().or(z.literal('')),
  status: z.enum(['rascunho', 'enviado', 'visualizado', 'negociacao', 'aprovado', 'recusado', 'expirado']),
  items: z.array(quoteItemSchema).min(1, 'Adicione pelo menos um serviço.'),
  discount: z.number().min(0).max(1_000_000).default(0),
  validityDays: z.number().int().min(1).max(365).default(7),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(4000).optional(),
  sourceMessage: z.string().max(4000).optional(),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do serviço.').max(200),
  description: z.string().max(500).optional().default(''),
  price: z.number().min(0, 'Informe um preço válido.'),
  unit: z.string().trim().min(1).max(50),
  category: z.string().trim().min(1).max(80).default('Outros'),
  durationMinutes: z.number().int().positive().nullable().optional(),
  observations: z.string().max(500).optional(),
  active: z.boolean().default(true),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do cliente.').max(200),
  phone: z.string().max(30).optional().default(''),
  email: z.string().email('E-mail inválido.').max(200).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().default(''),
});

export const followUpSchema = z.object({
  quoteId: z.string().min(1),
  scheduledFor: z.string().min(1, 'Informe a data do follow-up.'),
  notes: z.string().max(500).optional().default(''),
});
