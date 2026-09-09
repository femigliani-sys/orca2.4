import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Política de Privacidade do OrçaAI em conformidade com a Lei Geral de Proteção de Dados (LGPD).',
  robots: { index: true, follow: true },
};

const DATA_UPDATED = '09 de setembro de 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header simples */}
      <header className="border-b border-ink-100">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="OrçaAI — início">
            <Logo />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm font-medium text-brand-600">Documento legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-ink-500">
          Última atualização: {DATA_UPDATED} · Em conformidade com a Lei nº 13.709/2018 (LGPD)
        </p>

        <div className="prose mt-8 max-w-none space-y-8 text-[15px] leading-relaxed text-ink-700">
          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">1. Quem somos</h2>
            <p>
              O <strong>OrçaAI</strong> é uma plataforma que ajuda pequenos negócios e profissionais autônomos a criar,
              gerenciar e enviar orçamentos. Esta Política explica como tratamos os dados pessoais de quem usa a
              plataforma (clientes dos nossos usuários e visitantes do site), respeitando a LGPD.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">2. Dados que coletamos</h2>
            <p>Podemos coletar os seguintes dados pessoais:</p>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <strong>Cadastro:</strong> nome, nome da empresa, e-mail e senha (armazenada de forma protegida),
                tipo de negócio.
              </li>
              <li>
                <strong>Empresa:</strong> dados informados pelo usuário sobre o próprio negócio (telefone, WhatsApp,
                endereço, CNPJ, logo e configurações).
              </li>
              <li>
                <strong>Clientes dos usuários:</strong> dados que o usuário cadastra a respeito dos seus clientes
                (nome, telefone, e-mail e histórico de orçamentos). Tratamos esses dados em nome do usuário, que é o
                responsável por eles.
              </li>
              <li>
                <strong>Uso do site:</strong> cookies técnicos necessários ao funcionamento (por exemplo, manter sua
                sessão) e, quando você autorizar, cookies de medição.
              </li>
              <li>
                <strong>Pagamentos:</strong> processados diretamente pelo Mercado Pago — não armazenamos dados de
                cartão. Recebemos apenas a confirmação e dados básicos da transação.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">3. Para que usamos seus dados</h2>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>Criar e manter sua conta e o cadastro da sua empresa;</li>
              <li>Permitir a criação, envio e gestão de orçamentos;</li>
              <li>Processar assinaturas e pagamentos (com apoio do Mercado Pago);</li>
              <li>Enviar comunicações essenciais (confirmação de e-mail, recuperação de senha, avisos de pagamento);</li>
              <li>Melhorar a segurança e o funcionamento da plataforma;</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">4. Base legal</h2>
            <p>
              Tratamos dados pessoais com base no consentimento do titular (cadastro), na execução do contrato de uso
              da plataforma, no legítimo interesse (segurança e melhoria do serviço) e no cumprimento de obrigação
              legal, conforme aplicável.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">5. Cookies e tecnologias similares</h2>
            <p>
              Utilizamos cookies e tecnologias semelhantes para o funcionamento correto da plataforma. Você controla as
              preferências pelo aviso de cookies exibido no site:
            </p>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <strong>Essenciais:</strong> necessários para você entrar na sua conta, manter a sessão e usar a
                plataforma. Sempre ativos.
              </li>
              <li>
                <strong>Analytics/preferências:</strong> usados somente com a sua autorização (ex.: para entendermos
                como o site é usado e melhorarmos o produto).
              </li>
            </ul>
            <p>
              Você pode alterar ou revogar o consentimento a qualquer momento pelo banner de cookies (no rodapé das
              páginas) ou pelas configurações do seu navegador.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">6. Compartilhamento de dados</h2>
            <p>
              Não vendemos dados pessoais. Compartilhamos dados apenas com operadores essenciais ao serviço, como:
            </p>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <strong>Mercado Pago:</strong> processamento de pagamentos e assinaturas (seus dados de pagamento são
                tratados por eles);
              </li>
              <li>
                <strong>Provedores de infraestrutura</strong> (hospedagem, banco de dados e envio de e-mails), que
                atuam conforme nossas instruções;
              </li>
              <li>
                Autoridades públicas, quando exigido por lei ou ordem judicial.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">7. Segurança dos dados</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger os dados pessoais, incluindo criptografia de
              senhas, conexões seguras (HTTPS) e controle de acesso com isolamento entre contas (cada usuário acessa
              somente os próprios dados). Acesso, autenticação e camadas de proteção são revisados continuamente.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">8. Retenção</h2>
            <p>
              Mantemos os dados enquanto sua conta estiver ativa ou pelo tempo necessário para cumprir obrigações
              legais. Ao excluir sua conta, apagamos ou anonimizamos os dados pessoais, exceto aqueles que a lei exige
              manter.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">9. Seus direitos como titular (LGPD)</h2>
            <p>Você pode solicitar, a qualquer momento:</p>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>Confirmação da existência de tratamento e acesso aos seus dados;</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
              <li>Portabilidade dos dados a outro fornecedor, nos termos da lei;</li>
              <li>Eliminação dos dados tratados com base no seu consentimento;</li>
              <li>Informação sobre compartilhamento realizado;</li>
              <li>Revogação do consentimento.</li>
            </ul>
            <p>
              Para exercer seus direitos, entre em contato pelo e-mail indicado na seção 11. Atenderemos no prazo legal.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">10. Dados de clientes do usuário</h2>
            <p>
              Quando um usuário cadastra clientes na plataforma, esses dados são tratados pelo OrçaAI como operador, em
              nome do usuário (controlador). O usuário é responsável por informar seus clientes sobre o tratamento e
              obter as autorizações necessárias. O link público de um orçamento expõe somente aquele documento e não os
              demais dados do usuário.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">11. Contato e Encarregado (DPO)</h2>
            <p>
              Para dúvidas, solicitações ou reclamações sobre esta Política ou sobre o tratamento de dados pessoais,
              fale com nosso Encarregado pelo e-mail:{' '}
              <a href="mailto:privacidade@orcaaii.com" className="font-medium text-brand-600 underline">
                privacidade@orcaaii.com
              </a>
              .
            </p>
            <p>
              Você também pode registrar reclamação na Autoridade Nacional de Proteção de Dados (ANPD).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">12. Alterações desta Política</h2>
            <p>
              Podemos atualizar esta Política periodicamente. A versão vigente estará sempre disponível nesta página,
              com a data da última atualização. Ao continuar usando a plataforma após a publicação de alterações, você
              as aceita.
            </p>
          </section>
        </div>

        <div className="mt-10 border-t border-ink-100 pt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
            <ArrowLeft className="size-4" /> Voltar para o site
          </Link>
        </div>
      </main>
    </div>
  );
}
