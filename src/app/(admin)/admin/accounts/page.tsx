import Link from "next/link";

import { AccountPayableStatus } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

import { getAccountsData } from "@/application/accounts/account-payable-service";
import { requirePermission } from "@/application/auth/guards";
import { PageHeader } from "@/components/admin/page-header";
import { MetricCard } from "@/components/admin/metric-card";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";
import { AccountsSpreadsheet } from "@/presentation/admin/accounts/accounts-spreadsheet";

type AccountsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    range?: string;
  }>;
};

function parseStatus(value?: string) {
  if (!value || value === "ALL") {
    return undefined;
  }

  return Object.values(AccountPayableStatus).includes(value as AccountPayableStatus)
    ? (value as AccountPayableStatus)
    : undefined;
}

function serializeDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  await requirePermission(PERMISSIONS.CASH_VIEW);

  const params = await searchParams;
  const status = parseStatus(params.status);
  const dueSoon = params.range === "due";
  const { accounts, summary, setupPending } = await getAccountsData({
    search: params.q?.trim() || undefined,
    status,
    dueSoon,
  });

  const serializedAccounts = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    amount: Number(account.amount),
    dueDate: serializeDateOnly(account.dueDate),
    status: account.status,
    installmentNumber: account.installmentNumber,
    installmentTotal: account.installmentTotal,
    notes: account.notes,
    receiptDataUrl: account.receiptDataUrl,
    receiptFileName: account.receiptFileName,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Contas"
        description="Controle simples de contas fixas, vencimentos, parcelas e comprovantes."
      />

      {setupPending ? (
        <div className="rounded-[1.35rem] border border-amber-400/30 bg-amber-400/8 px-4 py-4 text-sm text-amber-100">
          A aba ja esta no painel, mas o banco deste ambiente ainda nao recebeu a tabela `AccountPayable`.
        </div>
      ) : (
        <>
          <section className="grid gap-3 lg:grid-cols-4">
            <MetricCard
              title="Pendentes"
              value={formatCurrency(Number(summary?.pending._sum.amount ?? 0))}
              helper={`${summary?.pending._count ?? 0} conta(s) abertas`}
            />
            <MetricCard
              title="Atrasadas"
              value={formatCurrency(Number(summary?.overdue._sum.amount ?? 0))}
              helper={`${summary?.overdue._count ?? 0} vencida(s)`}
            />
            <MetricCard
              title="Proximas"
              value={String(summary?.dueSoon._count ?? 0)}
              helper="Vencem em ate 5 dias"
            />
            <MetricCard
              title="Pagas"
              value={formatCurrency(Number(summary?.paid._sum.amount ?? 0))}
              helper={`${summary?.paid._count ?? 0} conta(s) quitadas`}
            />
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/accounts"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/80 bg-background/85 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
            >
              Todas
            </Link>
            <Link
              href="/admin/accounts?status=PENDING"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/80 bg-background/85 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
            >
              <Clock3 className="h-4 w-4" />
              Pendentes
            </Link>
            <Link
              href="/admin/accounts?status=PAID"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/80 bg-background/85 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
            >
              <CheckCircle2 className="h-4 w-4" />
              Pagas
            </Link>
            <Link
              href="/admin/accounts?status=PENDING&range=due"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 text-sm font-medium text-amber-100 shadow-sm transition-colors hover:border-amber-300/55 hover:bg-amber-400/15"
            >
              <AlertTriangle className="h-4 w-4" />
              Perto de vencer
            </Link>
            <Link
              href="/admin/accounts"
              className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
            >
              Limpar filtros
            </Link>
          </div>

          <AccountsSpreadsheet accounts={serializedAccounts} />
        </>
      )}
    </div>
  );
}
