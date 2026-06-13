import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgePercent,
  Banknote,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Gamepad2,
  Landmark,
  LineChart,
  LockKeyhole,
  MoreVertical,
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

type PluginAccent = "pink" | "purple" | "cyan" | "orange" | "green" | "blue";

type PluginCard = {
  title: string;
  shortTitle?: string;
  category: "Operacao" | "Financeiro" | "Fiscal" | "Gestao" | "Premium";
  summary: string;
  requiredPlan: PlatformPlanName;
  moduleKey?: PlatformModuleKey;
  icon: LucideIcon;
  href: string;
  accent: PluginAccent;
};

const planRank: Record<PlatformPlanName, number> = {
  Ouro: 1,
  Platina: 2,
};

const pluginAccentClassName: Record<PluginAccent, string> = {
  pink: "border-primary/75 from-primary/18 via-[#0d181d] to-[#101114] text-primary shadow-primary/20",
  purple: "border-violet-400/35 from-violet-400/18 via-[#0d181d] to-[#101114] text-violet-200 shadow-violet-400/20",
  cyan: "border-cyan-300/35 from-cyan-300/18 via-[#0d181d] to-[#101114] text-cyan-200 shadow-cyan-300/20",
  orange: "border-orange-300/35 from-orange-300/18 via-[#0d181d] to-[#101114] text-orange-200 shadow-orange-300/20",
  green: "border-emerald-300/35 from-emerald-300/18 via-[#0d181d] to-[#101114] text-emerald-200 shadow-emerald-300/20",
  blue: "border-sky-300/35 from-sky-300/18 via-[#0d181d] to-[#101114] text-sky-200 shadow-sky-300/20",
};

const pluginIconClassName: Record<PluginAccent, string> = {
  pink: "border-primary/25 bg-primary/18 text-primary",
  purple: "border-violet-300/25 bg-violet-400/18 text-violet-200",
  cyan: "border-cyan-300/25 bg-cyan-300/18 text-cyan-200",
  orange: "border-orange-300/25 bg-orange-300/18 text-orange-200",
  green: "border-emerald-300/25 bg-emerald-300/18 text-emerald-200",
  blue: "border-sky-300/25 bg-sky-300/18 text-sky-200",
};

const pluginToggleClassName: Record<PluginAccent, string> = {
  pink: "bg-primary",
  purple: "bg-violet-500",
  cyan: "bg-cyan-400",
  orange: "bg-orange-400",
  green: "bg-emerald-400",
  blue: "bg-sky-400",
};

const plugins: PluginCard[] = [
  {
    title: "PDV rapido",
    category: "Operacao",
    summary: "Atende vendas rapidas de balcao sem abrir comanda.",
    requiredPlan: "Ouro",
    icon: Receipt,
    href: "/admin/pdv",
    accent: "pink",
  },
  {
    title: "Caixa operacional",
    category: "Financeiro",
    summary: "Abertura, operador, suprimento, sangria e fechamento do dia.",
    requiredPlan: "Ouro",
    icon: Banknote,
    href: "/admin/pdv",
    accent: "purple",
  },
  {
    title: "Estoque e XML",
    category: "Operacao",
    summary: "Entradas por XML, anexos, produtos fracionados, perdas e baixa.",
    requiredPlan: "Ouro",
    icon: Boxes,
    href: "/admin/stock",
    accent: "cyan",
  },
  {
    title: "Cupons inteligentes",
    category: "Operacao",
    summary: "Desconto em valor ou porcentagem por venda, categoria ou produto.",
    requiredPlan: "Ouro",
    icon: BadgePercent,
    href: "/admin/coupons",
    accent: "orange",
  },
  {
    title: "Relatorios e WhatsApp",
    shortTitle: "Relatorios e WhatsApp",
    category: "Financeiro",
    summary: "Resumo de vendas, pagamentos, caixa, lucro e itens vendidos.",
    requiredPlan: "Ouro",
    icon: LineChart,
    href: "/admin/reports",
    accent: "green",
  },
  {
    title: "Marca e configuracoes",
    category: "Gestao",
    summary: "Logo, cores, nome do painel, horario operacional e preferencias.",
    requiredPlan: "Ouro",
    icon: Palette,
    href: "/admin/customization",
    accent: "blue",
  },
  {
    title: "Comandas",
    category: "Operacao",
    summary: "Comandas avulsas, nomes, itens em aberto e fechamento posterior.",
    requiredPlan: "Platina",
    icon: ClipboardList,
    href: "/admin/pdv",
    accent: "pink",
  },
  {
    title: "Contas a pagar",
    category: "Financeiro",
    summary: "Planilha de contas fixas, parceladas, vencimentos e comprovantes.",
    requiredPlan: "Platina",
    icon: Landmark,
    href: "/admin/accounts",
    accent: "green",
  },
  {
    title: "Fiscal Focus NFe",
    category: "Fiscal",
    summary: "NFC-e, DANFE, XML e ambiente fiscal por cliente.",
    requiredPlan: "Platina",
    moduleKey: "fiscal-focus",
    icon: FileCheck2,
    href: "/admin/fiscal",
    accent: "orange",
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
    accent: "purple",
  },
  {
    title: "Link personalizado",
    category: "Premium",
    summary: "Endereco proprio e exclusivo para acessar o PDV do cliente.",
    requiredPlan: "Platina",
    moduleKey: "custom-link",
    icon: Plug,
    href: "/admin/customization",
    accent: "cyan",
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
        description="Recursos organizados por plano, com status claro para saber o que esta liberado na sua conta."
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
              <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">Liberados</p>
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
                "group relative min-h-[17.5rem] overflow-hidden rounded-[1.35rem] border bg-gradient-to-br p-4 shadow-[0_28px_80px_-68px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_90px_-64px_rgba(255,0,89,0.35)]",
                pluginAccentClassName[plugin.accent],
                isAvailable ? "opacity-100" : "opacity-82",
              )}
            >
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-xl border shadow-[0_18px_42px_-28px_currentColor]",
                      pluginIconClassName[plugin.accent],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md border px-2 py-1 text-[0.64rem] font-black uppercase tracking-[0.12em]",
                        isAvailable
                          ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                          : "border-amber-300/25 bg-amber-300/10 text-amber-200",
                      )}
                    >
                      {isAvailable ? "Ativo" : "Bloqueado"}
                    </span>
                    <Link
                      href={href}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-black/24 text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
                      aria-label={isAvailable ? `Abrir ${plugin.title}` : `Liberar ${plugin.title}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                <div className="mt-7 min-h-[7.25rem]">
                  <h3 className="max-w-[12rem] text-xl font-black leading-tight text-foreground">
                    {plugin.shortTitle ?? plugin.title}
                  </h3>
                  <p className="mt-3 text-sm leading-5 text-muted-foreground">{plugin.summary}</p>
                </div>

                <div className="mt-auto border-t border-white/10 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Plano</p>
                      <p className="mt-1 text-sm font-black text-foreground">{plugin.requiredPlan}</p>
                    </div>
                    <div className="border-l border-white/10 pl-4">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className={cn("mt-1 text-sm font-black", isAvailable ? "text-emerald-300" : "text-amber-200")}>
                        {isAvailable ? "Liberado" : "Pendente"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <span
                      className={cn(
                        "relative h-5 w-10 rounded-full transition-colors",
                        isAvailable ? pluginToggleClassName[plugin.accent] : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
                          isAvailable ? "translate-x-[1.35rem]" : "translate-x-0.5",
                        )}
                      />
                    </span>
                  </div>

                  {!isAvailable ? (
                    <Link
                      href={planHref}
                      className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-sm font-black text-primary transition-colors hover:bg-primary/15"
                    >
                      <LockKeyhole className="mr-2 h-4 w-4" />
                      Liberar plugin
                    </Link>
                  ) : (
                    <div className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/18 bg-emerald-300/8 text-sm font-black text-emerald-200">
                      <CheckCircle2 className="h-4 w-4" />
                      Disponivel na conta
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
