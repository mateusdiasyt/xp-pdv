"use client";

import { CouponDiscountType, PaymentMethod, ProductKind } from "@prisma/client";
import { CreditCard, Gift, Play, Square, Ticket } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import {
  endServiceSessionAction,
  manualServiceReleaseAction,
  paidServiceReleaseAction,
} from "@/presentation/admin/gameplay/actions";
import {
  calculateCouponDiscountInCents,
  normalizeCouponCode,
  type PdvCouponOption,
} from "@/presentation/admin/pdv/coupon-utils";

type OpenSessionOption = {
  id: string;
  cashRegister: {
    name: string;
    code: string;
  };
};

type GameplayProductOption = {
  id: string;
  name: string;
  sku: string;
  kind: ProductKind;
  gameplayPlanCode?: string | null;
  gameplayDurationMinutes?: number | null;
  salePrice: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
};

type ManualServiceControlFormProps = {
  stationId: string;
  isBusy: boolean;
  openSessions: OpenSessionOption[];
  gameplayProducts: GameplayProductOption[];
  coupons: PdvCouponOption[];
};

const durationOptions = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1h" },
  { value: "FREE", label: "Livre" },
];

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
};

function centsFromMoney(value: number) {
  return Math.round(value * 100);
}

function moneyFromCents(value: number) {
  return (value / 100).toFixed(2);
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function couponLabel(coupon: PdvCouponOption) {
  const value =
    coupon.discountType === CouponDiscountType.PERCENTAGE
      ? `${coupon.discountValue}%`
      : formatCurrencyFromCents(centsFromMoney(coupon.discountValue));

  return `${coupon.code} - ${value}`;
}

export function ManualServiceControlForm({
  stationId,
  isBusy,
  openSessions,
  gameplayProducts,
  coupons,
}: ManualServiceControlFormProps) {
  const router = useRouter();
  const [releaseState, releaseAction, isFreePending] = useActionState(manualServiceReleaseAction, initialActionState);
  const [paidState, paidAction, isPaidPending] = useActionState(paidServiceReleaseAction, initialActionState);
  const [endState, endAction] = useActionState(endServiceSessionAction, initialActionState);
  const [open, setOpen] = useState(false);
  const [durationPreset, setDurationPreset] = useState("30");
  const [mode, setMode] = useState<"free" | "paid">("free");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");

  const durationMinutes = durationPreset === "FREE" ? 0 : Number(durationPreset);
  const paidProducts = useMemo(
    () =>
      gameplayProducts.filter(
        (product) => product.kind === ProductKind.GAMEPLAY && product.gameplayDurationMinutes === durationMinutes,
      ),
    [durationMinutes, gameplayProducts],
  );
  const selectedProduct = paidProducts.find((product) => product.id === selectedProductId) ?? paidProducts[0] ?? null;
  const subtotalInCents = selectedProduct ? centsFromMoney(selectedProduct.salePrice) : 0;
  const normalizedCouponCode = normalizeCouponCode(couponCode);
  const selectedCoupon = normalizedCouponCode
    ? coupons.find((coupon) => coupon.code === normalizedCouponCode)
    : undefined;
  const couponPreview =
    selectedCoupon && selectedProduct
      ? calculateCouponDiscountInCents({
          coupon: selectedCoupon,
          subtotalInCents,
          lines: [
            {
              productId: selectedProduct.id,
              categoryId: selectedProduct.category.id,
              lineTotalInCents: subtotalInCents,
            },
          ],
        })
      : null;
  const couponDiscountInCents = couponPreview?.discountInCents ?? 0;
  const totalInCents = Math.max(0, subtotalInCents - couponDiscountInCents);
  const canPaidSubmit = Boolean(selectedProduct && openSessions.length > 0 && totalInCents > 0);

  useEffect(() => {
    if (releaseState.status === "success" || paidState.status === "success") {
      router.refresh();
    }
  }, [paidState.status, releaseState.status, router]);

  function openReleaseDialog() {
    setMode(durationPreset === "FREE" ? "free" : "paid");
    setOpen(true);
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          className="admin-native-select h-9"
          value={durationPreset}
          onChange={(event) => setDurationPreset(event.target.value)}
          disabled={isBusy}
          aria-label="Tempo para liberação manual"
        >
          {durationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" className="gap-2" disabled={isBusy} onClick={openReleaseDialog}>
          <Play className="h-4 w-4" />
          Liberar
        </Button>
      </div>
      <ActionFeedback state={releaseState} />
      <ActionFeedback state={paidState} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(560px,94vw)] border-border/80 bg-card p-0 sm:max-w-[min(560px,94vw)]">
          <DialogHeader className="border-b border-border/70 px-5 py-4 pr-14">
            <DialogTitle>Liberar {stationId.toUpperCase()}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-5 pb-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  mode === "free" ? "border-primary/55 bg-primary/12" : "border-border/75 bg-background/45"
                }`}
                onClick={() => setMode("free")}
              >
                <Gift className="mb-2 h-4 w-4 text-primary" />
                <span className="block text-sm font-bold text-foreground">Grátis</span>
              </button>
              <button
                type="button"
                className={`rounded-2xl border p-3 text-left transition-colors disabled:opacity-45 ${
                  mode === "paid" ? "border-primary/55 bg-primary/12" : "border-border/75 bg-background/45"
                }`}
                onClick={() => setMode("paid")}
                disabled={durationPreset === "FREE"}
              >
                <CreditCard className="mb-2 h-4 w-4 text-primary" />
                <span className="block text-sm font-bold text-foreground">Pago</span>
              </button>
            </div>

            {mode === "free" ? (
              <form action={releaseAction} className="space-y-3">
                <input type="hidden" name="stationId" value={stationId} />
                <input type="hidden" name="durationPreset" value={durationPreset} />
                <Button type="submit" className="w-full gap-2" disabled={isFreePending}>
                  <Play className="h-4 w-4" />
                  Confirmar grátis
                </Button>
              </form>
            ) : (
              <form action={paidAction} className="space-y-3">
                <input type="hidden" name="customerName" value="" />
                <input type="hidden" name="discountAmount" value="0.00" />
                <input type="hidden" name="cashReceived" value={paymentMethod === PaymentMethod.CASH ? moneyFromCents(totalInCents) : ""} />
                <input type="hidden" name="couponCode" value={couponDiscountInCents > 0 ? selectedCoupon?.code ?? "" : ""} />
                <input type="hidden" name="itemProductId" value={selectedProduct?.id ?? ""} />
                <input type="hidden" name="itemQuantity" value="1" />
                <input type="hidden" name="gameplayProductId" value={selectedProduct?.id ?? ""} />
                <input type="hidden" name="gameplayStationId" value={stationId} />
                <input type="hidden" name="paymentAmount" value={moneyFromCents(totalInCents)} />
                <input type="hidden" name="paymentApprovedAmount" value="" />
                <input type="hidden" name="paymentCardBrand" value="" />
                <input type="hidden" name="paymentCardLast4" value="" />
                <input type="hidden" name="paymentNsu" value="" />
                <input type="hidden" name="paymentAuthorizationCode" value="" />
                <input type="hidden" name="paymentTerminalId" value="" />
                <input type="hidden" name="paymentExternalTransactionId" value="" />
                <input type="hidden" name="paymentReceiptText" value="" />

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`service-product-${stationId}`}>Plano</Label>
                    <select
                      id={`service-product-${stationId}`}
                      className="admin-native-select"
                      value={selectedProduct?.id ?? ""}
                      onChange={(event) => setSelectedProductId(event.target.value)}
                    >
                      {paidProducts.length === 0 ? <option value="">Sem produto para {durationPreset} min</option> : null}
                      {paidProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`service-cash-${stationId}`}>Caixa</Label>
                    <select id={`service-cash-${stationId}`} name="cashSessionId" className="admin-native-select">
                      {openSessions.length === 0 ? <option value="">Sem caixa</option> : null}
                      {openSessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.cashRegister.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`service-payment-${stationId}`}>Pagamento</Label>
                    <select
                      id={`service-payment-${stationId}`}
                      name="paymentMethod"
                      className="admin-native-select"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                    >
                      {Object.values(PaymentMethod).map((method) => (
                        <option key={method} value={method}>
                          {paymentLabels[method]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
                    <span className="block text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary">Total</span>
                    <span className="mt-1 block text-lg font-black text-foreground">{formatCurrencyFromCents(totalInCents)}</span>
                  </div>
                </div>

                {showCoupon ? (
                  <div className="space-y-1.5 rounded-2xl border border-border/70 bg-background/45 p-3">
                    <Label htmlFor={`service-coupon-${stationId}`}>Cupom</Label>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        id={`service-coupon-${stationId}`}
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                        list={`service-coupons-${stationId}`}
                        placeholder="Selecionar cupom"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowCoupon(false)}>
                        Remover
                      </Button>
                    </div>
                    <datalist id={`service-coupons-${stationId}`}>
                      {coupons.map((coupon) => (
                        <option key={coupon.id} value={coupon.code}>
                          {couponLabel(coupon)}
                        </option>
                      ))}
                    </datalist>
                    {couponPreview?.message ? (
                      <p className="text-xs text-muted-foreground">{couponPreview.message}</p>
                    ) : couponDiscountInCents > 0 ? (
                      <p className="text-xs text-primary">Desconto {formatCurrencyFromCents(couponDiscountInCents)}</p>
                    ) : null}
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowCoupon(true)}>
                    <Ticket className="h-4 w-4" />
                    Aplicar cupom
                  </Button>
                )}

                <Button type="submit" className="w-full gap-2" disabled={!canPaidSubmit || isPaidPending}>
                  <Play className="h-4 w-4" />
                  Confirmar pago
                </Button>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isBusy ? (
        <form action={endAction} className="space-y-2">
          <input type="hidden" name="stationId" value={stationId} />
          <Button type="submit" size="sm" variant="destructive" className="gap-2">
            <Square className="h-4 w-4" />
            Encerrar tempo
          </Button>
          <ActionFeedback state={endState} />
        </form>
      ) : null}
    </div>
  );
}
