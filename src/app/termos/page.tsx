import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos de Uso e condições de uso do OrçaAI.',
  robots: { index: true, follow: true },
};

const UPDATED = '09 de setembro de 2026';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
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
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Termos de Uso</h1>
        <p className="mt-2 text-sm text-ink-500">Última atualização: {UPDATED}</p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink-700">
          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">1. Aceitação dos termos</h2>
            <p>
              Ao criar uma conta ou utilizar o OrçaAI, você concorda com estes Termos de Uso e com a nossa{' '}
              <Link href="/privacidade" className="font-medium text-brand-600 underline">
                Política de Privacidade
              </Link>
              . Se não concordar, não utilize a plataforma.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">2. O serviço</h2>
            <p>
              O OrçaAI oferece ferramentas para criação, envio e gestão de orçamentos, cadastro de serviços e clientes,
              acompanhamento (follow-up), pipeline de vendas e recebimento de pagamentos por meio de parceiros de
              pagamento. As funcionalidades disponíveis variam conforme o plano contratado.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">3. Sua conta</h2>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>Você é responsável por manter suas credenciais em sigilo e pela atividade na sua conta.</li>
              <li>Você deve ter capacidade legal para contratar e fornecer dados verdadeiros no cadastro.</li>
              <li>Você é responsável pelos conteúdos que cadastra (serviços, preços, clientes e orçamentos) e deve ter
                autorização para tratar os dados desses clientes.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">4. Planos, assinatura e pagamento</h2>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>O plano Grátis possui limites de uso descritos na página de Planos.</li>
              <li>Os planos Pro e Business são assinaturas mensais processadas pelo Mercado Pago (Pix, cartão ou boleto).</li>
              <li>O plano é ativado após a confirmação do pagamento.</li>
              <li>Você pode cancelar quando quiser; ao cancelar, os recursos pagos deixam de estar disponíveis ao fim
                do acesso e a conta volta ao plano Grátis.</li>
              <li>Fazer upgrade ou downgrade pode ser feito pela página de Planos.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">5. Recebimento de pagamentos pelo link</h2>
            <p>
              Ao ativar o recebimento pelo link público de orçamento, você conecta sua conta no Mercado Pago. Os
              pagamentos feitos pelos seus clientes são processados pelo Mercado Pago conforme os termos deles. Nos
              planos Grátis é aplicada uma taxa de 2% sobre os valores recebidos; nos planos Pro e Business a taxa é de
              0%. O OrçaAI não se responsabiliza por disputas entre você e seus clientes relativas ao serviço prestado.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">6. Uso aceitável</h2>
            <p>Você concorda em não utilizar a plataforma para:</p>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>Atividades ilegais ou que infrinjam direitos de terceiros;</li>
              <li>Tentar acessar dados de outras contas ou comprometer a segurança do serviço;</li>
              <li>Práticas fraudulentas, enganosas ou de spam;</li>
              <li>Publicar conteúdo ofensivo, discriminatório ou ilegal.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">7. IA e orçamentos</h2>
            <p>
              O recurso de IA sugere itens de orçamento com base exclusivamente nos serviços e preços que você
              cadastrou — o OrçaAI não inventa preços. Você é o responsável pela revisão e pelo conteúdo final dos
              orçamentos enviados.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">8. Disponibilidade e alterações</h2>
            <p>
              Buscamos manter o serviço disponível e estável, mas não garantimos disponibilidade ininterrupta. Podemos
              melhorar, alterar ou descontinuar funcionalidades a qualquer momento, mediante aviso quando razoavelmente
              possível.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">9. Limitação de responsabilidade</h2>
            <p>
              O OrçaAI fornece a plataforma “no estado em que se encontra”. Na máxima permitida por lei, não somos
              responsáveis por lucros cessantes ou danos indiretos decorrentes do uso ou da impossibilidade de uso do
              serviço, inclusive por decisões comerciais tomadas a partir dos orçamentos criados.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">10. Rescisão</h2>
            <p>
              Você pode encerrar sua conta a qualquer momento. Podemos suspender ou encerrar o acesso em caso de
              violação destes Termos, uso indevido ou inatividade prolongada, mediante aviso quando aplicável.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">11. Legislação aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de
              São Paulo/SP para dirimir controvérsias, sem prejuízo de outras competências legais.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-ink-900">12. Contato</h2>
            <p>
              Dúvidas sobre estes Termos: <a href="mailto:suporte@orcaaii.com" className="font-medium text-brand-600 underline">suporte@orcaaii.com</a>.
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
