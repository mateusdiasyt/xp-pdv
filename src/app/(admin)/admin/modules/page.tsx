import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgePercent,
  Banknote,
  Boxes,
  ClipboardList,
  FileCheck2,
  Gamepad2,
  Landmark,
  LineChart,
  LockKeyhole,
  Palette,
  Plug,
  Receipt,
  type LucideIcon,
} from "lucide-react";

import { requireSession } from "@/application/auth/guards";
import { buildTenantAdminPath, getTenantModuleEntitlements } from "@/application/platform/platform-service";
import { PageHeader } from "@/components/admin/page-header";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import type { PlatformModuleKey, PlatformPlanName } from "@/domain/platform/plan-entitlements";
import { cn } from "@/lib/utils";

type PluginCard = {
  title: string;
  shortTitle?: string;
  category: "Operacao" | "Financeiro" | "Fiscal" | "Gestao" | "Premium";
  summary: string;
  requiredPlan: PlatformPlanName;
  moduleKey?: PlatformModuleKey;
  icon: LucideIcon;
  href: string;
};

const planRank: Record<PlatformPlanName, number> = {
  Ouro: 1,
  Platina: 2,
};

function pluginPlanCardClassName(plan: PlatformPlanName) {
  return plan === "Ouro"
    ? "border-[#e4bd37]/45 from-[#3a2a08]/55 via-[#11151a] to-[#0e1114] shadow-[#e4bd37]/18"
    : "border-slate-100/32 from-slate-100/16 via-[#101621] to-[#0e1114] shadow-cyan-200/14";
}

function pluginPlanIconClassName(plan: PlatformPlanName) {
  return plan === "Ouro"
    ? "border-[#e4bd37]/35 bg-[#e4bd37]/16 text-[#f6d45c]"
    : "border-slate-100/28 bg-slate-100/12 text-slate-100";
}

function pluginPlanButtonClassName(plan: PlatformPlanName, isAvailable: boolean) {
  if (!isAvailable) {
    return "border-primary/30 bg-primary/12 text-primary hover:bg-primary/18";
  }

  return plan === "Ouro"
    ? "border-[#e4bd37]/45 bg-[#e4bd37] text-black hover:bg-[#f0ca42]"
    : "border-slate-100/32 bg-slate-100 text-black hover:bg-white";
}

const plugins: PluginCard[] = [
  {
    title: "PDV rapido",
    category: "Operacao",
    summary: "Atende vendas rapidas de balcao sem abrir comanda.",
    requiredPlan: "Ouro",
    icon: Receipt,
    href: "/admin/pdv",
  },
  {
    title: "Caixa operacional",
    category: "Financeiro",
    summary: "Abertura, operador, suprimento, sangria e fechamento do dia.",
    requiredPlan: "Ouro",
    icon: Banknote,
    href: "/admin/pdv",
  },
  {
    title: "Estoque e XML",
    category: "Operacao",
    summary: "Entradas por XML, anexos, produtos fracionados, perdas e baixa.",
    requiredPlan: "Ouro",
    icon: Boxes,
    href: "/admin/stock",
  },
  {
    title: "Cupons inteligentes",
    category: "Operacao",
    summary: "Desconto em valor ou porcentagem por venda, categoria ou produto.",
    requiredPlan: "Ouro",
    icon: BadgePercent,
    href: "/admin/coupons",
  },
  {
    title: "Relatorios e WhatsApp",
    shortTitle: "Relatorios e WhatsApp",
    category: "Financeiro",
    summary: "Resumo de vendas, pagamentos, caixa, lucro e itens vendidos.",
    requiredPlan: "Ouro",
    icon: LineChart,
    href: "/admin/reports",
  },
  {
    title: "Marca e configuracoes",
    category: "Gestao",
    summary: "Logo, cores, nome do painel, horario operacional e preferencias.",
    requiredPlan: "Ouro",
    icon: Palette,
    href: "/admin/customization",
  },
  {
    title: "Comandas",
    category: "Operacao",
    summary: "Comandas avulsas, nomes, itens em aberto e fechamento posterior.",
    requiredPlan: "Platina",
    icon: ClipboardList,
    href: "/admin/pdv",
  },
  {
    title: "Contas a pagar",
    category: "Financeiro",
    summary: "Planilha de contas fixas, parceladas, vencimentos e comprovantes.",
    requiredPlan: "Platina",
    icon: Landmark,
    href: "/admin/accounts",
  },
  {
    title: "Fiscal Focus NFe",
    category: "Fiscal",
    summary: "NFC-e, DANFE, XML e ambiente fiscal por cliente.",
    requiredPlan: "Platina",
    moduleKey: "fiscal-focus",
    icon: FileCheck2,
    href: "/admin/fiscal",
  },
  {
    title: "App TV para Smart TVs",
    shortTitle: "App TV",
    category: "Premium",
    summary: "Controle de tempo para PS5, simulador, sinuca e videogames.",
    requiredPlan: "Platina",
    moduleKey: "tv-app",
    icon: Gamepad2,
    href: "/admin/app",
  },
  {
    title: "Link personalizado",
    category: "Premium",
    summary: "Endereco proprio e exclusivo para acessar o PDV do cliente.",
    requiredPlan: "Platina",
    moduleKey: "custom-link",
    icon: Plug,
    href: "/admin/customization",
  },
];

function canUsePlugin(activePlan: PlatformPlanName | null, plugin: PluginCard, moduleEnabled: boolean) {
  if (plugin.moduleKey) {
    return moduleEnabled;
  }

  return Boolean(activePlan && planRank[activePlan] >= planRank[plugin.requiredPlan]);
}

export default async function PluginsPage() {
  const session = await requireSession();
  const isAdmin = session.user.roleSlug === "administrador";

  if (!isAdmin && !hasPermission(session.user.permissions, PERMISSIONS.MODULES_VIEW)) {
    redirect("/forbidden");
  }

  const entitlements = await getTenantModuleEntitlements(session.user.tenantSlug);
  const planHref = buildTenantAdminPath(session.user.tenantSlug, "/admin/payment");
  const availablePluginCount = plugins.filter((plugin) =>
    canUsePlugin(entitlements.activePlan, plugin, plugin.moduleKey ? entitlements.modules[plugin.moduleKey] : false),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Plugins"
        description="Recursos organizados por plano. Use Ativar para configurar um plugin liberado ou Liberar para mudar de plano."
      />

      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-[#0b1115] p-5 shadow-[0_30px_90px_-70px_rgba(0,0,0,0.95)] md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(255,0,89,0.16),transparent_34%),radial-gradient(circle_at_92%_8%,rgba(0,213,255,0.10),transparent_34%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Plugins Mendoza PDV</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-foreground md:text-4xl">
              Escolha os recursos que combinam com a sua operacao.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              O plano Ouro cobre a rotina essencial. O Platina libera plugins avancados como comandas,
              fiscal Focus NFe, App TV, contas e link personalizado.
            </p>
          </div>

          <div className="grid min-w-72 grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">Plano</p>
              <p className="mt-2 text-lg font-black text-foreground">{entitlements.activePlan ?? "Sem plano"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">Plugins</p>
              <p className="mt-2 text-lg font-black text-foreground">
                {availablePluginCount}/{plugins.length}
              </p>
            </div>
            <Link
              href={planHref}
              className="flex rounded-2xl border border-primary/30 bg-primary px-4 py-3 text-primary-foreground shadow-[0_18px_45px_-26px_rgba(255,0,89,0.9)] transition-transform hover:-translate-y-0.5"
            >
              <span className="self-end text-sm font-black">Plano</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {plugins.map((plugin) => {
          const Icon = plugin.icon;
          const moduleEnabled = plugin.moduleKey ? entitlements.modules[plugin.moduleKey] : false;
          const isAvailable = canUsePlugin(entitlements.activePlan, plugin, moduleEnabled);
          const href = buildTenantAdminPath(session.user.tenantSlug, isAvailable ? plugin.href : "/admin/payment");

          return (
            <article
              key={plugin.title}
              className={cn(
                "group relative min-h-[15.5rem] overflow-hidden rounded-[1.35rem] border bg-gradient-to-br p-4 shadow-[0_28px_80px_-68px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_90px_-64px_currentColor]",
                pluginPlanCardClassName(plugin.requiredPlan),
                isAvailable ? "opacity-100" : "opacity-82",
              )}
            >
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-xl border shadow-[0_18px_42px_-28px_currentColor]",
                      pluginPlanIconClassName(plugin.requiredPlan),
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <Link
                    href={href}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black uppercase tracking-[0.1em] transition-colors",
                      pluginPlanButtonClassName(plugin.requiredPlan, isAvailable),
                    )}
                    aria-label={isAvailable ? `Ativar ${plugin.title}` : `Liberar ${plugin.title}`}
                  >
                    {isAvailable ? (
                      <>
                        Ativar
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        <LockKeyhole className="h-3.5 w-3.5" />
                        Liberar
                      </>
                    )}
                  </Link>
                </div>

                <div className="mt-7">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {plugin.category}
                  </p>
                  <h3 className="max-w-[12rem] text-xl font-black leading-tight text-foreground">
                    {plugin.shortTitle ?? plugin.title}
                  </h3>
                  <p className="mt-3 text-sm leading-5 text-muted-foreground">{plugin.summary}</p>
                </div>

                <div className="mt-auto pt-5">
                  <div className="h-px bg-white/10" />
                  <p className="mt-4 text-xs font-semibold leading-5 text-muted-foreground">
                    {isAvailable
                      ? "Plugin pronto para configurar quando voce precisar."
                      : `Disponivel no Plano ${plugin.requiredPlan}.`}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
