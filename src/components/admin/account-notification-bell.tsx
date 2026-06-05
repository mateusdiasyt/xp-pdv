"use client";

import { Bell, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

type AccountNotificationItem = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
};

type AccountNotificationBellProps = {
  count: number;
  overdueCount: number;
  dueSoonCount: number;
  items: AccountNotificationItem[];
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

function formatDueDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00.000Z`));
}

export function AccountNotificationBell({
  count,
  overdueCount,
  dueSoonCount,
  items,
}: AccountNotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="relative rounded-full border-border/55 bg-card/55 shadow-none"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-4 w-4" />
        <span className="sr-only">Alertas</span>
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.62rem] font-bold text-primary-foreground shadow-sm">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[320px] overflow-hidden rounded-[1.2rem] border border-border/75 bg-card/95 shadow-[0_24px_80px_-36px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Contas</p>
            <p className="text-xs text-muted-foreground">
              {overdueCount} atrasada(s) · {dueSoonCount} perto de vencer
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground">
                Nenhuma conta perto do vencimento.
              </div>
            ) : (
              items.map((item) => (
                <a
                  key={item.id}
                  href="/admin/accounts?status=PENDING&range=due"
                  className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/55"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Vence {formatDueDate(item.dueDate)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(item.amount)}</p>
                  </div>
                </a>
              ))
            )}
          </div>

          <a
            href="/admin/accounts?status=PENDING&range=due"
            className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Acessar contas
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
