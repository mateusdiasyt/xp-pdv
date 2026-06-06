import Link from "next/link";

import { PaymentMethod } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import { getPdvData, getSaleReceiptData } from "@/application/pdv/pdv-service";
import { Card, CardContent } from "@/components/ui/card";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { AutoPrintReceipt } from "@/presentation/admin/pdv/auto-print-receipt";
import { PdvWorkspace } from "@/presentation/admin/pdv/pdv-workspace";
import { ReceiptPrintMode } from "@/presentation/admin/pdv/receipt-print-mode";
import { ReceiptPreviewCard } from "@/presentation/admin/pdv/receipt-preview-card";
import { SalesHistoryTable } from "@/presentation/admin/pdv/sales-history-table";

type PdvPageProps = {
  searchParams: Promise<{
    receipt?: string;
    cashReceived?: string;
    ticket?: string;
    print?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function parseCashReceived(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function PdvPage({ searchParams }: PdvPageProps) {
  const session = await requirePermission(PERMISSIONS.PDV_VIEW);
  const { receipt, cashReceived, ticket, print } = await searchParams;
  const receiptData = receipt ? await getSaleReceiptData(receipt) : null;

  if (receipt && receiptData) {
    return (
      <div className="space-y-6">
        <ReceiptPrintMode />
        <AutoPrintReceipt enabled={print === "ticket"} />
        <ReceiptPreviewCard
          sale={receiptData}
          cashReceived={parseCashReceived(cashReceived)}
          ticketMode={ticket === "quick"}
        />
      </div>
    );
  }

  const {
    openSessions,
    cashRegisters,
    operators,
    products,
    sales,
    customers,
    openComandas,
    pdvConfiguration,
    coupons,
    issues,
  } = await getPdvData();
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.PDV_MANAGE);
  const canCancel = hasPermission(session.user.permissions, PERMISSIONS.PDV_CANCEL);

  const customerOptions = customers.map((customer) => ({
    id: customer.id,
    fullName: customer.fullName,
    documentType: customer.documentType,
    documentNumber: customer.documentNumber,
  }));

  const openSessionOptions = openSessions.map((openSession) => ({
    id: openSession.id,
    status: openSession.status,
    openedAt: openSession.openedAt.toISOString(),
    closedAt: openSession.closedAt?.toISOString() ?? null,
    openingAmount: Number(openSession.openingAmount),
    cashSalesAmount: openSession.sales.reduce((sessionTotal, sale) => {
      const cashTotal = sale.payments
        .filter((payment) => payment.method === PaymentMethod.CASH)
        .reduce((paymentTotal, payment) => paymentTotal + Number(payment.amount), 0);

      return sessionTotal + cashTotal;
    }, 0),
    supplyAmount: openSession.movements
      .filter((movement) => movement.type === "SUPPLY")
      .reduce((total, movement) => total + Number(movement.amount), 0),
    withdrawalAmount: openSession.movements
      .filter((movement) => movement.type === "WITHDRAWAL")
      .reduce((total, movement) => total + Number(movement.amount), 0),
    expectedAmount:
      Number(openSession.openingAmount) +
      openSession.sales.reduce((sessionTotal, sale) => {
        const cashTotal = sale.payments
          .filter((payment) => payment.method === PaymentMethod.CASH)
          .reduce((paymentTotal, payment) => paymentTotal + Number(payment.amount), 0);

        return sessionTotal + cashTotal;
      }, 0) +
      openSession.movements
        .filter((movement) => movement.type === "SUPPLY")
        .reduce((total, movement) => total + Number(movement.amount), 0) -
      openSession.movements
        .filter((movement) => movement.type === "WITHDRAWAL")
        .reduce((total, movement) => total + Number(movement.amount), 0),
    closingAmount: null,
    differenceAmount: null,
    note: openSession.note ?? "",
    salesCount: openSession.sales.length,
    salesTotalAmount: openSession.sales.reduce((total, sale) => total + Number(sale.totalAmount), 0),
    paymentTotals: Object.values(PaymentMethod).map((method) => ({
      method,
      amount: openSession.sales.reduce((sessionTotal, sale) => {
        const methodTotal = sale.payments
          .filter((payment) => payment.method === method)
          .reduce((paymentTotal, payment) => paymentTotal + Number(payment.amount), 0);

        return sessionTotal + methodTotal;
      }, 0),
    })),
    cashRegister: {
      id: openSession.cashRegister.id,
      name: openSession.cashRegister.name,
      code: openSession.cashRegister.code,
    },
    operator: {
      id: openSession.operator.id,
      name: openSession.operator.name,
      email: openSession.operator.email ?? "",
    },
    movements: openSession.movements
      .map((movement) => ({
        id: movement.id,
        type: movement.type,
        amount: Number(movement.amount),
        reason: movement.reason,
        createdAt: movement.createdAt.toISOString(),
      }))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
  }));

  const cashRegisterOptions = cashRegisters.map((cashRegister) => ({
    id: cashRegister.id,
    name: cashRegister.name,
    code: cashRegister.code,
  }));

  const operatorOptions = operators.map((operator) => ({
    id: operator.id,
    name: operator.name,
    email: operator.email,
    roleName: operator.role.name,
  }));

  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    imageUrl: product.imageUrl,
    kind: product.kind,
    gameplayPlanCode: product.gameplayPlanCode,
    gameplayDurationMinutes: product.gameplayDurationMinutes,
    tracksStock: product.tracksStock,
    salePrice: Number(product.salePrice),
    happyHourPrice: product.happyHourPrice ? Number(product.happyHourPrice) : null,
    currentStock: product.currentStock,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
  }));

  const openComandasView = openComandas.map((comanda) => ({
    id: comanda.id,
    number: comanda.number,
    isWalkIn: comanda.isWalkIn,
    customerId: comanda.customerId,
    customerName: comanda.customer?.fullName ?? comanda.customerNameSnapshot ?? "Comanda avulsa",
    subtotalAmount: Number(comanda.subtotalAmount),
    itemCount: comanda.items.length,
    openedAt: comanda.openedAt.toISOString(),
    items: comanda.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
      product: {
        name: item.product.name,
        sku: item.product.sku,
        imageUrl: item.product.imageUrl,
        tracksStock: item.product.tracksStock,
        currentStock: item.product.currentStock,
        category: {
          id: item.product.category.id,
          name: item.product.category.name,
          slug: item.product.category.slug,
        },
      },
    })),
  }));

  const couponOptions = coupons.map((coupon) => ({
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
    minSubtotalAmount: coupon.minSubtotalAmount ? Number(coupon.minSubtotalAmount) : null,
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    productIds: coupon.products.map((product) => product.productId),
    categoryIds: coupon.categories.map((category) => category.categoryId),
  }));

  return (
    <div className="space-y-6">
      {issues.length > 0 ? (
        <Card className="border-amber-400/30 bg-amber-400/8">
          <CardContent className="space-y-2 pt-5">
            <p className="text-sm font-semibold text-amber-100">O PDV carregou com dados parciais.</p>
            <p className="text-sm text-amber-50/90">
              Houve falha ao consultar: {issues.join(", ")}. A tela continua acessivel para evitar travamento total.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div>
        <PdvWorkspace
          canManage={canManage}
          cashRegisters={cashRegisterOptions}
          operators={operatorOptions}
          customers={customerOptions}
          openSessions={openSessionOptions}
          openComandas={openComandasView}
          products={productOptions}
          coupons={couponOptions}
          happyHourActive={pdvConfiguration.happyHourActive}
        />
      </div>

      <Card className="overflow-hidden border-border/75 bg-card/82 shadow-[0_22px_70px_-48px_rgba(0,0,0,0.85)]">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-sm font-bold text-primary">
                {sales.length}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Vendas recentes</p>
                <p className="text-xs text-muted-foreground">Ultimas 5 vendas.</p>
              </div>
            </div>
            <Link
              href="/admin/sales"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
            >
              Todas as vendas
            </Link>
          </div>
          <div className="p-3">
            <SalesHistoryTable
              sales={sales}
              canManage={canManage}
              canCancel={canCancel}
              emptyMessage="Nenhuma venda recente."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
