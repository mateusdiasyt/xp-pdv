import type { CSSProperties, ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Banknote,
  Boxes,
  FileCheck2,
  Gamepad2,
  Gem,
  Hexagon,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  buildBrandThemeVariables,
  getBrandCustomizationSnapshot,
} from "@/application/customization/brand-customization-service";
import { buildTenantAdminPath } from "@/application/platform/platform-service";
import { LandingLoginModal } from "@/components/platform/landing-login-modal";
import { LandingModulesSection } from "@/components/platform/landing-modules-section";
import { LandingRegisterModal } from "@/components/platform/landing-register-modal";
import { MendozaLogo } from "@/components/platform/mendoza-logo";
import type { PlatformPlanName } from "@/domain/platform/plan-entitlements";
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

type PricingPlan = {
  planName: PlatformPlanName;
  title: string;
  idealFor: string;
  accent: "gold" | "platinum";
  icon: ComponentType<{ className?: string }>;
  prices: Array<{
    period: string;
    price: string;
    discount?: string;
  }>;
};

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "https://xp-pdv.vercel.app").replace(
  /\/$/,
  "",
);
const landingPath = "/login";
const landingUrl = `${siteUrl}${landingPath}`;
const seoTitle = "Mendoza PDV | PDV completo com comanda, estoque e NFC-e";
const seoDescription =
  "Sistema PDV completo para bares, lanchonetes e conveniências: comanda, caixa, estoque, XML, NFC-e, cupons, relatórios e controle de tempo para Smart TVs.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: seoTitle,
  description: seoDescription,
  alternates: {
    canonical: landingPath,
  },
  openGraph: {
    title: seoTitle,
    description: seoDescription,
    url: landingPath,
    siteName: "Mendoza PDV",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/mendoza-logo.svg",
        width: 512,
        height: 390,
        alt: "Mendoza PDV - sistema PDV completo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seoTitle,
    description: seoDescription,
    images: ["/mendoza-logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const conversionPoints: FeatureItem[] = [
  {
    icon: Banknote,
    title: "PDV com caixa sem divergência",
    description: "Venda, pagamento, sangria, suprimento e fechamento no mesmo fluxo.",
  },
  {
    icon: Boxes,
    title: "Controle de estoque para PDV",
    description: "XML, produto fracionado, perdas e baixa automática deixam menos sobra fantasma.",
  },
  {
    icon: FileCheck2,
    title: "Emissão fiscal NFC-e no PDV",
    description: "Focus NFe configurada por cliente, com XML, DANFE e ambiente fiscal.",
  },
  {
    icon: Gamepad2,
    title: "Controle de tempo para Smart TVs",
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
      "Sim. O plugin de Smart TV controla tempo de PS5, simulador, sinuca ou qualquer serviço por minuto, com cobrança, pausa e cancelamento.",
  },
  {
    question: "Consigo importar XML de compra?",
    answer:
      "Sim. O plugin de XML permite salvar o arquivo, revisar os itens e dar entrada no estoque com conferência.",
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

const pricingPlans: PricingPlan[] = [
  {
    planName: "Ouro",
    title: "Plano Ouro",
    idealFor: "Ideal para pequenos comércios, lanchonetes, conveniências e bares.",
    accent: "gold",
    icon: Hexagon,
    prices: [
      { period: "1 mês", price: "R$ 99,90" },
      { period: "3 meses", price: "R$ 269,90", discount: "-10%" },
      { period: "6 meses", price: "R$ 499,90", discount: "-17%" },
      { period: "12 meses", price: "R$ 899,90", discount: "-25%" },
    ],
  },
  {
    planName: "Platina",
    title: "Plano Platina",
    idealFor:
      "Ideal para empresas que precisam de recursos avançados, múltiplos usuários, relatórios completos, integrações e suporte prioritário.",
    accent: "platinum",
    icon: Gem,
    prices: [
      { period: "1 mês", price: "R$ 149,90" },
      { period: "3 meses", price: "R$ 399,90", discount: "-11%" },
      { period: "6 meses", price: "R$ 749,90", discount: "-17%" },
      { period: "12 meses", price: "R$ 1.349,90", discount: "-25%" },
    ],
  },
];

const softwareFeatures = [
  "PDV com venda rápida e comandas",
  "Abertura e fechamento de caixa",
  "Controle de estoque com XML de compra",
  "Produtos fracionados, perdas e baixa automática",
  "Cupons por venda, produto ou categoria",
  "Relatórios de vendas por dinheiro, Pix, crédito e débito",
  "NFC-e, DANFE e XML com Focus NFe",
  "App para Smart TVs com controle de tempo",
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Mendoza PDV",
      url: siteUrl,
      logo: `${siteUrl}/mendoza-logo.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Mendoza PDV",
      url: siteUrl,
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
      inLanguage: "pt-BR",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${landingUrl}#software`,
      name: "Mendoza PDV",
      alternateName: "Sistema PDV completo com comanda",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android TV",
      url: landingUrl,
      image: `${siteUrl}/mendoza-logo.svg`,
      description: seoDescription,
      featureList: softwareFeatures,
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "BRL",
        lowPrice: "99.90",
        highPrice: "1349.90",
        offerCount: "8",
        url: landingUrl,
      },
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    },
    {
      "@type": "Product",
      "@id": `${landingUrl}#product`,
      name: "Mendoza PDV",
      brand: {
        "@type": "Brand",
        name: "Mendoza PDV",
      },
      category: "Sistema PDV",
      url: landingUrl,
      image: `${siteUrl}/mendoza-logo.svg`,
      description: seoDescription,
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "BRL",
        lowPrice: "99.90",
        highPrice: "1349.90",
        offerCount: "8",
        availability: "https://schema.org/InStock",
        url: landingUrl,
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${landingUrl}#faq`,
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }}
    />
  );
}

function ProductScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(112deg,#11090d_0%,#160b10_42%,#351209_100%)]" />
      <div
        className="absolute top-24 hidden h-[560px] rounded-[2rem] border border-white/10 bg-black/35 shadow-[0_80px_180px_-95px_rgba(255,0,92,0.85)] backdrop-blur-sm xl:block"
        style={{
          right: "max(2rem, calc((100vw - 80rem) / 2 + 2rem))",
          width: "min(50vw, 760px)",
        }}
      />
      <div
        data-testid="landing-hero-dashboard"
        className="absolute top-28 hidden rotate-[-1.5deg] rounded-[1.25rem] border border-white/10 bg-[#111111]/95 p-4 shadow-[0_44px_140px_-70px_rgba(0,0,0,0.95)] xl:block"
        style={{
          right: "max(2rem, calc((100vw - 80rem) / 2))",
          width: "min(38vw, 560px)",
        }}
      >
        <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-primary">Painel operacional</p>
            <p className="mt-1 text-xl font-black text-white">Resumo do caixa</p>
          </div>
          <div className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
            Caixa aberto
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
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
        <div className="mt-4 grid gap-3 2xl:grid-cols-[1.15fr,0.85fr]">
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
      <JsonLd />
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto flex h-14 w-[calc(100vw-1.5rem)] max-w-7xl min-w-0 items-center justify-start gap-3 rounded-2xl border border-white/10 bg-black/45 px-3 shadow-[0_18px_70px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:h-16 sm:w-full sm:justify-between sm:px-4">
          <Link href="/login" className="flex min-w-0 shrink items-center gap-3">
            <MendozaLogo className="h-12 w-[4.9rem] sm:h-14 sm:w-[5.8rem]" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-white/62 md:flex">
            <a href="#produto" className="transition-colors hover:text-white">Produto</a>
            <a href="#plugins" className="transition-colors hover:text-white">Plugins</a>
            <a href="#planos" className="transition-colors hover:text-white">Planos</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
            <LandingLoginModal className="transition-colors hover:text-white">Login</LandingLoginModal>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LandingLoginModal
              className="inline-flex h-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2.5 text-[0.72rem] font-semibold text-white transition-colors hover:bg-white/10 sm:h-9 sm:px-3 sm:text-sm"
            >
              Login
            </LandingLoginModal>
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
              PDV completo com comanda, estoque e NFC-e para operação real.
            </h1>
            <p className="mt-6 max-w-[22rem] text-base leading-7 text-white/70 sm:max-w-2xl md:text-xl md:leading-8">
              Sistema PDV para bares, lanchonetes, conveniências e operações com comanda: venda, caixa, estoque, fiscal, cupons, relatórios e app de controle de tempo para Smart TVs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LandingButton label="Criar conta" />
              <LandingLoginModal
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-black text-white transition-colors hover:bg-white/10"
              >
                Entrar no painel
              </LandingLoginModal>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/48">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">PDV com comanda</span>
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

      <LandingModulesSection />

      <section
        id="planos"
        className="relative overflow-hidden border-y border-white/10 bg-[linear-gradient(180deg,#08090d_0%,#0d0f14_52%,#08090d_100%)] px-4 py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-5xl">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-primary">Planos</p>
            <h2 className="mt-4 text-4xl font-black leading-[0.98] tracking-tight text-white md:text-6xl">
              Escolha o plano ideal para sua operação.
            </h2>
            <div className="mt-6 space-y-2 text-base leading-7 text-white/64 md:text-lg">
              <p>O plano Ouro reúne os plugins essenciais do PDV.</p>
              <p>O plano Platina adiciona fiscal Focus NFe, App TV e link personalizado.</p>
            </div>
            <div className="mt-8 inline-flex max-w-3xl items-center gap-3 rounded-xl border border-white/10 bg-white/[0.055] px-5 py-4 text-sm leading-6 text-white/72 shadow-[0_24px_90px_-70px_rgba(0,0,0,0.95)] backdrop-blur">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong className="text-white">Platina:</strong> indicado para operações que precisam de plugins avançados e mais controle.
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {pricingPlans.map((plan) => {
              const Icon = plan.icon;
              const isGold = plan.accent === "gold";

              return (
                <article
                  key={plan.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_32px_120px_-86px_rgba(0,0,0,0.98)] transition-colors hover:border-white/18 sm:p-8"
                >
                  <div className="flex items-center gap-5">
                    <div
                      className={cn(
                        "grid h-16 w-16 shrink-0 place-items-center rounded-2xl border bg-white/[0.04]",
                        isGold
                          ? "border-[#e4bd37]/45 text-[#e4bd37] shadow-[0_18px_46px_-34px_rgba(228,189,55,0.9)]"
                          : "border-white/18 text-white/82 shadow-[0_18px_46px_-34px_rgba(255,255,255,0.55)]"
                      )}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Mendoza PDV</p>
                      <h3 className="mt-2 text-3xl font-black tracking-tight text-white">{plan.title}</h3>
                    </div>
                  </div>

                  <div className="my-7 h-px bg-white/10" />

                  <p className="max-w-xl text-base leading-7 text-white/64">{plan.idealFor}</p>

                  <div className="mt-8">
                    {plan.prices.map((row) => (
                      <div
                        key={row.period}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-4 last:border-b-0"
                      >
                        <span className="text-base font-medium text-white/62 md:text-lg">{row.period}</span>
                        <div className="flex items-center justify-end gap-3">
                          <strong className="text-xl font-black tracking-tight text-white md:text-2xl">{row.price}</strong>
                          {row.discount ? (
                            <span className="rounded-full border border-primary/18 bg-primary/10 px-2.5 py-1 text-sm font-black text-primary">
                              {row.discount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <LandingRegisterModal
                    label="Começar com este plano"
                    className="mt-8 inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-primary/30 bg-[linear-gradient(135deg,#ff496c,#ff0059)] px-5 text-base font-black text-black shadow-[0_22px_66px_-42px_hsl(var(--primary))] transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_28px_90px_-44px_hsl(var(--primary))]"
                  />

                  <div className="mt-6 flex items-center gap-2 text-sm font-medium text-white/48">
                    <LockKeyhole className="h-4 w-4" />
                    <span>Ativação rápida e segura.</span>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-sm text-white/50">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Ambiente 100% seguro
            </span>
            <span className="hidden h-5 w-px bg-white/14 sm:block" />
            <span>Cancelamento fácil quando quiser</span>
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
              O cadastro abre um pedido de acesso. Depois da aprovação, você configura produtos, fiscal, caixa, usuários e plugins sem misturar seus dados com outros clientes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LandingButton label="Criar conta agora" />
              <LandingLoginModal
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-black text-white transition-colors hover:bg-white/10"
              >
                Já sou cliente
              </LandingLoginModal>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
