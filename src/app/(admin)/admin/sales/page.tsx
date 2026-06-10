import { Search } from "lucide-react";
import { SaleStatus } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import { getSalesHistoryData } from "@/application/pdv/pdv-service";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { SalesHistoryTable } from "@/presentation/admin/pdv/sales-history-table";

type SalesPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

const statusOptions = [
  { label: "Todas", value: "all" },
  { label: "Concluidas", value: SaleStatus.COMPLETED },
  { label: "Canceladas", value: SaleStatus.CANCELLED },
];

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const session = await requirePermission(PERMISSIONS.SALES_VIEW);
  const filters = await searchParams;
  const sales = await getSalesHistoryData({
    query: filters.q,
    status: filters.status,
  });
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.PDV_MANAGE);
  const canCancel = hasPermission(session.user.permissions, PERMISSIONS.PDV_CANCEL);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operacao"
        title="Todas as vendas"
        description="Historico completo para comprovante, NFC-e, XML e cancelamento."
      />

      <Card className="border-border/75 bg-card/78">
        <CardContent className="p-4">
          <form method="get" action="/admin/sales" className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_auto]">
            <div className="space-y-1.5">
              <label htmlFor="q" className="text-xs text-muted-foreground">
                Busca
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder="Venda, cliente ou chave"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="status" className="text-xs text-muted-foreground">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={filters.status ?? "all"}
                className="h-10 w-full rounded-xl border border-input/80 bg-card/85 px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-4 focus:ring-ring/20"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_10px_28px_-18px_hsl(var(--primary))] transition-colors hover:bg-primary/90"
              >
                Filtrar
              </button>
              <a
                href="/admin/sales"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
              >
                Limpar
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/75 bg-card/82">
        <CardContent className="p-3">
          <SalesHistoryTable
            sales={sales}
            canManage={canManage}
            canCancel={canCancel}
            emptyMessage="Nenhuma venda encontrada."
          />
        </CardContent>
      </Card>
    </div>
  );
}
