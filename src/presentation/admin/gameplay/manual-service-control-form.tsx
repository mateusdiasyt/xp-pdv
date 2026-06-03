"use client";

import { CouponDiscountType, PaymentMethod, ProductKind } from "@prisma/client";
import { CreditCard, Gift, Play, Square, Ticket, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import {
  endServiceSessionAction,
  extendServiceSessionAction,
  manualServiceReleaseAction,
  paidServiceReleaseAction,
} from "@/presentation/admin/gameplay/actions";
import {
  calculateCouponDiscountInCents,
  normalizeCouponCode,
  type PdvCouponOption,
} from "@/presentation/admin/pdv/coupon-utils";

declare global {
  interface Window {
    __PDV_MODAL_OPEN__?: boolean;
  }
}

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

function setPdvModalOpen(isOpen: boolean) {
  window.__PDV_MODAL_OPEN__ = isOpen;
}

function localActionError(error: unknown): ActionState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Nao foi possivel concluir a operacao.",
  };
}

function reloadPage() {
  window.setTimeout(() => {
    window.location.reload();
  }, 100);
}

function ServiceReleaseModal({
  open,
  title,
  titleId,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center px-4 py-6">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-xs" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 grid max-h-[calc(100vh-3rem)] w-full max-w-[min(560px,94vw)] gap-4 overflow-hidden rounded-xl border border-border/80 bg-card p-0 text-sm ring-1 ring-foreground/10"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
          <h2 id={titleId} className="text-base font-medium leading-none">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>
        <div className="admin-scrollbar overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ManualServiceControlForm({
  stationId,
  isBusy,
  openSessions,
  gameplayProducts,
  coupons,
}: ManualServiceControlFormProps) {
  const [releaseState, setReleaseState] = useState<ActionState>(initialActionState);
  const [extendState, setExtendState] = useState<ActionState>(initialActionState);
  const [paidState, setPaidState] = useState<ActionState>(initialActionState);
  const [endState, setEndState] = useState<ActionState>(initialActionState);
  const [open, setOpen] = useState(false);
  const [durationPreset, setDurationPreset] = useState("30");
  const [mode, setMode] = useState<"free" | "paid">("free");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [pendingAction, setPendingAction] = useState<"free" | "paid" | "end" | null>(null);

  const effectiveDurationPreset = isBusy && durationPreset === "FREE" ? "15" : durationPreset;
  const durationMinutes = effectiveDurationPreset === "FREE" ? 0 : Number(effectiveDurationPreset);
  const durationChoices = isBusy ? durationOptions.filter((option) => option.value !== "FREE") : durationOptions;
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
  const isFreePending = pendingAction === "free";
  const isPaidPending = pendingAction === "paid";
  const isEndPending = pendingAction === "end";

  useEffect(() => {
    setPdvModalOpen(open);

    return () => {
      if (open) {
        setPdvModalOpen(false);
      }
    };
  }, [open]);

  function openReleaseDialog() {
    setMode(isBusy ? "paid" : effectiveDurationPreset === "FREE" ? "free" : "paid");
    setReleaseState(initialActionState);
    setExtendState(initialActionState);
    setPaidState(initialActionState);
    setPdvModalOpen(true);
    setOpen(true);
  }

  function closeReleaseDialog() {
    setPdvModalOpen(false);
    setOpen(false);
  }

  async function handleFreeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const nextPendingAction = "free";

    setPendingAction(nextPendingAction);
    if (isBusy) {
      setExtendState(initialActionState);
    } else {
      setReleaseState(initialActionState);
    }

    try {
      const result = isBusy
        ? await extendServiceSessionAction(initialActionState, formData)
        : await manualServiceReleaseAction(initialActionState, formData);

      if (isBusy) {
        setExtendState(result);
      } else {
        setReleaseState(result);
      }

      if (result.status === "success") {
        closeReleaseDialog();
        reloadPage();
      }
    } catch (error) {
      const result = localActionError(error);
      if (isBusy) {
        setExtendState(result);
      } else {
        setReleaseState(result);
      }
    } finally {
      setPendingAction((currentAction) => (currentAction === nextPendingAction ? null : currentAction));
    }
  }

  async function handlePaidSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setPendingAction("paid");
    setPaidState(initialActionState);

    try {
      const result = await paidServiceReleaseAction(initialActionState, formData);
      setPaidState(result);

      if (result.status === "success") {
        closeReleaseDialog();
        reloadPage();
      }
    } catch (error) {
      setPaidState(localActionError(error));
    } finally {
      setPendingAction((currentAction) => (currentAction === "paid" ? null : currentAction));
    }
  }

  async function handleEndSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setPendingAction("end");
    setEndState(initialActionState);

    try {
      const result = await endServiceSessionAction(initialActionState, formData);
      setEndState(result);

      if (result.status === "success") {
        reloadPage();
      }
    } catch (error) {
      setEndState(localActionError(error));
    } finally {
      setPendingAction((currentAction) => (currentAction === "end" ? null : currentAction));
    }
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          className="admin-native-select h-9"
          value={effectiveDurationPreset}
          onChange={(event) => setDurationPreset(event.target.value)}
          aria-label={isBusy ? "Tempo para adicionar" : "Tempo para liberação manual"}
        >
          {durationChoices.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" className="gap-2" onClick={openReleaseDialog}>
          <Play className="h-4 w-4" />
          {isBusy ? "Adicionar tempo" : "Liberar"}
        </Button>
      </div>
      <ActionFeedback state={releaseState} />
      <ActionFeedback state={extendState} />
      <ActionFeedback state={paidState} />

      <ServiceReleaseModal
        open={open}
        title={`${isBusy ? "Adicionar tempo" : "Liberar"} ${stationId.toUpperCase()}`}
        titleId={`service-release-title-${stationId}`}
        onClose={closeReleaseDialog}
      >
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  mode === "free" ? "border-primary/55 bg-primary/12" : "border-border/75 bg-background/45"
                }`}
                onClick={() => setMode("free")}
              >
                <Gift className="mb-2 h-4 w-4 text-primary" />
                <span className="block text-sm font-bold text-foreground">{isBusy ? "Grátis +" : "Grátis"}</span>
              </button>
              <button
                type="button"
                className={`rounded-2xl border p-3 text-left transition-colors disabled:opacity-45 ${
                  mode === "paid" ? "border-primary/55 bg-primary/12" : "border-border/75 bg-background/45"
                }`}
                onClick={() => setMode("paid")}
                disabled={effectiveDurationPreset === "FREE"}
              >
                <CreditCard className="mb-2 h-4 w-4 text-primary" />
                <span className="block text-sm font-bold text-foreground">{isBusy ? "Pago +" : "Pago"}</span>
              </button>
            </div>

            {mode === "free" ? (
              <form onSubmit={handleFreeSubmit} className="space-y-3">
                <input type="hidden" name="stationId" value={stationId} />
                <input type="hidden" name="durationPreset" value={effectiveDurationPreset} />
                <Button type="submit" className="w-full gap-2" disabled={isFreePending}>
                  <Play className="h-4 w-4" />
                  {isBusy ? "Adicionar grátis" : "Confirmar grátis"}
                </Button>
                <ActionFeedback state={isBusy ? extendState : releaseState} />
              </form>
            ) : (
              <form onSubmit={handlePaidSubmit} className="space-y-3">
                <input type="hidden" name="stationId" value={stationId} />
                <input type="hidden" name="durationPreset" value={effectiveDurationPreset} />
                <input type="hidden" name="extendActiveSession" value={isBusy ? "true" : "false"} />
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
                      {paidProducts.length === 0 ? <option value="">Sem produto para {effectiveDurationPreset} min</option> : null}
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
                  {isBusy ? "Confirmar tempo pago" : "Confirmar pago"}
                </Button>
                <ActionFeedback state={paidState} />
              </form>
            )}
            </div>
      </ServiceReleaseModal>

      {isBusy ? (
        <form onSubmit={handleEndSubmit} className="space-y-2">
          <input type="hidden" name="stationId" value={stationId} />
          <Button type="submit" size="sm" variant="destructive" className="gap-2" disabled={isEndPending}>
            <Square className="h-4 w-4" />
            Encerrar tempo
          </Button>
          <ActionFeedback state={endState} />
        </form>
      ) : null}
    </div>
  );
}
