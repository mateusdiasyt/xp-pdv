import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgePercent,
  Banknote,
  Boxes,
  CheckCircle2,
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
  Store,
  UsersRound,
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
    title: "PDV rápido e comandas",
    category: "Operação",
    summary: "Venda direta, comanda avulsa, cupom, múltiplos pagamentos e ticket.",
    details:
      "Centraliza a venda do balcão e das comandas no mesmo fluxo. O operador monta itens, aplica cupom quando necessário, divide pagamentos e finaliza com comprovante térmico.",
    howItWorks: [
      "Abre venda rápida ou comanda numerada.",
      "Adiciona produtos, serviços e pagamentos.",
      "Gera comprovante, DANFE/XML quando fiscal estiver ativo e histórico da venda.",
    ],
    bestFor: "Bares, lanchonetes, conveniências e operações com atendimento rápido.",
    requiredPlan: "Ouro",
    icon: Receipt,
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
    requiredPlan: "Ouro",
    icon: Landmark,
  },
  {
    title: "Produtos e cadastros",
    category: "Gestão",
    summary: "Produtos, categorias, fornecedores e clientes organizados.",
    details:
      "Concentra os cadastros que sustentam a operação. Produtos podem ter preço, SKU, imagem, NCM, regra fiscal, estoque, receita, venda fracionada e vínculo com categorias.",
    howItWorks: [
      "Cria categorias para organizar o PDV.",
      "Cadastra produtos, fornecedores e clientes.",
      "Usa esses dados nas vendas, estoque, fiscal e relatórios.",
    ],
    bestFor: "Manter a operação padronizada antes de começar a vender.",
    requiredPlan: "Ouro",
    icon: Store,
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
    title: "Usuários e permissões",
    category: "Gestão",
    summary: "Acesso por perfil: admin, financeiro, caixa, gerente e operador.",
    details:
      "Permite criar usuários com permissões específicas para reduzir risco operacional. Cada pessoa acessa apenas o que precisa para trabalhar.",
    howItWorks: [
      "Cadastra usuário com email e senha.",
      "Define perfil e permissões.",
      "O menu só mostra as áreas liberadas para aquele usuário.",
    ],
    bestFor: "Times com caixa, financeiro e gestão separados.",
    requiredPlan: "Ouro",
    icon: UsersRound,
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Módulos"
        description="Veja tudo que o Mendoza PDV pode ativar na sua operação. Os detalhes aparecem ao passar o mouse sobre cada módulo."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/72 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Plano atual</p>
          <p className="mt-2 text-2xl font-black text-foreground">{entitlements.activePlan ?? "Sem plano ativo"}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/72 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Módulos ativos</p>
          <p className="mt-2 text-2xl font-black text-foreground">
            {
              modules.filter((module) =>
                canUseModule(entitlements.activePlan, module, module.moduleKey ? entitlements.modules[module.moduleKey] : false),
              ).length
            }
          </p>
        </div>
        <Link
          href={planHref}
          className="flex rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary transition-colors hover:bg-primary/15"
        >
          <span className="self-end text-sm font-black">Ver planos e liberar módulos premium</span>
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          const moduleEnabled = module.moduleKey ? entitlements.modules[module.moduleKey] : false;
          const isAvailable = canUseModule(entitlements.activePlan, module, moduleEnabled);
          const isPremium = module.requiredPlan === "Platina";

          return (
            <article
              key={module.title}
              className={cn(
                "group relative rounded-2xl border bg-card/78 p-4 shadow-[0_22px_70px_-54px_rgba(0,0,0,0.95)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/35 hover:bg-card",
                isAvailable ? "border-border/70" : "border-border/45 opacity-82",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge
                    className={
                      isAvailable
                        ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                        : "border-amber-300/25 bg-amber-400/10 text-amber-100"
                    }
                  >
                    {isAvailable ? "Ativo" : "Bloqueado"}
                  </Badge>
                  <Badge variant="outline">{isPremium ? "Platina" : "Ouro"}</Badge>
                </div>
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-primary">{module.category}</p>
              <h2 className="mt-2 text-xl font-black text-foreground">{module.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{module.summary}</p>

              {!isAvailable ? (
                <Link
                  href={planHref}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-black text-primary transition-colors hover:bg-primary/15"
                >
                  <LockKeyhole className="mr-2 h-3.5 w-3.5" />
                  Liberar módulo
                </Link>
              ) : (
                <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 text-xs font-black text-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Disponível na conta
                </div>
              )}

              <div className="pointer-events-none absolute left-4 right-4 top-[calc(100%-0.5rem)] z-40 translate-y-3 rounded-2xl border border-primary/30 bg-[#121012]/98 p-4 opacity-0 shadow-[0_28px_90px_-46px_rgba(0,0,0,0.98)] backdrop-blur-xl transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">{module.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/68">{module.details}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
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

                <p className="mt-3 rounded-xl border border-white/10 bg-black/22 px-3 py-2 text-xs font-semibold leading-5 text-white/68">
                  Ideal para: {module.bestFor}
                </p>
              </div>

              <details className="mt-4 rounded-xl border border-border/60 bg-background/35 p-3 text-sm md:hidden">
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
      </section>
    </div>
  );
}
