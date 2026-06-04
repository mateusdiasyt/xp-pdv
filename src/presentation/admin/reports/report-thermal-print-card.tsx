import { ArrowLeft } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { PrintReceiptButton } from "@/presentation/admin/pdv/print-receipt-button";
import type { ReportPeriodData } from "@/application/reports/report-service";

type ReportThermalPrintCardProps = {
  report: ReportPeriodData;
  generatedAt: string;
};

const generatedAtFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function printCode(report: ReportPeriodData) {
  return report.period === "custom" ? "CUSTOM" : report.period.toUpperCase();
}

export function ReportThermalPrintCard({ report, generatedAt }: ReportThermalPrintCardProps) {
  const topItems = report.itemRows.slice(0, 6);

  return (
    <section className="space-y-4 print:block">
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <a
          href="/admin/reports"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-black transition-colors hover:bg-black/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos relatorios
        </a>
        <PrintReceiptButton>Imprimir relatorio</PrintReceiptButton>
      </div>

      <Card className="receipt-print-card mx-auto w-full max-w-[48mm] overflow-hidden border border-black/10 bg-white text-black shadow-[0_28px_60px_-28px_rgba(0,0,0,0.45)] print:max-w-none print:border-none print:shadow-none">
        <CardContent className="receipt-print-content min-h-[40mm] space-y-0 px-[2mm] py-[3mm] print:px-[2mm] print:py-[3mm]">
          <div className="space-y-1.5 pb-2 text-black">
            <div className="space-y-1 border-b-2 border-black pb-2 text-center">
              <h3 className="text-[0.92rem] font-black leading-tight text-black">Relatorio</h3>
              <p className="text-[1.45rem] font-black leading-none text-black">#{printCode(report)}</p>
            </div>

            <div className="space-y-1 border-b-2 border-black pb-2 text-[8px] font-medium leading-3 text-black">
              <p className="font-black">{report.label}</p>
              <p>{report.range.businessStartDate} ate {report.range.businessEndDate}</p>
              <p>Turno {report.range.startsAt}-{report.range.endsAt}</p>
              <p>Gerado {generatedAtFormatter.format(new Date(generatedAt))}</p>
            </div>

            <div className="space-y-1 border-b-2 border-black pb-2 text-[8.5px] font-medium leading-3 text-black">
              <div className="flex items-center justify-between gap-2">
                <span>Vendas</span>
                <span className="font-black">{report.summary.salesCount}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Itens</span>
                <span className="font-black">{report.summary.itemsCount}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Ticket medio</span>
                <span className="font-black">{formatCurrency(report.summary.averageTicket)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Desconto</span>
                <span className="font-black">{formatCurrency(report.summary.discountAmount)}</span>
              </div>
            </div>

            <div className="space-y-1 border-b-2 border-black pb-2 text-[8.5px] font-medium leading-3 text-black">
              <p className="text-[7px] font-black uppercase tracking-[0.08em]">Pagamentos</p>
              {report.paymentRows.map((row) => (
                <div key={row.method} className="flex items-center justify-between gap-2">
                  <span>{row.label}</span>
                  <span className="font-black">{formatCurrency(row.amount)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 border-b-2 border-black pb-2 text-[8.5px] font-medium leading-3 text-black">
              <p className="text-[7px] font-black uppercase tracking-[0.08em]">Caixa</p>
              <div className="flex items-center justify-between gap-2">
                <span>Dinheiro vendas</span>
                <span className="font-black">{formatCurrency(report.cashMovementSummary.cashSalesAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Suprimento</span>
                <span className="font-black">{formatCurrency(report.cashMovementSummary.supplyAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Sangria</span>
                <span className="font-black">{formatCurrency(report.cashMovementSummary.withdrawalAmount)}</span>
              </div>
            </div>

            {topItems.length > 0 ? (
              <div className="space-y-1 border-b-2 border-black pb-2 text-[8px] font-medium leading-3 text-black">
                <p className="text-[7px] font-black uppercase tracking-[0.08em]">Itens vendidos</p>
                {topItems.map((item) => (
                  <div key={`${item.category}-${item.item}`} className="grid grid-cols-[minmax(0,1fr)_18px_36px] gap-1">
                    <span className="truncate font-black">{item.item}</span>
                    <span className="text-right">{item.quantity}</span>
                    <span className="text-right font-black">{formatCurrency(item.grossRevenue)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[8.5px] font-medium leading-3 text-black">
                <span>Bruto</span>
                <span>{formatCurrency(report.summary.grossRevenue)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[8.5px] font-medium leading-3 text-black">
                <span>Lucro</span>
                <span>{formatCurrency(report.summary.grossProfit)} ({formatPercent(report.summary.grossMarginPercent)})</span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t-2 border-black pt-1.5 text-[1rem] font-black text-black">
                <span>Total</span>
                <span>{formatCurrency(report.summary.netRevenue)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
