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
  Palette,
  Plug,
  Receipt,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { requireSession } from "@/application/auth/guards";
import { buildTenantAdminPath, getTenantModuleEntitlements } from "@/application/platform/platform-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import type { PlatformModuleKey, PlatformPlanName } from "@/domain/platform/plan-entitlements";
import { cn } from "@/lib/utils";

type ModuleCard = {
  title: string;
  category: "Operação" | "Financeiro" | "Fiscal" | "Gestão" | "Premium";
  summary: string;
  details: string;
  howItWorks: string[];
  bestFor: string;
  requiredPlan: PlatformPlanName;
  moduleKey?: PlatformModuleKey;
  icon: LucideIcon;
};

const planRank: Record<PlatformPlanName, number> = {
  Ouro: 1,
  Platina: 2,
};

const modules: ModuleCard[] = [
  {
    title: "PDV rápido",
    category: "Operação",
    summary: "Venda direta, cupom, múltiplos pagamentos e ticket térmico.",
    details:
      "Atende vendas rápidas de balcão sem abrir comanda. O operador monta itens, aplica cupom quando necessário, divide pagamentos e finaliza com comprovante térmico.",
    howItWorks: [
      "Abre a venda rápida no PDV.",
      "Adiciona produtos, serviços, cupom e pagamentos.",
      "Gera comprovante, DANFE/XML quando fiscal estiver ativo e histórico da venda.",
    ],
    bestFor: "Balcão, conveniências, lanchonetes e operações com atendimento rápido.",
    requiredPlan: "Ouro",
    icon: Receipt,
  },
  {
    title: "Comandas",
    category: "Operação",
    summary: "Comandas avulsas, nomes, itens em aberto e fechamento posterior.",
    details:
      "Permite trabalhar com consumo em aberto antes do pagamento. A equipe cria ou renomeia comandas, adiciona itens durante o atendimento e finaliza tudo no fechamento.",
    howItWorks: [
      "Cria comanda numerada ou avulsa.",
      "Adiciona e remove itens enquanto o cliente consome.",
      "Fecha a comanda com as mesmas formas de pagamento do PDV.",
    ],
    bestFor: "Bares e operações em que o cliente consome primeiro e paga no fim.",
    requiredPlan: "Platina",
    icon: ClipboardList,
  },
  {
    title: "Caixa operacional",
    category: "Financeiro",
    summary: "Abertura, operador, suprimento, sangria e fechamento do dia.",
    details:
      "Garante que o PDV só venda com caixa aberto. Controla dinheiro inicial, entradas, saídas, vendas em dinheiro e relatório final para conferência.",
    howItWorks: [
      "Operador abre o caixa com saldo inicial.",
      "Sangrias e suprimentos ficam registrados.",
      "Fechamento mostra o saldo esperado e resumo para impressão.",
    ],
    bestFor: "Quem precisa reduzir divergência de caixa no fechamento.",
    requiredPlan: "Ouro",
    icon: Banknote,
  },
  {
    title: "Estoque e XML",
    category: "Operação",
    summary: "Entrada por XML, anexos, produtos fracionados, perdas e baixa.",
    details:
      "Permite salvar XML de compra, conferir itens antes da entrada, baixar anexos e registrar movimentações como perdas, ajustes e estoque fracionado.",
    howItWorks: [
      "Salva o XML como documento anexado.",
      "Mostra prévia dos itens antes de mexer no estoque.",
      "Registra entrada, perda ou ajuste com log de estoque.",
    ],
    bestFor: "Operações que compram por nota e vendem itens fracionados, como chopp e doses.",
    requiredPlan: "Ouro",
    icon: Boxes,
  },
  {
    title: "Cupons inteligentes",
    category: "Operação",
    summary: "Desconto em valor ou porcentagem por venda, categoria ou produto.",
    details:
      "Cria regras promocionais com limite de uso, valor mínimo, validade e escopo. O cupom pode valer para tudo, para categorias ou para produtos específicos.",
    howItWorks: [
      "Define tipo de desconto, limite e validade.",
      "Escolhe se vale para tudo, categoria ou produtos selecionados.",
      "O PDV calcula o desconto na finalização.",
    ],
    bestFor: "Promoções controladas sem depender de desconto manual no caixa.",
    requiredPlan: "Ouro",
    icon: BadgePercent,
  },
  {
    title: "Relatórios e WhatsApp",
    category: "Financeiro",
    summary: "Resumo de vendas, pagamentos, caixa, lucro e itens vendidos.",
    details:
      "Mostra vendas por período, formas de pagamento, resumo do caixa, produtos mais vendidos, custos, lucro e envio do relatório formatado pelo WhatsApp.",
    howItWorks: [
      "Seleciona período ou usa o relatório do caixa.",
      "Consolida Pix, dinheiro, crédito, débito e cancelamentos.",
      "Imprime em formato térmico ou envia o resumo pelo WhatsApp.",
    ],
    bestFor: "Acompanhar resultado sem planilha paralela.",
    requiredPlan: "Ouro",
    icon: LineChart,
  },
  {
    title: "Contas a pagar",
    category: "Financeiro",
    summary: "Planilha de contas fixas, parceladas, vencimentos e comprovantes.",
    details:
      "Organiza contas recorrentes e parceladas em formato de planilha, com status, vencimento, comprovante anexado e alerta no sino do painel.",
    howItWorks: [
      "Cadastra conta fixa por dia do mês ou conta parcelada por vencimento.",
      "Anexa comprovante quando pagar.",
      "O sino avisa contas vencidas ou próximas do vencimento.",
    ],
    bestFor: "Controlar despesas do negócio dentro do mesmo painel.",
    requiredPlan: "Platina",
    icon: Landmark,
  },
  {
    title: "Marca e configurações",
    category: "Gestão",
    summary: "Logo, cores, nome do painel, horário operacional e preferências.",
    details:
      "Permite deixar o ambiente com a identidade do cliente e ajustar regras de operação, como horário de funcionamento, visual do painel, logo interna e dados globais do negócio.",
    howItWorks: [
      "Atualiza logo e cores usadas no painel.",
      "Define horário operacional e preferências da empresa.",
      "Mantém fiscal e link personalizado separados quando o plano liberar.",
    ],
    bestFor: "Clientes que querem o PDV com cara própria e operação bem configurada.",
    requiredPlan: "Ouro",
    icon: Palette,
  },
  {
    title: "Fiscal Focus NFe",
    category: "Fiscal",
    summary: "NFC-e, DANFE, XML e ambiente fiscal por cliente.",
    details:
      "Integra com a Focus NFe usando credenciais próprias do cliente. Permite operar em homologação ou produção, emitir NFC-e, guardar XML e abrir DANFE.",
    howItWorks: [
      "Cliente informa tokens, CNPJ e dados fiscais.",
      "Produtos e categorias carregam NCM, CFOP, CSOSN e origem.",
      "As próximas vendas usam a regra fiscal configurada.",
    ],
    bestFor: "Empresas que precisam emitir documentos fiscais diretamente pelo PDV.",
    requiredPlan: "Platina",
    moduleKey: "fiscal-focus",
    icon: FileCheck2,
  },
  {
    title: "App TV para Smart TVs",
    category: "Premium",
    summary: "Controle de tempo para PS5, simulador, sinuca e videogames.",
    details:
      "Usa o APK Mendoza TV em aparelhos com Google TV para bloquear/liberar estações, cobrar por tempo, controlar modo livre e exigir atualização do app quando houver nova versão.",
    howItWorks: [
      "Instala o APK na TV compatível com Google TV.",
      "Pareia a estação com o PDV.",
      "Libera tempo grátis ou pago, pausa, encerra e gera cobrança quando necessário.",
    ],
    bestFor: "Arcades, bares com PS5, simulador, sinuca ou cobrança por minuto.",
    requiredPlan: "Platina",
    moduleKey: "tv-app",
    icon: Gamepad2,
  },
  {
    title: "Link personalizado",
    category: "Premium",
    summary: "Endereço próprio para o PDV do cliente.",
    details:
      "Permite escolher um link exclusivo para acessar o ambiente do cliente. O sistema verifica disponibilidade para evitar links duplicados.",
    howItWorks: [
      "Cliente digita o link desejado em Configurações.",
      "Sistema verifica se está disponível.",
      "Depois de aplicado, o acesso passa a usar o endereço personalizado.",
    ],
    bestFor: "Clientes que querem um acesso mais profissional e fácil de memorizar.",
    requiredPlan: "Platina",
    moduleKey: "custom-link",
    icon: Plug,
  },
];

function canUseModule(activePlan: PlatformPlanName | null, module: ModuleCard, moduleEnabled: boolean) {
  if (module.moduleKey) {
    return moduleEnabled;
  }

  return Boolean(activePlan && planRank[activePlan] >= planRank[module.requiredPlan]);
}

export default async function ModulesPage() {
  const session = await requireSession();
  const isAdmin = session.user.roleSlug === "administrador";

  if (!isAdmin && !hasPermission(session.user.permissions, PERMISSIONS.MODULES_VIEW)) {
    redirect("/forbidden");
  }

  const entitlements = await getTenantModuleEntitlements(session.user.tenantSlug);
  const planHref = buildTenantAdminPath(session.user.tenantSlug, "/admin/payment");
  const availableModuleCount = modules.filter((module) =>
    canUseModule(entitlements.activePlan, module, module.moduleKey ? entitlements.modules[module.moduleKey] : false),
  ).length;
  const moduleGroups: Array<{
    plan: PlatformPlanName;
    title: string;
    description: string;
    tone: string;
  }> = [
    {
      plan: "Ouro",
      title: "Base operacional",
      description: "Módulos essenciais para vender, controlar caixa, estoque, cupons, relatórios e identidade do PDV.",
      tone: "from-amber-300/18 via-primary/8 to-transparent",
    },
    {
      plan: "Platina",
      title: "Módulos avançados",
      description: "Recursos premium para comandas, contas, fiscal Focus NFe, App TV e link personalizado.",
      tone: "from-cyan-300/16 via-primary/10 to-transparent",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Módulos"
        description="Uma biblioteca de recursos para ativar conforme a operação cresce. Passe o mouse sobre um módulo para ver como ele funciona."
      />

      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-[#151214] p-5 shadow-[0_30px_90px_-70px_rgba(0,0,0,0.95)] md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,0,89,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,102,0,0.12),transparent_36%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Biblioteca de plugins</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-foreground md:text-4xl">
              Módulos organizados por plano, com ativação clara e visual de produto real.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              O plano Ouro mantém o PDV rodando com a operação base. O Platina libera módulos mais avançados para quem precisa de mais controle.
            </p>
          </div>

          <div className="grid min-w-72 grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">Plano</p>
              <p className="mt-2 text-lg font-black text-foreground">{entitlements.activePlan ?? "Sem plano"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">Ativos</p>
              <p className="mt-2 text-lg font-black text-foreground">
                {availableModuleCount}/{modules.length}
              </p>
            </div>
            <Link
              href={planHref}
              className="col-span-2 flex rounded-2xl border border-primary/30 bg-primary px-4 py-3 text-primary-foreground shadow-[0_18px_45px_-26px_rgba(255,0,89,0.9)] transition-transform hover:-translate-y-0.5 sm:col-span-1"
            >
              <span className="self-end text-sm font-black">Gerenciar plano</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {moduleGroups.map((group) => {
          const groupModules = modules.filter((module) => module.requiredPlan === group.plan);

          return (
            <section key={group.plan} className="rounded-3xl border border-border/65 bg-card/58 p-4 md:p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <Badge className="border-primary/20 bg-primary/10 text-primary">{group.plan}</Badge>
                  <h2 className="mt-3 text-2xl font-black text-foreground">{group.title}</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{group.description}</p>
                </div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {groupModules.length} módulos
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {groupModules.map((module) => {
                  const Icon = module.icon;
                  const moduleEnabled = module.moduleKey ? entitlements.modules[module.moduleKey] : false;
                  const isAvailable = canUseModule(entitlements.activePlan, module, moduleEnabled);
                  const isPremium = module.requiredPlan === "Platina";

                  return (
                    <article
                      key={module.title}
                      className={cn(
                        "group relative min-h-80 overflow-hidden rounded-[1.7rem] border bg-[#111012] p-4 shadow-[0_28px_90px_-70px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_34px_95px_-68px_rgba(255,0,89,0.7)]",
                        isAvailable ? "border-white/12" : "border-white/8",
                      )}
                    >
                      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", group.tone)} />
                      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent" />

                      <div className="relative flex h-full min-h-72 flex-col">
                        <div className="flex items-start justify-between gap-4">
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-white/10 bg-black/36 text-primary shadow-inner">
                            <div className="absolute inset-2 rounded-2xl bg-primary/18 blur-md" />
                            <Icon className="relative h-6 w-6" />
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em]",
                                isAvailable
                                  ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                                  : "border-amber-300/25 bg-amber-400/10 text-amber-100",
                              )}
                            >
                              {isAvailable ? "Ativo" : "Bloqueado"}
                            </span>
                            <span className="rounded-full border border-white/10 bg-black/28 px-2.5 py-1 text-[0.68rem] font-black text-foreground">
                              {isPremium ? "Platina" : "Ouro"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-7">
                          <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-primary">
                            Módulo - {module.category}
                          </p>
                          <h3 className="mt-2 text-2xl font-black leading-tight text-foreground">{module.title}</h3>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{module.summary}</p>
                        </div>

                        <div className="mt-auto pt-5">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
                              <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-muted-foreground">Plano</p>
                              <p className="mt-1 text-sm font-black text-foreground">{module.requiredPlan}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
                              <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                              <p className={cn("mt-1 text-sm font-black", isAvailable ? "text-emerald-200" : "text-amber-200")}>
                                {isAvailable ? "Liberado" : "Pendente"}
                              </p>
                            </div>
                          </div>

                          {!isAvailable ? (
                            <Link
                              href={planHref}
                              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-sm font-black text-primary transition-colors hover:bg-primary/15"
                            >
                              <LockKeyhole className="mr-2 h-4 w-4" />
                              Liberar módulo
                            </Link>
                          ) : (
                            <div className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-sm font-black text-emerald-100">
                              <CheckCircle2 className="h-4 w-4" />
                              Disponível na conta
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pointer-events-none absolute inset-3 rounded-[1.35rem] border border-primary/25 bg-[#09080a]/96 p-4 opacity-0 shadow-[0_22px_80px_-48px_rgba(0,0,0,1)] backdrop-blur-xl transition-all duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Detalhes do módulo</p>
                            <h3 className="mt-1 text-lg font-black text-white">{module.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-white/68">{module.details}</p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-primary">Como funciona</p>
                          <ul className="mt-2 space-y-2 text-sm leading-5 text-white/72">
                            {module.howItWorks.map((item) => (
                              <li key={item} className="flex gap-2">
                                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold leading-5 text-white/68">
                          Ideal para: {module.bestFor}
                        </p>
                      </div>

                      <details className="relative mt-4 rounded-2xl border border-border/60 bg-background/35 p-3 text-sm md:hidden">
                        <summary className="cursor-pointer font-black text-foreground">Ver detalhes</summary>
                        <p className="mt-3 leading-6 text-muted-foreground">{module.details}</p>
                        <ul className="mt-3 space-y-2 text-muted-foreground">
                          {module.howItWorks.map((item) => (
                            <li key={item}>- {item}</li>
                          ))}
                        </ul>
                      </details>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
