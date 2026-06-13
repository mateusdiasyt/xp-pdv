"use client";

import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import {
  BadgePercent,
  Banknote,
  BarChart3,
  Boxes,
  ClipboardList,
  FileCheck2,
  Gamepad2,
  Landmark,
  Link2,
  MessageCircle,
  Palette,
  ReceiptText,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ModulePlan = "Ouro" | "Platina";

type ModuleItem = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  plan: ModulePlan;
  summary: string;
  details: string;
  preview: ReactNode;
};

function MiniPdvPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/10 px-3 py-2">
        <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary">Venda rápida</span>
        <strong className="text-sm text-white">R$ 49,00</strong>
      </div>
      {[
        ["Chopp Pilsen", "R$ 12,00"],
        ["Batata Crinkle", "R$ 37,00"],
      ].map(([label, value]) => (
        <div key={label} className="flex items-center justify-between border-b border-white/8 py-2 text-xs">
          <span className="text-white/58">{label}</span>
          <strong className="text-white">{value}</strong>
        </div>
      ))}
      <div className="mt-3 grid grid-cols-3 gap-2 text-[0.62rem] font-black text-white/70">
        <span className="rounded-lg border border-white/10 bg-white/[0.035] px-2 py-2 text-center">Cupom</span>
        <span className="rounded-lg border border-white/10 bg-white/[0.035] px-2 py-2 text-center">Pix</span>
        <span className="rounded-lg border border-white/10 bg-white/[0.035] px-2 py-2 text-center">Ticket</span>
      </div>
    </div>
  );
}

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
                : "border-white/10 bg-white/[0.035] text-white/52",
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
          <span>Cliente: Mesa 12</span>
          <strong className="text-white">3 itens</strong>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <span>Fechar depois</span>
          <strong className="text-white">R$ 74,00</strong>
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

function MiniCouponPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary">Cupom ativo</p>
        <p className="mt-2 text-lg font-black text-white">HAPPY10</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[0.62rem] font-black text-white/68">
        {["Tudo", "Categoria", "Produto"].map((mode) => (
          <span key={mode} className="rounded-lg border border-white/10 bg-white/[0.035] px-2 py-2 text-center">
            {mode}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-white/50">Desconto</span>
        <strong className="text-white">10% ou R$ fixo</strong>
      </div>
    </div>
  );
}

function MiniFiscalPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-200">Autorizada</p>
        <p className="mt-2 text-lg font-black text-white">NFC-e #298</p>
        <p className="mt-1 text-xs text-white/52">Produção - Focus NFe</p>
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
            <p className="text-sm font-black text-white">TV 02 - Simulador</p>
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

function MiniAccountsPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      {[
        ["Internet", "Dia 10", "Fixa"],
        ["Fornecedor", "18/06", "Pendente"],
        ["Aluguel", "Dia 05", "Pago"],
      ].map(([name, due, status]) => (
        <div key={name} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/8 py-2 text-xs">
          <strong className="text-white">{name}</strong>
          <span className="text-white/48">{due}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[0.58rem] font-black text-white/58">
            {status}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniBrandPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary">Identidade</p>
        <p className="mt-2 text-lg font-black text-white">Logo + cores</p>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {["#FF0059", "#FF6600", "#121111", "#FFFFFF"].map((color) => (
          <span key={color} className="h-8 rounded-xl border border-white/12" style={{ backgroundColor: color }} />
        ))}
      </div>
      <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/62">
        Horário operacional e preferências
      </p>
    </div>
  );
}

function MiniLinkPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary">Link do PDV</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/28 px-3 py-2 text-xs font-black text-white">
          <Link2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">/app/seu-bar</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-start text-xs">
        <strong className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-emerald-200">
          Disponível
        </strong>
      </div>
    </div>
  );
}

const modules: ModuleItem[] = [
  {
    icon: ReceiptText,
    title: "PDV rápido",
    plan: "Ouro",
    summary: "Venda direta, cupom, múltiplos pagamentos e ticket térmico.",
    details:
      "O operador monta a venda de balcão, aplica cupom quando necessário, divide em várias formas de pagamento e finaliza com comprovante sem recarregar a página.",
    preview: <MiniPdvPreview />,
  },
  {
    icon: Banknote,
    title: "Caixa operacional",
    plan: "Ouro",
    summary: "Abertura, operador, suprimento, sangria e fechamento do dia.",
    details:
      "O PDV só vende com caixa aberto. O sistema controla saldo inicial, dinheiro das vendas, sangrias, suprimentos e fechamento com resumo para conferência.",
    preview: <MiniCashPreview />,
  },
  {
    icon: Boxes,
    title: "Estoque e XML",
    plan: "Ouro",
    summary: "Entrada por XML, anexos, conferência, perdas e baixa.",
    details:
      "Você pode salvar XML de compra, baixar anexos, conferir itens antes da entrada e registrar movimentações como perdas, ajustes e estoque fracionado.",
    preview: <MiniXmlPreview />,
  },
  {
    icon: BadgePercent,
    title: "Cupons inteligentes",
    plan: "Ouro",
    summary: "Desconto em valor ou porcentagem por venda, categoria ou produto.",
    details:
      "Crie cupons com limite de uso, valor mínimo, validade e escopo. O desconto pode valer para tudo, para categorias ou para produtos específicos.",
    preview: <MiniCouponPreview />,
  },
  {
    icon: BarChart3,
    title: "Relatórios e WhatsApp",
    plan: "Ouro",
    summary: "Resumo de vendas, pagamentos, caixa, lucro e itens vendidos.",
    details:
      "Acompanhe vendas por período, formas de pagamento, saldo do caixa, produtos mais vendidos, lucro estimado e envie o resumo formatado pelo WhatsApp.",
    preview: <MiniReportPreview />,
  },
  {
    icon: Palette,
    title: "Marca e configurações",
    plan: "Ouro",
    summary: "Logo, cores, nome do painel, horário operacional e preferências.",
    details:
      "Personalize o ambiente do cliente com logo, cores, nome da aba, horário de funcionamento e preferências importantes para a rotina do PDV.",
    preview: <MiniBrandPreview />,
  },
  {
    icon: ClipboardList,
    title: "Comandas",
    plan: "Platina",
    summary: "Comandas avulsas, nomes, itens em aberto e fechamento posterior.",
    details:
      "Ideal para consumo em aberto. A equipe cria ou renomeia comandas, adiciona itens durante o atendimento e fecha tudo depois com as formas de pagamento do PDV.",
    preview: <MiniCommandPreview />,
  },
  {
    icon: Landmark,
    title: "Contas a pagar",
    plan: "Platina",
    summary: "Planilha de contas fixas, parceladas, vencimentos e comprovantes.",
    details:
      "Organize despesas recorrentes e parceladas em formato de planilha, acompanhe vencimentos, anexe comprovantes e receba alertas no sino do painel.",
    preview: <MiniAccountsPreview />,
  },
  {
    icon: FileCheck2,
    title: "Fiscal Focus NFe",
    plan: "Platina",
    summary: "NFC-e, DANFE, XML e ambiente fiscal por cliente.",
    details:
      "Cada cliente informa seus próprios tokens, CNPJ e regras fiscais. Dá para operar em homologação ou produção e manter XML/DANFE vinculados às vendas.",
    preview: <MiniFiscalPreview />,
  },
  {
    icon: Gamepad2,
    title: "App TV para Smart TVs",
    plan: "Platina",
    summary: "Controle de tempo para PS5, simulador, sinuca e videogames.",
    details:
      "Funciona em TVs com Google TV ou Android TV compatível. O app bloqueia e libera estações, cobra por minuto, controla modo livre e exige atualização quando houver nova versão.",
    preview: <MiniTvPreview />,
  },
  {
    icon: Link2,
    title: "Link personalizado",
    plan: "Platina",
    summary: "Endereço próprio para o PDV do cliente.",
    details:
      "O cliente escolhe um link exclusivo para acessar o ambiente do PDV. O sistema verifica disponibilidade e aplica o endereço sem misturar com outros clientes.",
    preview: <MiniLinkPreview />,
  },
];

function pluginAccentClassName(index: number) {
  const accents = [
    "border-primary/55 from-primary/14 via-[#0b1418] to-[#111114] text-primary",
    "border-violet-300/28 from-violet-400/16 via-[#0b1418] to-[#111114] text-violet-200",
    "border-cyan-300/28 from-cyan-300/16 via-[#0b1418] to-[#111114] text-cyan-200",
    "border-orange-300/28 from-orange-300/16 via-[#0b1418] to-[#111114] text-orange-200",
    "border-emerald-300/28 from-emerald-300/16 via-[#0b1418] to-[#111114] text-emerald-200",
    "border-sky-300/28 from-sky-300/16 via-[#0b1418] to-[#111114] text-sky-200",
  ];

  return accents[index % accents.length];
}

function ModuleCard({ item, index }: { item: ModuleItem; index: number }) {
  const Icon = item.icon;

  return (
    <article className={cn("group relative min-h-[25rem] overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-[0_28px_86px_-70px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_34px_100px_-76px_rgba(255,0,89,0.55)]", pluginAccentClassName(index))}>
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-current/20 bg-current/12 shadow-[0_18px_42px_-30px_currentColor]">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-7 min-h-[8rem]">
        <h3 className="max-w-[13rem] text-xl font-black leading-tight text-white">{item.title}</h3>
        <p className="mt-3 text-sm leading-5 text-white/60">{item.summary}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/18">
        {item.preview}
      </div>

      <div className="pointer-events-none absolute inset-3 z-10 flex translate-y-3 flex-col justify-end rounded-[1.35rem] border border-white/10 bg-[#09080a]/95 p-4 opacity-0 shadow-[0_24px_80px_-50px_rgba(0,0,0,1)] backdrop-blur-xl transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Como funciona</p>
        <h3 className="mt-2 text-2xl font-black leading-tight text-white">{item.title}</h3>
        <p className="mt-3 text-sm font-black leading-6 text-primary">{item.summary}</p>
        <p className="mt-4 text-sm leading-7 text-white/70">{item.details}</p>
      </div>
    </article>
  );
}

export function LandingModulesSection() {
  const [selectedPlan, setSelectedPlan] = useState<ModulePlan>("Ouro");
  const visibleModules = modules.filter((moduleItem) => moduleItem.plan === selectedPlan);

  return (
    <section id="plugins" className="px-4 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Plugins do PDV</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              Confira os plugins disponíveis no Mendoza PDV
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/58">
              O plano Ouro cobre a operação essencial. O Platina adiciona plugins avançados para bares, serviços por tempo,
              fiscal e crescimento do negócio.
            </p>
          </div>

          <div className="inline-grid w-full max-w-sm grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
            {(["Ouro", "Platina"] as ModulePlan[]).map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => setSelectedPlan(plan)}
                className={cn(
                  "h-10 rounded-xl text-sm font-black transition-all",
                  selectedPlan === plan
                    ? "bg-primary text-primary-foreground shadow-[0_16px_44px_-26px_hsl(var(--primary))]"
                    : "text-white/58 hover:bg-white/8 hover:text-white",
                )}
                aria-pressed={selectedPlan === plan}
              >
                {plan} ({modules.filter((moduleItem) => moduleItem.plan === plan).length})
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((item, index) => (
            <ModuleCard key={item.title} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
