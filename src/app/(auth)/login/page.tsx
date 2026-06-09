import type { CSSProperties, ComponentType } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  Banknote,
  BarChart3,
  Boxes,
  ChevronRight,
  Clock3,
  FileCheck2,
  Gamepad2,
  Layers3,
  LockKeyhole,
  MessageCircle,
  MonitorSmartphone,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  TicketPercent,
  Tv,
  WalletCards,
} from "lucide-react";

import {
  buildBrandThemeVariables,
  getBrandCustomizationSnapshot,
} from "@/application/customization/brand-customization-service";
import { buildTenantAdminPath } from "@/application/platform/platform-service";
import { BrandLogo } from "@/components/admin/brand-logo";
import { LoginForm } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

type FeatureItem = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

type StepItem = {
  title: string;
  description: string;
};

const modules: FeatureItem[] = [
  {
    icon: ReceiptText,
    title: "PDV rapido e comandas",
    description: "Venda direta, comanda avulsa, cupom, multiplos pagamentos e comprovante pronto para impressora termica.",
  },
  {
    icon: Banknote,
    title: "Caixa de verdade",
    description: "Abertura, operador, suprimento, sangria, fechamento e relatorio resumido para conferir o dia.",
  },
  {
    icon: Boxes,
    title: "Estoque e XML",
    description: "Entrada por XML, produto fracionado, perda, receitas, baixa automatica e log para saber o que mudou.",
  },
  {
    icon: FileCheck2,
    title: "Fiscal sem gambiarra",
    description: "NFC-e, XML, DANFE, configuracao Focus NFe por cliente e ambiente de homologacao ou producao.",
  },
  {
    icon: Gamepad2,
    title: "Servicos por tempo",
    description: "PS5, simulador, sinuca ou qualquer servico por minuto, com tempo livre, pausa, cancelamento e cobranca.",
  },
  {
    icon: BarChart3,
    title: "Relatorios claros",
    description: "Vendas, lucro, caixa, Pix, dinheiro, credito, debito, itens vendidos e envio do resumo pelo WhatsApp.",
  },
];

const reasons: FeatureItem[] = [
  {
    icon: Layers3,
    title: "Nao e um PDV generico",
    description: "Ele junta bar, estoque, fiscal, comandas e servicos por tempo no mesmo fluxo operacional.",
  },
  {
    icon: ShieldCheck,
    title: "Conta isolada por cliente",
    description: "Cada cliente aprovado pode operar com dados, produtos, vendas e configuracoes fiscais separados.",
  },
  {
    icon: Sparkles,
    title: "Menos tela, mais acao",
    description: "A interface mostra a etapa certa na hora certa, reduzindo bagunca visual no caixa.",
  },
];

const steps: StepItem[] = [
  {
    title: "Crie a conta",
    description: "O cadastro entra para aprovacao e prepara a base do cliente com ambiente separado.",
  },
  {
    title: "Configure a operacao",
    description: "Cadastre produtos, categorias, estoque, fiscal, formas de pagamento e servicos por tempo.",
  },
  {
    title: "Venda e acompanhe",
    description: "Abra o caixa, venda, imprima tickets, controle estornos e veja relatorios sem planilha paralela.",
  },
];

const conversionPoints = [
  "Reduz erro de caixa porque venda, pagamento e fechamento ficam conectados.",
  "Ajuda a evitar estoque fantasma com entrada por XML, perdas e baixa automatica.",
  "Economiza tempo no fiscal com XML, DANFE e configuracao Focus NFe dentro do sistema.",
  "Vende servico por tempo sem depender de controle manual fora do PDV.",
];

function ProductScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(112deg,#11090d_0%,#160b10_42%,#351209_100%)]" />
      <div className="absolute left-1/2 top-24 hidden h-[620px] w-[1100px] -translate-x-[18%] rounded-[2rem] border border-white/10 bg-black/35 shadow-[0_80px_180px_-95px_rgba(255,0,92,0.85)] backdrop-blur-sm lg:block" />
      <div className="absolute right-[-120px] top-28 hidden w-[760px] rotate-[-2deg] rounded-[1.25rem] border border-white/10 bg-[#111111]/95 p-4 shadow-[0_44px_140px_-70px_rgba(0,0,0,0.95)] lg:block">
        <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-primary">Painel operacional</p>
            <p className="mt-1 text-xl font-black text-white">Resumo do caixa</p>
          </div>
          <div className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
            Caixa aberto
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Vendido", "R$ 2.840,50"],
            ["Pix", "R$ 920,00"],
            ["Dinheiro", "R$ 430,00"],
            ["Ticket", "R$ 37,86"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/45">{label}</p>
              <p className="mt-3 text-lg font-black text-white">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.15fr,0.85fr]">
          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
            <div className="mb-3 flex items-center justify-between text-xs text-white/50">
              <span>Vendas por forma</span>
              <span>Hoje</span>
            </div>
            <div className="space-y-2">
              {[
                ["Pix", "72%"],
                ["Debito", "54%"],
                ["Credito", "38%"],
                ["Dinheiro", "24%"],
              ].map(([label, width]) => (
                <div key={label} className="grid grid-cols-[70px,1fr] items-center gap-2 text-xs text-white/65">
                  <span>{label}</span>
                  <div className="h-2 rounded-full bg-white/8">
                    <div className="h-full rounded-full bg-primary" style={{ width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary">Servico ativo</p>
            <p className="mt-3 text-lg font-black text-white">TV 02 - Simulador</p>
            <p className="mt-1 text-sm text-white/55">Tempo livre pago</p>
            <div className="mt-4 h-2 rounded-full bg-white/10">
              <div className="h-full w-3/5 rounded-full bg-emerald-300" />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-8 left-8 hidden w-[320px] rounded-[1rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_34px_120px_-80px_rgba(0,0,0,0.9)] backdrop-blur-md 2xl:block">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/45">Ticket termico</p>
        <p className="mt-3 text-3xl font-black text-white">#A7K2P</p>
        <div className="my-3 h-px bg-white/20" />
        <div className="space-y-2 text-sm text-white/65">
          <div className="flex justify-between"><span>Chopp Pilsen</span><strong className="text-white">R$ 12,00</strong></div>
          <div className="flex justify-between"><span>PS5 - 30 min</span><strong className="text-white">R$ 25,00</strong></div>
          <div className="flex justify-between"><span>Pix</span><strong className="text-white">OK</strong></div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ item, className }: { item: FeatureItem; className?: string }) {
  const Icon = item.icon;

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-5", className)}>
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-black text-white">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/58">{item.description}</p>
    </div>
  );
}

export default async function LoginPage() {
  const session = await getServerAuthSession();
  const { customization } = await getBrandCustomizationSnapshot();
  const themeVariables = buildBrandThemeVariables(customization);

  if (session?.user) {
    redirect(buildTenantAdminPath(session.user.tenantSlug));
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0d090b] text-white" style={themeVariables as CSSProperties}>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto flex h-14 w-[calc(100vw-1.5rem)] max-w-7xl min-w-0 items-center justify-start gap-3 rounded-2xl border border-white/10 bg-black/45 px-3 shadow-[0_18px_70px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:h-16 sm:w-full sm:justify-between sm:px-4">
          <Link href="/login" className="flex min-w-0 shrink items-center gap-3">
            <BrandLogo priority className="h-8 w-14 justify-start sm:h-9 sm:w-24" />
            <span className="hidden text-xs font-black uppercase tracking-[0.18em] text-white/45 sm:inline">PDV SaaS</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-white/62 md:flex">
            <a href="#produto" className="transition-colors hover:text-white">Produto</a>
            <a href="#modulos" className="transition-colors hover:text-white">Modulos</a>
            <a href="#funciona" className="transition-colors hover:text-white">Como funciona</a>
            <a href="#entrar" className="transition-colors hover:text-white">Login</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href="#entrar"
              className="inline-flex h-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2.5 text-[0.72rem] font-semibold text-white transition-colors hover:bg-white/10 sm:h-9 sm:px-3 sm:text-sm"
            >
              Login
            </a>
            <Link
              href="/register"
              className="inline-flex h-8 items-center justify-center rounded-xl border border-primary bg-primary px-2.5 text-[0.72rem] font-semibold text-primary-foreground shadow-[0_14px_34px_-22px_hsl(var(--primary))] transition-colors hover:bg-primary/92 sm:h-9 sm:px-3 sm:text-sm"
            >
              <span className="sm:hidden">Criar</span>
              <span className="hidden sm:inline">Cadastrar</span>
            </Link>
          </div>
        </div>
      </header>

      <section id="produto" className="relative flex min-h-[88svh] items-center overflow-hidden px-4 pb-16 pt-32">
        <ProductScene />
        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="max-w-[22rem] sm:max-w-3xl">
            <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
              XP PDV
            </div>
            <h1 className="mt-6 max-w-[21rem] text-[2.75rem] font-black leading-[0.98] tracking-tight text-white sm:max-w-3xl sm:text-5xl md:text-7xl">
              XP PDV para operacao que nao pode travar.
            </h1>
            <p className="mt-6 max-w-[22rem] text-base leading-7 text-white/68 sm:max-w-2xl md:text-xl md:leading-8">
              Um PDV completo para bares, restaurantes, lojas e operacoes com servico por tempo: venda, caixa,
              estoque, fiscal, relatorios, comandas, cupons e app de TV no mesmo sistema.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button render={<Link href="/register" />} size="lg" className="gap-2 shadow-[0_18px_52px_-26px_hsl(var(--primary))]">
                Criar conta
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button render={<a href="#entrar" />} variant="outline" size="lg" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                Entrar no painel
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/44">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Banco isolado por cliente</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">NFC-e e XML</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Caixa e relatorio</span>
            </div>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_28px_90px_-64px_rgba(0,0,0,0.95)] md:hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary">Painel</p>
                  <p className="mt-1 text-lg font-black text-white">Caixa em tempo real</p>
                </div>
                <span className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 text-[0.65rem] font-bold text-emerald-200">
                  Aberto
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["Vendido", "R$ 2.840,50"],
                  ["Pix", "R$ 920,00"],
                  ["Servico", "TV 02"],
                  ["Ticket", "R$ 37,86"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-black/22 p-3">
                    <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-white/42">{label}</p>
                    <p className="mt-2 text-sm font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] px-4 py-5">
        <div className="mx-auto grid max-w-7xl gap-3 text-sm text-white/58 sm:grid-cols-2 lg:grid-cols-4">
          {conversionPoints.map((point) => (
            <div key={point} className="flex gap-3">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{point}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="modulos" className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Sistema inteiro conectado</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              Tudo que o caixa precisa, sem abrir cinco ferramentas.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/58">
              O XP PDV foi pensado para operacao real: vender rapido, controlar dinheiro, emitir fiscal,
              acompanhar estoque e entender o resultado no fim do turno.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((item) => (
              <FeatureCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[0.95fr,1.05fr]">
          <div className="rounded-3xl border border-primary/25 bg-primary/10 p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Por que escolher</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
              Melhor para quem precisa operar, nao apenas registrar venda.
            </h2>
            <p className="mt-5 text-base leading-7 text-white/62">
              Um PDV comum anota pedidos. O XP PDV fecha o ciclo: vende, baixa estoque, controla caixa,
              imprime ticket, registra fiscal, acompanha servicos e mostra o resultado.
            </p>
            <Button render={<Link href="/register" />} className="mt-7 gap-2">
              Comecar cadastro
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4">
            {reasons.map((item) => (
              <FeatureCard key={item.title} item={item} className="min-h-0" />
            ))}
          </div>
        </div>
      </section>

      <section id="funciona" className="border-y border-white/10 bg-white/[0.025] px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.8fr,1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Como funciona</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                Do cadastro ao caixa fechado.
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-black/24 p-5">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                    0{index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-black text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/58">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 lg:grid-cols-4">
            {[
              { icon: Store, label: "Bares e lanchonetes", value: "Comanda, chopp, dose e ticket" },
              { icon: Tv, label: "Games e servicos", value: "TV, PS5, simulador e tempo livre" },
              { icon: WalletCards, label: "Pagamento", value: "Pix, dinheiro, credito e debito" },
              { icon: MessageCircle, label: "Gestao", value: "Relatorio para WhatsApp" },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-5 text-sm font-black uppercase tracking-[0.16em] text-white/42">{item.label}</p>
                  <p className="mt-2 text-xl font-black text-white">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="entrar" className="px-4 pb-24">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Proximo passo</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white md:text-5xl">
              Crie a conta agora e coloque sua operacao dentro de um PDV mais inteligente.
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {[
                [LockKeyhole, "Acesso protegido por usuario e permissoes."],
                [MonitorSmartphone, "Painel web e app TV para controle de tempo."],
                [TicketPercent, "Cupons por produto, categoria ou venda inteira."],
                [Clock3, "Turno operacional, caixa e relatorio do dia."],
              ].map(([Icon, text]) => {
                const TypedIcon = Icon as ComponentType<{ className?: string }>;

                return (
                  <div key={text as string} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <TypedIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-white/62">{text as string}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="border-white/10 bg-white/[0.055] text-white shadow-[0_32px_110px_-70px_rgba(0,0,0,0.95)]">
            <CardHeader className="space-y-3">
              <BrandLogo priority className="mx-auto h-14 w-48" />
              <CardTitle className="text-2xl text-white">Entrar no painel</CardTitle>
              <CardDescription className="text-white/55">
                Ja e cliente? Acesse seu ambiente. Se ainda nao tem conta, faca o cadastro e aguarde aprovacao.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <LoginForm />
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/58">
                Ainda nao tem acesso?{" "}
                <Link href="/register" className="font-bold text-primary transition-colors hover:text-primary/80">
                  Cadastrar nova conta
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
