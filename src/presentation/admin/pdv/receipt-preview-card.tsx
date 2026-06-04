import { GameplayReleaseStatus, PaymentMethod, SaleStatus } from "@prisma/client";
import { ArrowLeft, ExternalLink } from "lucide-react";

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
  gameplayRelease?: {
    status: GameplayReleaseStatus;
    stationId: string;
    releasedUntil?: Date | null;
    lastError?: string | null;
  } | null;
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
  showFiscalSummary?: boolean;
};

function getFiscalStatusLabel(status?: string | null) {
  const normalized = (status ?? "").trim().toUpperCase();

  if (normalized === "AUTHORIZED") {
    return "NFC-e autorizada";
  }

  if (normalized === "PROCESSING") {
    return "NFC-e processando";
  }

  if (normalized === "REJECTED") {
    return "NFC-e rejeitada";
  }

  if (normalized === "DISABLED") {
    return "NFC-e nao configurada";
  }

  if (normalized === "SERVICE_ONLY") {
    return "Servico em apuracao NFS-e";
  }

  if (normalized === "ERROR") {
    return "NFC-e com erro";
  }

  return "NFC-e nao emitida";
}

function getGameplayStatusLabel(release?: ReceiptSale["gameplayRelease"]) {
  if (!release) {
    return null;
  }

  if (release.status === GameplayReleaseStatus.LIBERADA) {
    const time = release.releasedUntil
      ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(release.releasedUntil)
      : "";

    return `TV ${release.stationId.toUpperCase()} liberada${time ? ` ate ${time}` : ""}`;
  }

  if (release.status === GameplayReleaseStatus.PENDENTE_ENVIO) {
    return `TV ${release.stationId.toUpperCase()} pendente de envio`;
  }

  return `Falha ao liberar ${release.stationId.toUpperCase()}`;
}

function ReceiptBody({ sale, cashReceived, title, subtitle, showFiscalSummary = false }: ReceiptBodyProps) {
  const cashPaymentTotal = sale.payments
    .filter((payment) => payment.method === PaymentMethod.CASH)
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const computedChange = cashReceived && cashReceived > cashPaymentTotal ? cashReceived - cashPaymentTotal : 0;
  const ticketCode = formatTicketCode(sale.saleNumber);
  const gameplayStatusLabel = getGameplayStatusLabel(sale.gameplayRelease);

  return (
    <div className="space-y-2.5 pb-4">
      <div className="space-y-1 border-b border-black pb-2.5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/branding/logo"
          alt="Logo do estabelecimento"
          className="mx-auto h-8 w-auto max-w-[42mm] object-contain"
        />
        <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-black/55">{title}</p>
        <h3 className="text-[0.9rem] font-bold leading-tight text-black">{subtitle}</h3>
        <p className="text-[1.55rem] font-black leading-none text-black">#{ticketCode}</p>
      </div>

      <div className="space-y-1 border-b border-black pb-2.5 text-[9px] leading-3.5 text-black/78">
        <p className="text-[11px] font-semibold text-black">{sale.saleNumber}</p>
        <p>{receiptDateFormatter.format(sale.createdAt)}</p>
        <p>{sale.customerName || "Comanda avulsa"}</p>
        <p>
          Caixa {sale.cashSession.cashRegister.name} ({sale.cashSession.cashRegister.code})
        </p>
        <p>Operador: {sale.operator.name}</p>
        <p className="font-semibold text-black">
          {sale.status === SaleStatus.COMPLETED ? "Pago / Concluido" : "Cancelada"}
        </p>
        <p className="text-[8px] uppercase tracking-[0.08em] text-black/65">{getFiscalStatusLabel(sale.fiscalStatus)}</p>
        {gameplayStatusLabel ? (
          <p className="rounded-sm border border-black/20 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-black">
            {gameplayStatusLabel}
          </p>
        ) : null}
        {showFiscalSummary && sale.fiscalNumber ? (
          <p className="text-[8px] text-black/70">
            Numero: {sale.fiscalNumber} / Serie: {sale.fiscalSeries ?? "-"}
          </p>
        ) : null}
        {showFiscalSummary && sale.fiscalAccessKey ? (
          <p className="break-all text-[7px] leading-3 text-black/55">{sale.fiscalAccessKey}</p>
        ) : null}
      </div>

      <div className="space-y-1.5 border-b border-black pb-2.5">
        <div className="grid grid-cols-[24px_minmax(0,1fr)_22px_42px] gap-1.5 border-b border-dashed border-black/25 pb-1 text-[7px] font-bold uppercase text-black/65">
          <span>Cod.</span>
          <span>Descricao</span>
          <span className="text-right">Qtd.</span>
          <span className="text-right">Total</span>
        </div>
        {sale.items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-[24px_minmax(0,1fr)_22px_42px] gap-1.5 text-[9px] leading-3.5 text-black">
            <span className="break-all text-[7px] text-black/70">{item.skuSnapshot || String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="font-semibold leading-3.5">{item.productNameSnapshot}</p>
              <p className="text-[8px] leading-3.5 text-black/60">
                {formatCurrency(toNumber(item.unitPrice))} un.
              </p>
            </div>
            <span className="text-right">{item.quantity}</span>
            <span className="text-right font-semibold">{formatCurrency(toNumber(item.lineTotal))}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 border-b border-black pb-2.5">
        {sale.payments.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between gap-3 text-[9px] leading-3.5">
            <span className="text-black/70">{paymentLabels[payment.method]}</span>
            <span className="font-medium text-black">{formatCurrency(toNumber(payment.amount))}</span>
          </div>
        ))}
        {cashReceived ? (
          <div className="flex items-center justify-between gap-3 text-[9px] leading-3.5">
            <span className="text-black/70">Recebido</span>
            <span className="font-medium text-black">{formatCurrency(cashReceived)}</span>
          </div>
        ) : null}
        {computedChange > 0 ? (
          <div className="flex items-center justify-between gap-3 text-[9px] leading-3.5">
            <span className="text-black/70">Troco</span>
            <span className="font-medium text-black">{formatCurrency(computedChange)}</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-[9px] leading-3.5 text-black/70">
          <span>Subtotal</span>
          <span>{formatCurrency(toNumber(sale.subtotalAmount))}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[9px] leading-3.5 text-black/70">
          <span>Desconto</span>
          <span>{formatCurrency(toNumber(sale.discountAmount))}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-black/25 pt-1.5 text-[1rem] font-bold text-black">
          <span>Total</span>
          <span>{formatCurrency(toNumber(sale.totalAmount))}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black/25 pt-2 text-center text-[8px] uppercase tracking-[0.16em] text-black/55">
        Ticket operacional
      </div>
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
        <a
          href="/admin/pdv"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-black transition-colors hover:bg-black/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao PDV
        </a>
        {sale.fiscalDanfeUrl ? (
          <a
            href={sale.fiscalDanfeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-black transition-colors hover:bg-black/5"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir NFC-e
          </a>
        ) : null}
        <PrintReceiptButton />
      </div>

      <Card className="receipt-print-card mx-auto w-full max-w-[57mm] overflow-hidden border border-black/10 bg-white text-black shadow-[0_28px_60px_-28px_rgba(0,0,0,0.45)] print:max-w-none print:border-none print:shadow-none">
        <CardContent className="receipt-print-content min-h-[40mm] space-y-0 px-[3.5mm] py-[4mm] print:px-[3mm] print:py-[3.5mm]">
          {ticketMode ? (
            <>
              <ReceiptBody sale={sale} cashReceived={cashReceived} title={quickTicketTitle} subtitle={quickTicketSubtitle} />
              <div className="border-t border-dashed border-black/25 py-2 text-center text-[8px] uppercase tracking-[0.18em] text-black/60">
                destaque no corte
              </div>
              <ReceiptBody sale={sale} cashReceived={cashReceived} title={quickKitchenTitle} subtitle={quickKitchenSubtitle} />
            </>
          ) : (
            <ReceiptBody
              sale={sale}
              cashReceived={cashReceived}
              title="Via cliente"
              subtitle="Comprovante operacional"
              showFiscalSummary
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
