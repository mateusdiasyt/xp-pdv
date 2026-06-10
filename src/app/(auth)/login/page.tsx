import type { CSSProperties, ComponentType, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Banknote,
  BarChart3,
  Boxes,
  FileCheck2,
  Gamepad2,
  MessageCircle,
  ReceiptText,
} from "lucide-react";

import {
  buildBrandThemeVariables,
  getBrandCustomizationSnapshot,
} from "@/application/customization/brand-customization-service";
import { buildTenantAdminPath } from "@/application/platform/platform-service";
import { LoginForm } from "@/components/admin/login-form";
import { LandingRegisterModal } from "@/components/platform/landing-register-modal";
import { MendozaLogo } from "@/components/platform/mendoza-logo";
import { getServerAuthSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

type FeatureItem = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

type ModuleItem = FeatureItem & {
  highlight: string;
  preview: ReactNode;
};

type StepItem = {
  title: string;
  description: string;
};

const conversionPoints: FeatureItem[] = [
  {
    icon: Banknote,
    title: "Caixa sem divergência",
    description: "Venda, pagamento, sangria, suprimento e fechamento no mesmo fluxo.",
  },
  {
    icon: Boxes,
    title: "Estoque que acompanha a venda",
    description: "XML, produto fracionado, perdas e baixa automática deixam menos sobra fantasma.",
  },
  {
    icon: FileCheck2,
    title: "Fiscal dentro do PDV",
    description: "Focus NFe configurada por cliente, com XML, DANFE e ambiente fiscal.",
  },
  {
    icon: Gamepad2,
    title: "Serviço por tempo",
    description: "Smart TVs, PS5, simulador e sinuca cobrados por tempo, sem controle paralelo.",
  },
];

const steps: StepItem[] = [
  {
    title: "Crie a conta",
    description: "O cadastro entra para aprovação e prepara um ambiente próprio para o cliente.",
  },
  {
    title: "Configure a operação",
    description: "Cadastre produtos, categorias, estoque, fiscal, formas de pagamento e serviços por tempo.",
  },
  {
    title: "Venda e acompanhe",
    description: "Abra o caixa, venda, imprima tickets, controle estornos e veja relatórios sem planilha paralela.",
  },
];

const faq = [
  {
    question: "Preciso contratar a Focus NFe por fora?",
    answer:
      "Sim. O Mendoza PDV integra com a API da Focus NFe, e cada cliente informa os próprios tokens, CNPJ, ambiente e dados fiscais dentro do sistema.",
  },
  {
    question: "Funciona para bar com comanda e produto fracionado?",
    answer:
      "Funciona. Você vende por comanda, venda rápida, dose, chopp por mililitro, perda de estoque e baixa automática quando usa receita.",
  },
  {
    question: "Dá para cobrar videogame por tempo?",
    answer:
      "Sim. O módulo de Smart TV controla tempo de PS5, simulador, sinuca ou qualquer serviço por minuto, com cobrança, pausa e cancelamento.",
  },
  {
    question: "Consigo importar XML de compra?",
    answer:
      "Sim. O módulo de XML permite salvar o arquivo, revisar os itens e dar entrada no estoque com conferência.",
  },
  {
    question: "O sistema imprime em térmica?",
    answer:
      "Sim. O fluxo foi pensado para ticket de retirada, comprovante operacional e relatório resumido em impressora térmica.",
  },
  {
    question: "Cada cliente fica separado?",
    answer:
      "Sim. Cada conta aprovada pode ter dados, produtos, vendas, estoque e configuração fiscal isolados dos outros clientes.",
  },
];

function MiniCommandPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="grid grid-cols-3 gap-2">
        {["#12", "#13", "#14"].map((table, index) => (
          <div
            key={table}
            className={cn(
              "rounded-xl border p-3 text-sm font-black",
              index === 0
                ? "border-primary/35 bg-primary/12 text-white"
                : "border-white/10 bg-white/[0.035] text-white/52"
            )}
          >
            {table}
            <span className="mt-4 block text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/36">
              {index === 0 ? "Aberta" : "Livre"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs text-white/58">
        <div className="flex justify-between gap-3">
          <span>Chopp Pilsen</span>
          <strong className="text-white">R$ 12,00</strong>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <span>Batata</span>
          <strong className="text-white">R$ 37,00</strong>
        </div>
      </div>
    </div>
  );
}

function MiniCashPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Dinheiro", "R$ 239,00"],
          ["Pix", "R$ 178,00"],
          ["Cartão", "R$ 454,50"],
          ["Final", "R$ 439,00"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-white/38">{label}</p>
            <p className="mt-2 text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[0.68rem] font-bold text-white/62">
        <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1">Suprimento</span>
        <span className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-2 py-1">Sangria</span>
      </div>
    </div>
  );
}

function MiniXmlPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/40">XMLs</span>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[0.62rem] font-black text-primary">
          Prévia
        </span>
      </div>
      {[
        ["Grupo Irani", "6 itens"],
        ["Atacado S.A.", "14 itens"],
        ["República Bebidas", "3 itens"],
      ].map(([supplier, items]) => (
        <div key={supplier} className="flex items-center justify-between border-t border-white/8 py-2 text-xs">
          <span className="font-bold text-white">{supplier}</span>
          <span className="text-white/42">{items}</span>
        </div>
      ))}
    </div>
  );
}

function MiniFiscalPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-200">Autorizada</p>
        <p className="mt-2 text-lg font-black text-white">NFC-e #298</p>
        <p className="mt-1 text-xs text-white/52">Produção • Focus NFe</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
        <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-white/70">DANFE</span>
        <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-white/70">XML salvo</span>
      </div>
    </div>
  );
}

function MiniTvPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="rounded-xl border border-primary/35 bg-primary/12 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">TV 02 • Simulador</p>
            <p className="mt-1 text-xs text-white/54">Tempo livre pago</p>
          </div>
          <span className="rounded-full bg-emerald-300 px-2 py-1 text-[0.58rem] font-black uppercase text-black">
            Em uso
          </span>
        </div>
        <p className="mt-4 text-2xl font-black text-white">35 min</p>
        <div className="mt-3 h-2 rounded-full bg-white/12">
          <div className="h-full w-3/5 rounded-full bg-emerald-300" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-white/58">
        <span>Arredonda 5 em 5</span>
        <strong className="text-white">R$ 17,50</strong>
      </div>
    </div>
  );
}

function MiniReportPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/40">Relatório</p>
          <p className="mt-1 text-lg font-black text-white">R$ 671,50</p>
        </div>
        <MessageCircle className="h-5 w-5 text-primary" />
      </div>
      {[
        ["Pix", "R$ 178,00"],
        ["Débito", "R$ 400,50"],
        ["Saldo caixa", "R$ 239,00"],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between border-b border-white/8 py-2 text-xs">
          <span className="text-white/50">{label}</span>
          <strong className="text-white">{value}</strong>
        </div>
      ))}
    </div>
  );
}

const modules: ModuleItem[] = [
  {
    icon: ReceiptText,
    title: "PDV rápido e comandas",
    highlight: "Venda limpa, com cupom e múltiplos pagamentos.",
    description:
      "Venda direta, comanda avulsa, comprovante, cancelamento e histórico sem precisar recarregar a página.",
    preview: <MiniCommandPreview />,
  },
  {
    icon: Banknote,
    title: "Caixa operacional",
    highlight: "Abertura, operador e fechamento do dia.",
    description: "Controle dinheiro real do caixa, suprimento, sangria, estorno e relatório de fechamento.",
    preview: <MiniCashPreview />,
  },
  {
    icon: Boxes,
    title: "Estoque e XML",
    highlight: "Entrada por XML com conferência.",
    description: "Salve XMLs de compra, revise os itens, dê entrada no estoque e registre perdas quando precisar.",
    preview: <MiniXmlPreview />,
  },
  {
    icon: FileCheck2,
    title: "NFe e NFC-e com Focus NFe",
    highlight: "API fiscal integrada no sistema.",
    description:
      "Configure tokens, CNPJ, homologação e produção direto no PDV, sem depender de variável por cliente.",
    preview: <MiniFiscalPreview />,
  },
  {
    icon: Gamepad2,
    title: "App TV para Smart TVs",
    highlight: "Cobrança por tempo para qualquer videogame.",
    description:
      "Controle PS5, simulador, sinuca ou serviço por minuto, com tempo livre, pausa, cancelamento e cobrança.",
    preview: <MiniTvPreview />,
  },
  {
    icon: BarChart3,
    title: "Relatórios claros",
    highlight: "Resumo de vendas, caixa e pagamentos.",
    description: "Veja dinheiro, Pix, crédito, débito, lucro, itens vendidos e envie o resumo pelo WhatsApp.",
    preview: <MiniReportPreview />,
  },
];

function ProductScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(112deg,#11090d_0%,#160b10_42%,#351209_100%)]" />
      <div className="absolute left-1/2 top-24 hidden h-[560px] w-[980px] -translate-x-[8%] rounded-[2rem] border border-white/10 bg-black/35 shadow-[0_80px_180px_-95px_rgba(255,0,92,0.85)] backdrop-blur-sm lg:block" />
      <div className="absolute right-[-160px] top-28 hidden w-[690px] rotate-[-2deg] rounded-[1.25rem] border border-white/10 bg-[#111111]/95 p-4 shadow-[0_44px_140px_-70px_rgba(0,0,0,0.95)] xl:right-[-80px] xl:w-[740px] lg:block">
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
                ["Débito", "54%"],
                ["Crédito", "38%"],
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
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary">Serviço ativo</p>
            <p className="mt-3 text-lg font-black text-white">TV 02 • Simulador</p>
            <p className="mt-1 text-sm text-white/55">Tempo livre pago</p>
            <div className="mt-4 h-2 rounded-full bg-white/10">
              <div className="h-full w-3/5 rounded-full bg-emerald-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ item }: { item: ModuleItem }) {
  const Icon = item.icon;

  return (
    <div className="grid min-h-full gap-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition-colors hover:border-primary/28 hover:bg-white/[0.05]">
      <div>
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-xl font-black text-white">{item.title}</h3>
        <p className="mt-2 text-sm font-bold text-primary">{item.highlight}</p>
        <p className="mt-3 text-sm leading-6 text-white/58">{item.description}</p>
      </div>
      {item.preview}
    </div>
  );
}

function LandingButton({ label, className }: { label: string; className?: string }) {
  return (
    <LandingRegisterModal
      label={label}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 text-sm font-black text-primary-foreground shadow-[0_18px_52px_-28px_hsl(var(--primary))] transition-all hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_24px_70px_-30px_hsl(var(--primary))]",
        className
      )}
    />
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
            <MendozaLogo className="h-8 w-[9.5rem] sm:h-10 sm:w-[11rem]" />
            <span className="hidden text-xs font-black uppercase tracking-[0.18em] text-white/45 sm:inline">PDV SaaS</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-white/62 md:flex">
            <a href="#produto" className="transition-colors hover:text-white">Produto</a>
            <a href="#modulos" className="transition-colors hover:text-white">Módulos</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
            <a href="#entrar" className="transition-colors hover:text-white">Login</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href="#entrar"
              className="inline-flex h-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2.5 text-[0.72rem] font-semibold text-white transition-colors hover:bg-white/10 sm:h-9 sm:px-3 sm:text-sm"
            >
              Login
            </a>
            <LandingRegisterModal
              label="Cadastrar"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-primary bg-primary px-2.5 text-[0.72rem] font-semibold text-primary-foreground shadow-[0_14px_34px_-22px_hsl(var(--primary))] transition-colors hover:bg-primary/92 sm:h-9 sm:px-3 sm:text-sm"
            />
          </div>
        </div>
      </header>

      <section id="produto" className="relative flex min-h-[82svh] items-center overflow-hidden px-4 pb-16 pt-32">
        <ProductScene />
        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="max-w-[22rem] sm:max-w-2xl">
            <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
              Mendoza PDV
            </div>
            <h1 className="mt-6 max-w-[21rem] text-[2.75rem] font-black leading-[0.98] tracking-tight text-white sm:max-w-2xl sm:text-5xl md:text-6xl xl:text-7xl">
              O PDV completo para operações que não podem travar.
            </h1>
            <p className="mt-6 max-w-[22rem] text-base leading-7 text-white/70 sm:max-w-2xl md:text-xl md:leading-8">
              Venda, caixa, estoque, fiscal, relatórios, comandas, cupons e app de controle de tempo para Smart TVs no mesmo sistema.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LandingButton label="Criar conta" />
              <a
                href="#entrar"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-black text-white transition-colors hover:bg-white/10"
              >
                Entrar no painel
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/48">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Banco isolado por cliente</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Focus NFe integrada</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">XML de compra</span>
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
                  ["Serviço", "TV 02"],
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

      <section className="border-y border-white/10 bg-white/[0.025] px-4 py-8">
        <div className="mx-auto grid max-w-7xl justify-items-center gap-3 sm:grid-cols-2 sm:justify-items-stretch lg:grid-cols-4">
          {conversionPoints.map((point) => {
            const Icon = point.icon;

            return (
              <div key={point.title} className="w-full max-w-[22rem] rounded-2xl border border-white/10 bg-black/24 p-4 sm:max-w-none">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-white">{point.title}</h2>
                    <p className="mt-1 break-words text-sm leading-6 text-white/58">{point.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="modulos" className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Módulos do PDV</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              Uma operação real, mostrada em cards reais.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/60">
              Cada módulo resolve uma parte do caixa: venda, estoque, fiscal, controle de tempo, relatório e conferência.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((item) => (
              <ModuleCard key={item.title} item={item} />
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

      <section id="faq" className="px-4 pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">FAQ</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              Perguntas frequentes
            </h2>
          </div>
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-3 shadow-[0_32px_110px_-78px_rgba(0,0,0,0.95)] sm:p-5">
            {faq.map((item) => (
              <details key={item.question} className="group border-b border-white/10 last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-3 py-5 text-left text-base font-black text-white transition-colors hover:text-primary sm:px-5 sm:text-lg [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-black/24 text-xl font-light text-white/72 transition-colors group-open:border-primary/30 group-open:text-primary">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:block">-</span>
                  </span>
                </summary>
                <p className="px-3 pb-5 text-left text-sm leading-6 text-white/60 sm:px-5">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-7xl rounded-3xl border border-primary/25 bg-[linear-gradient(135deg,rgba(255,0,92,0.16),rgba(255,255,255,0.035)_42%,rgba(0,0,0,0.24))] p-6 md:p-10">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Próximo passo</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-6xl">
              Crie sua conta agora e veja o Mendoza PDV rodando na sua operação.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/64">
              O cadastro abre um pedido de acesso. Depois da aprovação, você configura produtos, fiscal, caixa, usuários e módulos sem misturar seus dados com outros clientes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LandingButton label="Criar conta agora" />
              <a
                href="#entrar"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-black text-white transition-colors hover:bg-white/10"
              >
                Já sou cliente
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="entrar" className="px-4 pb-24">
        <div className="mx-auto max-w-[430px]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 text-white shadow-[0_32px_110px_-70px_rgba(0,0,0,0.95)]">
            <MendozaLogo className="mx-auto h-16 w-[15rem]" />
            <h2 className="mt-6 text-2xl font-black text-white">Entrar no painel</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Já é cliente? Acesse seu ambiente com email, senha e link do cliente.
            </p>
            <div className="mt-5 space-y-5 [&_label]:text-white/72 [&_input]:border-white/12 [&_input]:bg-black/28 [&_input]:text-white [&_input]:placeholder:text-white/28 [&_p]:text-white/45">
              <LoginForm />
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/58">
                Ainda não tem acesso?{" "}
                <LandingRegisterModal
                  label="Cadastrar nova conta"
                  className="font-bold text-primary transition-colors hover:text-primary/80"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
