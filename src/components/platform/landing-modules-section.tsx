"use client";

import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import {
  Banknote,
  BarChart3,
  Boxes,
  FileCheck2,
  Gamepad2,
  Link2,
  MessageCircle,
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
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-white/50">Status</span>
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
    title: "PDV rápido e comandas",
    plan: "Ouro",
    summary: "Venda limpa, com cupom e múltiplos pagamentos.",
    details:
      "Ideal para balcão e mesa: o atendente monta a venda, usa cupom quando precisar, divide em várias formas de pagamento e imprime o ticket sem sair do fluxo.",
    preview: <MiniCommandPreview />,
  },
  {
    icon: Banknote,
    title: "Caixa operacional",
    plan: "Ouro",
    summary: "Abertura, operador e fechamento do dia.",
    details:
      "Antes de vender, o operador abre o caixa com valor inicial. Durante o dia registra sangria e suprimento. No fechamento, o sistema cruza dinheiro, Pix, cartão e vendas.",
    preview: <MiniCashPreview />,
  },
  {
    icon: Boxes,
    title: "Estoque e XML",
    plan: "Ouro",
    summary: "Entrada por XML com conferência.",
    details:
      "Você pode apenas guardar o XML para consulta ou transformar a compra em entrada de estoque. O histórico fica anexado para baixar e conferir depois.",
    preview: <MiniXmlPreview />,
  },
  {
    icon: BarChart3,
    title: "Relatórios claros",
    plan: "Ouro",
    summary: "Resumo de vendas, caixa e pagamentos.",
    details:
      "Os relatórios mostram vendas por período, formas de pagamento, saldo do caixa, itens mais vendidos, lucro estimado e resumo pronto para impressão ou WhatsApp.",
    preview: <MiniReportPreview />,
  },
  {
    icon: FileCheck2,
    title: "NFe e NFC-e com Focus NFe",
    plan: "Platina",
    summary: "API fiscal integrada no sistema.",
    details:
      "Cada cliente informa seus próprios dados da Focus NFe no painel. Dá para usar homologação para testes e produção quando a emissão fiscal estiver pronta.",
    preview: <MiniFiscalPreview />,
  },
  {
    icon: Gamepad2,
    title: "App TV para Smart TVs",
    plan: "Platina",
    summary: "Cobrança por tempo para qualquer videogame.",
    details:
      "Funciona em TVs com Google TV/Android TV compatíveis. O app controla bloqueio, tempo liberado, atualização obrigatória e cobrança por minuto conforme o serviço cadastrado.",
    preview: <MiniTvPreview />,
  },
  {
    icon: Link2,
    title: "Link personalizado do seu PDV",
    plan: "Platina",
    summary: "Seu painel com endereço próprio.",
    details:
      "O cliente escolhe um endereço único para acessar o painel. O sistema verifica se o link está disponível e aplica no ambiente, sem misturar com outros PDVs.",
    preview: <MiniLinkPreview />,
  },
];

function planBadgeClassName(plan: ModulePlan) {
  return plan === "Ouro"
    ? "border-amber-300/28 bg-amber-300/10 text-amber-100"
    : "border-sky-200/28 bg-sky-200/10 text-sky-100";
}

function ModuleCard({ item }: { item: ModuleItem }) {
  const Icon = item.icon;

  return (
    <article
      tabIndex={0}
      className="group/card h-[24rem] outline-none [perspective:1400px]"
      aria-label={`${item.title} - Plano ${item.plan}`}
    >
      <div className="relative h-full rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] group-hover/card:[transform:rotateY(180deg)] group-focus-visible/card:[transform:rotateY(180deg)] motion-reduce:transition-none motion-reduce:group-hover/card:[transform:none] motion-reduce:group-focus-visible/card:[transform:none]">
        <div className="absolute inset-0 grid gap-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_22px_80px_-72px_rgba(0,0,0,0.95)] [backface-visibility:hidden]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <span className={cn("rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.16em]", planBadgeClassName(item.plan))}>
              {item.plan}
            </span>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-black text-white">{item.title}</h3>
            {item.preview}
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-primary/28 bg-[#13090e]/96 p-5 shadow-[0_28px_90px_-56px_rgba(0,0,0,0.95)] [backface-visibility:hidden] [transform:rotateY(180deg)] motion-reduce:hidden">
          <div>
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className={cn("rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.16em]", planBadgeClassName(item.plan))}>
                Plano {item.plan}
              </span>
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-2xl font-black leading-tight text-white">{item.title}</h3>
            <p className="mt-4 text-sm font-black leading-6 text-primary">{item.summary}</p>
            <p className="mt-4 text-sm leading-7 text-white/70">{item.details}</p>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white/48">
            Mendoza PDV
          </div>
        </div>
      </div>
    </article>
  );
}

export function LandingModulesSection() {
  const [selectedPlan, setSelectedPlan] = useState<ModulePlan>("Ouro");
  const visibleModules = modules.filter((moduleItem) => moduleItem.plan === selectedPlan);

  return (
    <section id="modulos" className="px-4 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Módulos do PDV</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              Confira agora alguns de nossos módulos disponíveis
            </h2>
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
                    : "text-white/58 hover:bg-white/8 hover:text-white"
                )}
                aria-pressed={selectedPlan === plan}
              >
                {plan}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((item) => (
            <ModuleCard key={item.title} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
