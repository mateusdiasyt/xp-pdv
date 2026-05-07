import Link from "next/link";

import { PaymentMethod, SaleStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { PrintReceiptButton } from "@/presentation/admin/pdv/print-receipt-button";

type ReceiptSale = {
  id: string;
  saleNumber: string;
  customerName: string | null;
  status: SaleStatus;
  fiscalStatus?: string | null;
  fiscalAccessKey?: string | null;
  fiscalNumber?: string | null;
  fiscalSeries?: string | null;
  fiscalMessage?: string | null;
  fiscalDanfeUrl?: string | null;
  fiscalXmlUrl?: string | null;
  subtotalAmount: { toString(): string };
  discountAmount: { toString(): string };
  totalAmount: { toString(): string };
  createdAt: Date;
  operator: {
    name: string;
  };
  cashSession: {
    cashRegister: {
      name: string;
      code: string;
    };
  };
  items: Array<{
    id: string;
    productNameSnapshot: string;
    skuSnapshot: string;
    quantity: number;
    unitPrice: { toString(): string };
    lineTotal: { toString(): string };
  }>;
  payments: Array<{
    id: string;
    method: PaymentMethod;
    amount: { toString(): string };
  }>;
};

type ReceiptPreviewCardProps = {
  sale: ReceiptSale;
  cashReceived?: number;
  ticketMode?: boolean;
};

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Cartao de credito",
  DEBIT_CARD: "Cartao de debito",
};

const receiptDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

function toNumber(value: { toString(): string } | string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

function formatTicketCode(saleNumber: string) {
  const pieces = saleNumber.split("-");
  const suffix = pieces[pieces.length - 1] ?? saleNumber;
  return suffix.slice(-5).toUpperCase();
}

type ReceiptBodyProps = {
  sale: ReceiptSale;
  cashReceived?: number;
  title: string;
  subtitle: string;
};

function ReceiptBody({ sale, cashReceived, title, subtitle }: ReceiptBodyProps) {
  const cashPaymentTotal = sale.payments
    .filter((payment) => payment.method === PaymentMethod.CASH)
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const computedChange = cashReceived && cashReceived > cashPaymentTotal ? cashReceived - cashPaymentTotal : 0;
  const ticketCode = formatTicketCode(sale.saleNumber);

  return (
    <div className="space-y-3 pb-4">
      <div className="space-y-1 border-b border-dashed border-black/20 pb-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/branding/logo"
          alt="Logo do estabelecimento"
          className="mx-auto h-9 w-auto max-w-[42mm] object-contain"
        />
        <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-black/55">{title}</p>
        <h3 className="text-[1rem] font-semibold leading-tight tracking-[-0.02em] text-black">{subtitle}</h3>
        <p className="text-[10px] leading-4 text-black/70">Ticket #{ticketCode}</p>
      </div>

      <div className="space-y-1.5 border-b border-dashed border-black/20 pb-3 text-[10px] leading-4 text-black/78">
        <p className="text-[11px] font-semibold text-black">{sale.saleNumber}</p>
        <p>{receiptDateFormatter.format(sale.createdAt)}</p>
        <p>{sale.customerName || "Comanda avulsa"}</p>
        <p>
          Caixa {sale.cashSession.cashRegister.name} ({sale.cashSession.cashRegister.code})
        </p>
        <p>Operador: {sale.operator.name}</p>
        <p className="font-semibold text-black">
          {sale.status === SaleStatus.COMPLETED ? "Concluida" : "Cancelada"}
        </p>
        {sale.fiscalStatus ? (
          <p className="text-[9px] uppercase tracking-[0.08em] text-black/70">NFC-e: {sale.fiscalStatus}</p>
        ) : null}
        {sale.fiscalNumber ? (
          <p className="text-[9px] text-black/70">
            Numero: {sale.fiscalNumber} / Serie: {sale.fiscalSeries ?? "-"}
          </p>
        ) : null}
        {sale.fiscalAccessKey ? <p className="break-all text-[8px] leading-3 text-black/55">{sale.fiscalAccessKey}</p> : null}
      </div>

      <div className="space-y-2 border-b border-dashed border-black/20 pb-3">
        <div className="grid grid-cols-[18px_minmax(0,1fr)_56px] gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/55">
          <span>It</span>
          <span>Descricao</span>
          <span className="text-right">Valor</span>
        </div>
        {sale.items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-[18px_minmax(0,1fr)_56px] gap-2 text-[10px] leading-4 text-black">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="font-medium leading-4">{item.productNameSnapshot}</p>
              <p className="text-[9px] leading-4 text-black/60">
                {item.quantity}x - {formatCurrency(toNumber(item.unitPrice))}
              </p>
            </div>
            <span className="text-right font-semibold">{formatCurrency(toNumber(item.lineTotal))}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-b border-dashed border-black/20 pb-3">
        {sale.payments.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between gap-3 text-[10px] leading-4">
            <span className="text-black/70">{paymentLabels[payment.method]}</span>
            <span className="font-medium text-black">{formatCurrency(toNumber(payment.amount))}</span>
          </div>
        ))}
        {cashReceived ? (
          <div className="flex items-center justify-between gap-3 text-[10px] leading-4">
            <span className="text-black/70">Recebido</span>
            <span className="font-medium text-black">{formatCurrency(cashReceived)}</span>
          </div>
        ) : null}
        {computedChange > 0 ? (
          <div className="flex items-center justify-between gap-3 text-[10px] leading-4">
            <span className="text-black/70">Troco</span>
            <span className="font-medium text-black">{formatCurrency(computedChange)}</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-[10px] leading-4 text-black/70">
          <span>Subtotal</span>
          <span>{formatCurrency(toNumber(sale.subtotalAmount))}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[10px] leading-4 text-black/70">
          <span>Desconto</span>
          <span>{formatCurrency(toNumber(sale.discountAmount))}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-black/15 pt-2 text-[1.05rem] font-semibold tracking-[-0.03em] text-black">
          <span>Total</span>
          <span>{formatCurrency(toNumber(sale.totalAmount))}</span>
        </div>
      </div>

      {sale.fiscalDanfeUrl || sale.fiscalXmlUrl || sale.fiscalMessage ? (
        <div className="space-y-1 border-t border-dashed border-black/20 pt-2 text-[9px] leading-4 text-black/70">
          {sale.fiscalMessage ? <p>{sale.fiscalMessage}</p> : null}
          {sale.fiscalDanfeUrl ? <p>DANFE: {sale.fiscalDanfeUrl}</p> : null}
          {sale.fiscalXmlUrl ? <p>XML: {sale.fiscalXmlUrl}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ReceiptPreviewCard({ sale, cashReceived, ticketMode = false }: ReceiptPreviewCardProps) {
  const quickTicketTitle = "Via cliente";
  const quickTicketSubtitle = "Ticket de retirada";
  const quickKitchenTitle = "Via balcao";
  const quickKitchenSubtitle = "Ticket interno";

  return (
    <section className="space-y-4 print:block">
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Link
          href="/admin/pdv"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-black transition-colors hover:bg-black/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao PDV
        </Link>
        <PrintReceiptButton />
      </div>

      <Card className="receipt-print-card mx-auto w-full max-w-[57mm] overflow-hidden border border-black/10 bg-white text-black shadow-[0_28px_60px_-28px_rgba(0,0,0,0.45)] print:max-w-none print:border-none print:shadow-none">
        <CardContent className="receipt-print-content min-h-[40mm] space-y-0 px-[3.5mm] py-[4mm] print:px-[3mm] print:py-[3.5mm]">
          {ticketMode ? (
            <>
              <ReceiptBody sale={sale} cashReceived={cashReceived} title={quickTicketTitle} subtitle={quickTicketSubtitle} />
              <div className="border-t border-dashed border-black/25 py-2 text-center text-[9px] uppercase tracking-[0.2em] text-black/60">
                destaque no corte
              </div>
              <ReceiptBody sale={sale} cashReceived={cashReceived} title={quickKitchenTitle} subtitle={quickKitchenSubtitle} />
            </>
          ) : (
            <ReceiptBody sale={sale} cashReceived={cashReceived} title="Guilda Maia" subtitle="Comprovante de venda" />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
