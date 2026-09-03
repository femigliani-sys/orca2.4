# OrçaAI

> **Transforme pedidos de orçamento em vendas.**
> Crie orçamentos profissionais em segundos, acompanhe seus clientes e nunca esqueça um follow-up.

SaaS brasileiro para pequenos prestadores de serviço (eletricistas, encanadores, pintores, técnicos,
marceneiros, empresas de limpeza, fotógrafos, designers e afins) criarem, gerenciarem e enviarem
orçamentos profissionais — com IA que interpreta a mensagem do cliente e usa **apenas os serviços e
preços cadastrados pela própria empresa**.

---

## ✨ Funcionalidades (MVP)

- **Landing page** de alta conversão com demo interativa da IA
- **Cadastro / login / recuperação de senha** com proteção de rotas privadas
- **Onboarding** em 3 passos (empresa → tipo de negócio → primeiros serviços)
- **Dashboard** com KPIs (enviados, pendentes, aprovados, valor vendido, conversão), gráfico
  7/30/90 dias e atividade recente
- **Gerador de orçamento** com múltiplos serviços, desconto, validade e observações
- **IA "Gerar com IA"**: cola a mensagem do cliente → identifica serviços, quantidades e preços
  do catálogo → **nunca inventa preços** (pede confirmação quando não tem certeza).
  A IA local entende números por extenso ("vinte metros quadrados"), quantidades com "2x",
  erros de digitação, "12 mil BTUs" (seleciona o modelo exato) e calcula o total estimado.
- **Mensagem pronta** para WhatsApp com botões *Copiar* e *Enviar pelo WhatsApp* (link `wa.me`)
- **PDF profissional** com logo, termos, assinatura e dados da empresa
- **Clientes** com busca, filtros e perfil com histórico completo
- **Follow-ups** automáticos (2 dias após envio) e manuais, com lembretes e atrasos destacados
- **Pipeline de vendas** estilo Kanban com arrastar e soltar
- **Meus serviços** (CRUD, duplicar, ativar/desativar, categorias)
- **Configurações** da empresa, padrões de orçamento e aparência do PDF
- **Planos** (Grátis / Pro R$59 / Business R$99) com preços centralizados em um arquivo
- **Sistema de compra completo**:
  - Página de checkout dedicada (`/app/planos/checkout?plan=pro`) com escolha de **Pix, cartão ou boleto**
  - **Assinatura recorrente mensal** via Mercado Pago (preapproval) com fallback para Checkout Pro
  - Webhook que **ativa o plano automaticamente** ao aprovar e registra o pagamento
  - **Histórico de pagamentos** e **cancelamento de assinatura** em um clique
  - **Modo simulado** (sem chave do MP): fluxo completo testável com aviso claro
- **Suporte**: aba dedicada no painel com central de ajuda (guias rápidos para cada recurso),
  FAQ de resolução de problemas e contato por e-mail/WhatsApp — canais configuráveis via env
  (`NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_SUPPORT_URL`).
- **WhatsApp Business API** (Meta Cloud API): envio direto pela API oficial quando configurada,
  com fallback automático para o link `wa.me`. Inclui webhook de verificação/recepção e aba de
  configuração com teste de envio.
- **Link público do orçamento** (plano Pro+): o cliente abre `https://seu-site/o/[token]`,
  vê o orçamento, baixa o PDF, e **aprova online** — o status muda para "Aprovado" e a
  empresa recebe notificação. Ao abrir o link, o orçamento é marcado como "Visualizado".
  Segurança: acesso via função `security definer` do Postgres (só lê o orçamento do token).
- **Notificações** in-app (follow-ups pendentes, status, pagamento aprovado, limite do plano)

---

## 🚀 Começando (modo demonstração — sem configurar nada)

O OrçaAI roda em **modo demonstração** quando não há variáveis do Supabase: o banco é um
`localStorage` no navegador (com fallback em memória), a autenticação é simulada e a IA usa o
interpretador local (offline). Perfeito para testar o fluxo completo em minutos.

```bash
npm install
npm run dev
# abra http://localhost:3000
```

Fluxo para testar o coração do produto:

1. **Cadastro** → `/auth/cadastro` (nome, empresa, e-mail, senha, tipo de negócio)
2. **Onboarding** → cadastre serviços com preço (ex.: "Pintura de sala — R$ 40/m²")
3. Vá em **Planos** e escolha **Pro** (libera a IA)
4. **Novo orçamento** → cole uma mensagem de cliente → **Gerar com IA** → revise os itens →
   **Criar e enviar** → **Copiar mensagem** / **Enviar pelo WhatsApp** → **Baixar PDF**
5. Acompanhe no **Dashboard**, mude o status e veja o **follow-up** automático em 2 dias

> 💡 Dica: use mensagens reais de pedidos, como
> *"Oi, queria saber quanto fica para pintar uma sala de 20 metros quadrados e também o corredor."*
> ou *"Quanto custa instalar um ar condicionado de 12 mil BTUs?"*

---

## 🏗️ Produção (Supabase + OpenAI + Vercel)

### 1. Banco de dados

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Em **SQL Editor**, execute o arquivo [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   — ele cria todas as tabelas (`companies`, `services`, `customers`, `quotes`, `quote_items`,
   `follow_ups`, `notifications`, `messages`, `subscriptions`), índices, **Row Level Security**
   (cada usuário só enxerga a própria empresa) e o bucket `logos`
3. Ative **Auth > Providers > Email** (o e-mail de confirmação é automático)

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=          # URL do projeto (Settings > API)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # chave pública (anônima)
OPENAI_API_KEY=                    # chave da OpenAI (fica SÓ no servidor)
NEXT_PUBLIC_SITE_URL=https://seu-dominio.vercel.app
# Pagamentos (Mercado Pago — assinatura recorrente + Checkout Pro)
MERCADO_PAGO_ACCESS_TOKEN=
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=
```

> 💳 **Pagamentos:** crie um app em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers)
> e copie o *Access Token* (produção). Com a chave no servidor (`MERCADO_PAGO_ACCESS_TOKEN`), o checkout
> cria uma **assinatura recorrente** (preapproval) — cobrança mensal automática — com fallback para
> pagamento único (Checkout Pro). Configure o webhook do MP para
> `https://SEU-DOMINIO/api/billing/webhook`. Sem a chave, o checkout roda **simulado** (com aviso).
> Migrações necessárias: `0001`, `0002`, `0003`, `0004`, `0005`.

## WhatsApp Business API (opcional)

Com `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` configurados no servidor, o botão
"Enviar pelo WhatsApp" passa a usar a **API oficial da Meta** (sem depender do link wa.me).
Configure o webhook no painel da Meta com a URL `https://SEU-DOMINIO/api/whatsapp/webhook`
e o `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. Sem a configuração, o app usa o link `wa.me` (fallback).
Guia completo em [developers.facebook.com/docs/whatsapp/cloud-api](https://developers.facebook.com/docs/whatsapp/cloud-api).

> Sem `OPENAI_API_KEY` o app usa o interpretador local — o produto continua 100% funcional.

### 3. Deploy na Vercel

```bash
vercel
# ou conecte o repositório no dashboard da Vercel com as env vars acima
```

---

## 🔧 Configuração central de preços

Os planos e preços ficam **centralizados** em [`src/lib/plans.ts`](src/lib/plans.ts).
Para alterar preços/limites, edite apenas esse arquivo:

```ts
{ id: 'pro', price: 59, limits: { quotesPerMonth: null, ai: true, ... } }
```

---

## 🧠 Como a IA funciona (regras importantes)

| Pode | Não pode |
| --- | --- |
| Interpretar mensagens e sugerir serviços do catálogo | Inventar preços |
| Extrair quantidades ("20 metros", "2 portas", "3 horas") | Inventar serviços |
| Gerar textos e mensagens profissionais | Confirmar disponibilidade sem informação |
| Resumir conversas | Prometer prazos não configurados |

- **Modo OpenAI** (`OPENAI_API_KEY` no servidor): o prompt força JSON com o catálogo da empresa e
  o resultado é **revalidado no servidor** contra os preços reais do banco.
- **Modo local** (sem chave): interpretador determinístico baseado no catálogo.
- **Rate limiting**: 10 chamadas/minuto por empresa na API route `/api/ai/interpret`.
- A chave da OpenAI **nunca** sai do servidor (o frontend chama apenas `/api/ai/interpret`).

---

## 🗂️ Estrutura do projeto

```
src/
├── app/                     # Rotas (App Router)
│   ├── page.tsx             # Landing page
│   ├── (auth)/auth/         # login · cadastro · recuperar-senha
│   ├── (app)/app/           # painel privado (dashboard, orçamentos, clientes, pipeline, ...)
│   ├── onboarding/          # onboarding em 3 passos
│   └── api/                 # API routes (ai/interpret, billing/webhook)
├── components/
│   ├── ui/                  # primitivos estilo shadcn/ui (button, dialog, select, ...)
│   ├── layout/              # app shell, guard de auth, sino de notificações
│   ├── quotes/              # editor de itens, painel de IA, mensagem, ...
│   ├── dashboard/           # KPIs, gráfico, atividade recente
│   └── landing/             # seções da landing + demo interativa
├── lib/
│   ├── db/                  # interface DB + implementações local (demo) e Supabase (prod)
│   ├── ai/                  # interpretador local + OpenAI (servidor) + templates
│   ├── pdf.ts               # gerador de PDF (jsPDF)
│   ├── plans.ts             # planos e preços centralizados
│   ├── supabase.ts / supabase-server.ts
│   └── ...                  # utils, constantes, validação (zod), rate-limit
├── middleware.ts            # proteção de rotas no servidor (modo Supabase)
supabase/migrations/0001_init.sql   # schema completo com RLS
```

**Separação de responsabilidades:** componentes não falam com o banco diretamente nas páginas;
toda persistência passa pela interface `DB` em `src/lib/db/types.ts`. O modo demonstração e o
modo produção implementam a mesma interface — a troca é transparente.

---

## 🔒 Segurança

- **Row Level Security**: cada tabela tem políticas que exigem que a empresa seja do usuário logado
- Autenticação via **Supabase Auth** (senha com hash, nunca transita pelo nosso código)
- **Middleware** protege `/app` e `/api` no servidor; guard client-side cobre o modo demo
- **API routes** com validação **zod**, sanitização e **rate limiting**
- **Chaves secretas** apenas no servidor (`OPENAI_API_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`)
- Headers de segurança (`nosniff`, `X-Frame-Options`, etc.) nas rotas de API
- Erros amigáveis e mensagens de confirmação antes de ações destrutivas

---

## 🛣️ Próximos passos (pós-MVP)

- [x] Sistema de compra com **Mercado Pago** (assinatura recorrente, checkout, histórico e cancelamento)
- [ ] Assinaturas recorrentes automáticas (renovação mensal sem ação do usuário)
- [ ] **WhatsApp Business API** (Cloud API) para envio oficial e templates
- [ ] Múltiplos usuários e permissões (plano Business)
- [ ] Automações de follow-up e relatórios avançados
- [ ] Links públicos de orçamento com confirmação de visualização ("Visualizado")
- [ ] Registro de pagamentos recebidos por orçamento

---

## 🧰 Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui (Radix) · Lucide Icons ·
Supabase (PostgreSQL + Auth + Storage + RLS) · OpenAI API · jsPDF · Recharts · Zod ·
Mercado Pago · Deploy: Vercel
