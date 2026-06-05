"use client";

import { CalendarDays, Printer, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ReportPeriod } from "@/application/reports/report-service";

type ReportPrintActionProps = {
  customStartDate: string;
  customEndDate: string;
};

type PrintOption = {
  period: ReportPeriod;
  title: string;
};

const printOptions: PrintOption[] = [
  { period: "cash", title: "Caixa atual" },
  { period: "1d", title: "1 dia" },
  { period: "7d", title: "7 dias" },
  { period: "15d", title: "15 dias" },
  { period: "30d", title: "30 dias" },
];
const dateInputClass =
  "h-10 rounded-xl border border-border/80 bg-background/85 px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-primary/55 disabled:opacity-60";

function buildPrintPath(period: ReportPeriod, startDate?: string, endDate?: string) {
  const params = new URLSearchParams({
    period,
    print: "thermal",
  });

  if (period === "custom" && startDate && endDate) {
    params.set("startDate", startDate);
    params.set("endDate", endDate);
  }

  return `/admin/reports?${params.toString()}`;
}

export function ReportPrintAction({ customStartDate, customEndDate }: ReportPrintActionProps) {
  const [open, setOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [startDate, setStartDate] = useState(customStartDate);
  const [endDate, setEndDate] = useState(customEndDate);

  function goToPrint(period: ReportPeriod) {
    if (navigating) {
      return;
    }

    const targetPath = buildPrintPath(period, startDate, endDate);
    setNavigating(true);
    setOpen(false);

    window.setTimeout(() => {
      window.location.assign(targetPath);
    }, 120);
  }

  return (
    <>
      <Button type="button" className="gap-2" onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4" />
        Imprimir
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[1.35rem] border border-border/80 bg-card text-card-foreground shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Imprimir relatorio</p>
                <p className="text-xs text-muted-foreground">Formato termico 48mm</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={navigating}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/50 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {printOptions.map((option) => (
                <button
                  key={option.period}
                  type="button"
                  onClick={() => goToPrint(option.period)}
                  disabled={navigating}
                  className="rounded-2xl border border-border/80 bg-background/45 p-4 text-left transition-colors hover:border-primary/45 hover:bg-primary/10"
                >
                  <Printer className="mb-3 h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{option.title}</p>
                </button>
              ))}

              <div className="sm:col-span-2 rounded-2xl border border-border/80 bg-background/45 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Personalizado</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className={dateInputClass}
                    aria-label="Inicio do relatorio"
                    disabled={navigating}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className={dateInputClass}
                    aria-label="Fim do relatorio"
                    disabled={navigating}
                  />
                  <Button type="button" onClick={() => goToPrint("custom")} disabled={!startDate || !endDate || navigating}>
                    {navigating ? "Abrindo..." : "Imprimir"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
