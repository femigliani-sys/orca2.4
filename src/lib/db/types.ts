import type {
  Company,
  Customer,
  FollowUp,
  GeneratedMessage,
  Notification,
  Payment,
  PaymentAccount,
  PlanId,
  Quote,
  QuoteInput,
  QuotePayment,
  QuoteStatus,
  Service,
  Subscription,
  User,
} from '../types';

/**
 * Interface única de persistência.
 * Duas implementações: Supabase (produção) e Local (modo demonstração).
 * O resto da aplicação nunca importa a implementação diretamente.
 */
export interface DB {
  // --------------------------------------------------------- Auth
  signUp(input: {
    name: string;
    companyName: string;
    email: string;
    password: string;
    businessType: string;
  }): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  /**
   * Troca o código da URL (link de recuperação/confirmação, fluxo PKCE)
   * por uma sessão válida. Só faz efeito no modo Supabase.
   */
  exchangeCodeForSession(code: string): Promise<void>;
  /** Define a nova senha da sessão atual (após recuperação confirmada). */
  updatePassword(newPassword: string): Promise<void>;
  /** Reenvia o e-mail de confirmação de cadastro (Supabase aplica rate limit). */
  resendConfirmation(email: string): Promise<void>;
  getSession(): Promise<{ userId: string | null }>;
  getCurrentUser(): Promise<User | null>;
  onSessionChange(cb: () => void): () => void;

  // --------------------------------------------------------- Empresa
  getCompany(): Promise<Company | null>;
  updateCompany(patch: Partial<Company>): Promise<Company>;
  completeOnboarding(patch: Partial<Company>): Promise<void>;
  uploadLogo(file: File): Promise<string>;

  // --------------------------------------------------------- Serviços
  listServices(): Promise<Service[]>;
  createService(input: Omit<Service, 'id' | 'companyId' | 'createdAt'>): Promise<Service>;
  updateService(id: string, patch: Partial<Service>): Promise<Service>;
  deleteService(id: string): Promise<void>;
  duplicateService(id: string): Promise<Service>;
  toggleService(id: string, active: boolean): Promise<Service>;

  // --------------------------------------------------------- Clientes
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  createCustomer(input: Partial<Customer>): Promise<Customer>;
  updateCustomer(id: string, patch: Partial<Customer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;

  // --------------------------------------------------------- Orçamentos
  listQuotes(): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | null>;
  createQuote(input: QuoteInput): Promise<Quote>;
  updateQuoteStatus(id: string, status: QuoteStatus): Promise<Quote>;
  updateQuote(id: string, patch: Partial<Quote>): Promise<Quote>;
  markViewed(id: string): Promise<void>;
  deleteQuote(id: string): Promise<void>;

  // --------------------------------------------------------- Follow-ups
  listFollowUps(): Promise<FollowUp[]>;
  createFollowUp(input: { quoteId: string; scheduledFor: string; notes?: string }): Promise<FollowUp>;
  completeFollowUp(id: string): Promise<void>;
  deleteFollowUp(id: string): Promise<void>;

  // --------------------------------------------------------- Notificações
  listNotifications(): Promise<Notification[]>;
  markAllNotificationsRead(): Promise<void>;
  markNotificationRead(id: string): Promise<void>;
  addNotification(input: Omit<Notification, 'id' | 'companyId' | 'createdAt' | 'read'>): Promise<void>;

  // --------------------------------------------------------- Mensagens
  listMessages(quoteId: string): Promise<GeneratedMessage[]>;
  createMessage(input: { quoteId: string; body: string; channel: GeneratedMessage['channel'] }): Promise<GeneratedMessage>;

  // --------------------------------------------------------- Assinatura
  getSubscription(): Promise<Subscription | null>;
  setPlan(plan: PlanId): Promise<void>;
  /** Lista o histórico de pagamentos da empresa. */
  listPayments(): Promise<Payment[]>;
  /** Cancela a assinatura (plano volta para free). */
  cancelSubscription(): Promise<void>;
  /**
   * Inicia um checkout.
   * - Modo demonstração: retorna { simulated: true } e registra a compra pendente.
   * - Modo Supabase: o navegador NÃO usa este método (o checkout é feito pela
   *   API route /api/billing/checkout, que chama o Mercado Pago).
   */
  startCheckout(input: { plan: PlanId }): Promise<{ simulated: boolean; checkoutId?: string }>;
  /** Conclui um checkout simulado (modo demonstração). */
  completeCheckout(input: { checkoutId: string }): Promise<void>;

  // --------------------------------------------------------- Pagamentos de orçamento (link público)
  /** Conta de pagamento (Mercado Pago) conectada do vendedor. */
  getPaymentAccount(): Promise<PaymentAccount | null>;
  /** Marca a conta como conectada (modo demo simula; produção via OAuth no servidor). */
  connectPaymentAccount(input: Partial<PaymentAccount>): Promise<PaymentAccount>;
  disconnectPaymentAccount(): Promise<void>;
  /** Lista pagamentos recebidos via link público (de todos os orçamentos). */
  listQuotePayments(quoteId?: string): Promise<QuotePayment[]>;
}
