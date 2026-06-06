"use client";

import { CouponDiscountType, GameplayReleaseStatus, PaymentMethod, ProductKind, RefundStatus } from "@prisma/client";
import { Ban, CreditCard, Gift, Pause, Play, RotateCcw, Square, Ticket, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import {
  cancelServiceSessionAction,
  endPaidOpenServiceSessionAction,
  endServiceSessionAction,
  extendServiceSessionAction,
  manualServiceReleaseAction,
  pauseServiceSessionAction,
  paidServiceReleaseAction,
  resumeServiceSessionAction,
} from "@/presentation/admin/gameplay/actions";
import {
  calculateCouponDiscountInCents,
  normalizeCouponCode,
  type PdvCouponOption,
} from "@/presentation/admin/pdv/coupon-utils";
import { PaymentCardBrandPicker } from "@/presentation/admin/pdv/payment-card-brand-picker";

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
  activePaidOpenBilling?: ActivePaidOpenBilling | null;
  activeRelease?: ActiveReleaseControl | null;
};

type ActivePaidOpenBilling = {
  productId: string;
  productName: string;
  productPlanCode: string;
  categoryId: string;
  baseDurationMinutes: number;
  basePriceInCents: number;
  startedAt: string;
};

type ActiveReleaseControl = {
  status: GameplayReleaseStatus;
  saleId?: string | null;
  saleNumber?: string | null;
  saleTotal?: number | null;
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

const refundStatusLabels: Record<RefundStatus, string> = {
  NOT_REQUIRED: "Sem estorno",
  PENDING: "Estorno pendente",
  CONFIRMED: "Estorno confirmado",
  FAILED: "Falhou",
};

function isCardPayment(method: PaymentMethod) {
  return method === PaymentMethod.CREDIT_CARD || method === PaymentMethod.DEBIT_CARD;
}

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

function formatCurrencyFromFractionalCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function roundServiceMinutesUp(minutes: number) {
  return Math.max(5, Math.ceil(Math.max(1, minutes) / 5) * 5);
}

function computeOpenPaidCharge(billing: ActivePaidOpenBilling, now: number) {
  const startedAt = new Date(billing.startedAt).getTime();
  const safeStartedAt = Number.isNaN(startedAt) ? now : startedAt;
  const elapsedMinutes = Math.max(1, Math.ceil(Math.max(0, now - safeStartedAt) / 60_000));
  const billedMinutes = roundServiceMinutesUp(elapsedMinutes);
  const amountInCents = Math.max(
    1,
    Math.round((billing.basePriceInCents * billedMinutes) / billing.baseDurationMinutes),
  );

  return {
    elapsedMinutes,
    billedMinutes,
    amountInCents,
    pricePerMinuteInCents: billing.basePriceInCents / billing.baseDurationMinutes,
  };
}

function inferGameplayStationIdFromProduct(product: GameplayProductOption) {
  const source = `${product.name} ${product.gameplayPlanCode ?? ""}`.toLowerCase();

  if (
    source.includes("tv 02") ||
    source.includes("tv-02") ||
    source.includes("simulador") ||
    source.includes("simulator") ||
    source.includes("corrida") ||
    source.includes("racing")
  ) {
    return "tv-02";
  }

  if (
    source.includes("tv 01") ||
    source.includes("tv-01") ||
    source.includes("ps5") ||
    source.includes("playstation") ||
    source.includes("play station")
  ) {
    return "tv-01";
  }

  return null;
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
  activePaidOpenBilling,
  activeRelease,
}: ManualServiceControlFormProps) {
  const [releaseState, setReleaseState] = useState<ActionState>(initialActionState);
  const [extendState, setExtendState] = useState<ActionState>(initialActionState);
  const [paidState, setPaidState] = useState<ActionState>(initialActionState);
  const [endState, setEndState] = useState<ActionState>(initialActionState);
  const [controlState, setControlState] = useState<ActionState>(initialActionState);
  const [cancelState, setCancelState] = useState<ActionState>(initialActionState);
  const [open, setOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [durationPreset, setDurationPreset] = useState("30");
  const [mode, setMode] = useState<"free" | "paid">("free");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [paymentCardBrand, setPaymentCardBrand] = useState("");
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [endPaymentOpen, setEndPaymentOpen] = useState(false);
  const [endPaymentMethod, setEndPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [endPaymentCardBrand, setEndPaymentCardBrand] = useState("");
  const [endCashReceived, setEndCashReceived] = useState("");
  const [endShowCoupon, setEndShowCoupon] = useState(false);
  const [endCouponCode, setEndCouponCode] = useState("");
  const [refundStatus, setRefundStatus] = useState<RefundStatus>(RefundStatus.PENDING);
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const [pendingAction, setPendingAction] = useState<"free" | "paid" | "end" | "pause" | "resume" | "cancel" | null>(null);

  const effectiveDurationPreset = isBusy && durationPreset === "FREE" ? "15" : durationPreset;
  const durationMinutes = effectiveDurationPreset === "FREE" ? 0 : Number(effectiveDurationPreset);
  const durationChoices = isBusy ? durationOptions.filter((option) => option.value !== "FREE") : durationOptions;
  const stationGameplayProducts = useMemo(() => {
    const stationMatches = gameplayProducts.filter(
      (product) => inferGameplayStationIdFromProduct(product) === stationId && product.gameplayDurationMinutes,
    );

    return stationMatches.length > 0
      ? stationMatches
      : gameplayProducts.filter((product) => product.gameplayDurationMinutes);
  }, [gameplayProducts, stationId]);
  const paidProducts = useMemo(
    () =>
      effectiveDurationPreset === "FREE"
        ? stationGameplayProducts
        : gameplayProducts.filter(
            (product) => product.kind === ProductKind.GAMEPLAY && product.gameplayDurationMinutes === durationMinutes,
          ),
    [durationMinutes, effectiveDurationPreset, gameplayProducts, stationGameplayProducts],
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
  const isOpenPaidStart = !isBusy && effectiveDurationPreset === "FREE" && mode === "paid";
  const activeOpenPaidCharge = activePaidOpenBilling ? computeOpenPaidCharge(activePaidOpenBilling, liveNow) : null;
  const endSubtotalInCents = activeOpenPaidCharge?.amountInCents ?? 0;
  const normalizedEndCouponCode = normalizeCouponCode(endCouponCode);
  const selectedEndCoupon = normalizedEndCouponCode
    ? coupons.find((coupon) => coupon.code === normalizedEndCouponCode)
    : undefined;
  const endCouponPreview =
    selectedEndCoupon && activePaidOpenBilling
      ? calculateCouponDiscountInCents({
          coupon: selectedEndCoupon,
          subtotalInCents: endSubtotalInCents,
          lines: [
            {
              productId: activePaidOpenBilling.productId,
              categoryId: activePaidOpenBilling.categoryId,
              lineTotalInCents: endSubtotalInCents,
            },
          ],
        })
      : null;
  const endCouponDiscountInCents = endCouponPreview?.discountInCents ?? 0;
  const endTotalInCents = Math.max(0, endSubtotalInCents - endCouponDiscountInCents);
  const paidCardPayment = !isOpenPaidStart && isCardPayment(paymentMethod);
  const endCardPayment = isCardPayment(endPaymentMethod);
  const canPaidSubmit = isOpenPaidStart
    ? Boolean(selectedProduct)
    : Boolean(selectedProduct && openSessions.length > 0 && totalInCents > 0);
  const canEndPaidSubmit = Boolean(activePaidOpenBilling && openSessions.length > 0 && endTotalInCents > 0);
  const isFreePending = pendingAction === "free";
  const isPaidPending = pendingAction === "paid";
  const isEndPending = pendingAction === "end";
  const isPausePending = pendingAction === "pause";
  const isResumePending = pendingAction === "resume";
  const isCancelPending = pendingAction === "cancel";
  const isPaused = activeRelease?.status === GameplayReleaseStatus.PAUSADA;
  const hasLinkedSale = Boolean(activeRelease?.saleId);

  useEffect(() => {
    setPdvModalOpen(open || endPaymentOpen || cancelOpen);

    return () => {
      if (open || endPaymentOpen || cancelOpen) {
        setPdvModalOpen(false);
      }
    };
  }, [cancelOpen, endPaymentOpen, open]);

  useEffect(() => {
    if (!activePaidOpenBilling) {
      return;
    }

    const interval = window.setInterval(() => setLiveNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activePaidOpenBilling]);

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

  function closeEndPaymentDialog() {
    setPdvModalOpen(false);
    setEndPaymentOpen(false);
  }

  function closeCancelDialog() {
    setPdvModalOpen(false);
    setCancelOpen(false);
  }

  async function handleControlSubmit(
    formData: FormData,
    action: "pause" | "resume",
    request: (prevState: ActionState, formData: FormData) => Promise<ActionState>,
  ) {
    setPendingAction(action);
    setControlState(initialActionState);

    try {
      const result = await request(initialActionState, formData);
      setControlState(result);

      if (result.status === "success") {
        reloadPage();
      }
    } catch (error) {
      setControlState(localActionError(error));
    } finally {
      setPendingAction((currentAction) => (currentAction === action ? null : currentAction));
    }
  }

  async function handlePauseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleControlSubmit(new FormData(event.currentTarget), "pause", pauseServiceSessionAction);
  }

  async function handleResumeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleControlSubmit(new FormData(event.currentTarget), "resume", resumeServiceSessionAction);
  }

  async function handleCancelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPendingAction("cancel");
    setCancelState(initialActionState);

    try {
      const result = await cancelServiceSessionAction(initialActionState, formData);
      setCancelState(result);

      if (result.status === "success") {
        closeCancelDialog();
        reloadPage();
      }
    } catch (error) {
      setCancelState(localActionError(error));
    } finally {
      setPendingAction((currentAction) => (currentAction === "cancel" ? null : currentAction));
    }
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

  async function handlePaidOpenEndSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setPendingAction("end");
    setEndState(initialActionState);

    try {
      const result = await endPaidOpenServiceSessionAction(initialActionState, formData);
      setEndState(result);

      if (result.status === "success") {
        closeEndPaymentDialog();
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
      {!activePaidOpenBilling ? (
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
      ) : null}
      <ActionFeedback state={releaseState} />
      <ActionFeedback state={extendState} />
      <ActionFeedback state={paidState} />
      <ActionFeedback state={controlState} />
      <ActionFeedback state={cancelState} />

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
                <input type="hidden" name="paymentNsu" value="" />
                <input type="hidden" name="paymentAuthorizationCode" value="" />
                <input type="hidden" name="paymentTerminalId" value="" />
                <input type="hidden" name="paymentExternalTransactionId" value="" />
                <input type="hidden" name="paymentReceiptText" value="" />

                <div className={`grid gap-3 ${isOpenPaidStart ? "" : "sm:grid-cols-[minmax(0,1fr)_150px]"}`}>
                  <div className="space-y-1.5">
                    <Label htmlFor={`service-product-${stationId}`}>
                      {isOpenPaidStart ? "Base de cobranca" : "Plano"}
                    </Label>
                    <select
                      id={`service-product-${stationId}`}
                      className="admin-native-select"
                      value={selectedProduct?.id ?? ""}
                      onChange={(event) => setSelectedProductId(event.target.value)}
                    >
                      {paidProducts.length === 0 ? (
                        <option value="">
                          {isOpenPaidStart ? "Sem produto configurado" : `Sem produto para ${effectiveDurationPreset} min`}
                        </option>
                      ) : null}
                      {paidProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!isOpenPaidStart ? (
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
                  ) : null}
                </div>

                {isOpenPaidStart && selectedProduct?.gameplayDurationMinutes ? (
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
                    <span className="block text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary">
                      Cobranca no encerramento
                    </span>
                    <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                      <span>{formatCurrencyFromCents(centsFromMoney(selectedProduct.salePrice))}</span>
                      <span>{selectedProduct.gameplayDurationMinutes} min base</span>
                      <span>
                        {formatCurrencyFromFractionalCents(
                          centsFromMoney(selectedProduct.salePrice) / selectedProduct.gameplayDurationMinutes,
                        )}
                        /min
                      </span>
                    </div>
                  </div>
                ) : null}

                {!isOpenPaidStart ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                      <div className="space-y-1.5">
                        <Label htmlFor={`service-payment-${stationId}`}>Pagamento</Label>
                        <select
                          id={`service-payment-${stationId}`}
                          name="paymentMethod"
                          className="admin-native-select"
                          value={paymentMethod}
                          onChange={(event) => {
                            const nextMethod = event.target.value as PaymentMethod;
                            setPaymentMethod(nextMethod);
                            if (!isCardPayment(nextMethod)) {
                              setPaymentCardBrand("");
                            }
                          }}
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

                    {paidCardPayment ? (
                      <div className="space-y-1.5">
                        <Label id={`service-payment-brand-${stationId}`}>Bandeira</Label>
                        <PaymentCardBrandPicker
                          ariaLabelledBy={`service-payment-brand-${stationId}`}
                          name="paymentCardBrand"
                          value={paymentCardBrand}
                          onChange={setPaymentCardBrand}
                        />
                      </div>
                    ) : (
                      <input type="hidden" name="paymentCardBrand" value="" />
                    )}
                    <input type="hidden" name="paymentCardLast4" value="" />

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
                  </>
                ) : null}

                <Button type="submit" className="w-full gap-2" disabled={!canPaidSubmit || isPaidPending}>
                  <Play className="h-4 w-4" />
                  {isOpenPaidStart ? "Iniciar livre pago" : isBusy ? "Confirmar tempo pago" : "Confirmar pago"}
                </Button>
                <ActionFeedback state={paidState} />
              </form>
            )}
            </div>
      </ServiceReleaseModal>

      <ServiceReleaseModal
        open={endPaymentOpen}
        title={`Encerrar ${stationId.toUpperCase()}`}
        titleId={`service-end-title-${stationId}`}
        onClose={closeEndPaymentDialog}
      >
        {activePaidOpenBilling && activeOpenPaidCharge ? (
          <form onSubmit={handlePaidOpenEndSubmit} className="space-y-3">
            <input type="hidden" name="stationId" value={stationId} />
            <input type="hidden" name="customerName" value="" />
            <input type="hidden" name="couponCode" value={endCouponDiscountInCents > 0 ? selectedEndCoupon?.code ?? "" : ""} />
            <input type="hidden" name="paymentAmount" value={moneyFromCents(endTotalInCents)} />
            <input type="hidden" name="paymentApprovedAmount" value="" />
            <input type="hidden" name="paymentNsu" value="" />
            <input type="hidden" name="paymentAuthorizationCode" value="" />
            <input type="hidden" name="paymentTerminalId" value="" />
            <input type="hidden" name="paymentExternalTransactionId" value="" />
            <input type="hidden" name="paymentReceiptText" value="" />

            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
              <span className="block text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary">
                Tempo livre pago
              </span>
              <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span>{activeOpenPaidCharge.elapsedMinutes} min real</span>
                <span>{activeOpenPaidCharge.billedMinutes} min cobrado</span>
                <span>{formatCurrencyFromFractionalCents(activeOpenPaidCharge.pricePerMinuteInCents)}/min</span>
              </div>
              <p className="mt-2 text-lg font-black text-foreground">{formatCurrencyFromCents(endSubtotalInCents)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
              <div className="space-y-1.5">
                <Label htmlFor={`service-end-cash-${stationId}`}>Caixa</Label>
                <select id={`service-end-cash-${stationId}`} name="cashSessionId" className="admin-native-select">
                  {openSessions.length === 0 ? <option value="">Sem caixa</option> : null}
                  {openSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.cashRegister.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`service-end-payment-${stationId}`}>Pagamento</Label>
                <select
                  id={`service-end-payment-${stationId}`}
                  name="paymentMethod"
                  className="admin-native-select"
                  value={endPaymentMethod}
                  onChange={(event) => {
                    const nextMethod = event.target.value as PaymentMethod;
                    setEndPaymentMethod(nextMethod);
                    if (!isCardPayment(nextMethod)) {
                      setEndPaymentCardBrand("");
                    }
                  }}
                >
                  {Object.values(PaymentMethod).map((method) => (
                    <option key={method} value={method}>
                      {paymentLabels[method]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {endCardPayment ? (
              <div className="space-y-1.5">
                <Label id={`service-end-payment-brand-${stationId}`}>Bandeira</Label>
                <PaymentCardBrandPicker
                  ariaLabelledBy={`service-end-payment-brand-${stationId}`}
                  name="paymentCardBrand"
                  value={endPaymentCardBrand}
                  onChange={setEndPaymentCardBrand}
                />
              </div>
            ) : (
              <input type="hidden" name="paymentCardBrand" value="" />
            )}
            <input type="hidden" name="paymentCardLast4" value="" />

            {endPaymentMethod === PaymentMethod.CASH ? (
              <div className="space-y-1.5">
                <Label htmlFor={`service-end-cash-received-${stationId}`}>Recebido em dinheiro</Label>
                <Input
                  id={`service-end-cash-received-${stationId}`}
                  name="cashReceived"
                  inputMode="decimal"
                  value={endCashReceived}
                  onChange={(event) => setEndCashReceived(event.target.value)}
                  placeholder={moneyFromCents(endTotalInCents)}
                />
              </div>
            ) : (
              <input type="hidden" name="cashReceived" value="" />
            )}

            {endShowCoupon ? (
              <div className="space-y-1.5 rounded-2xl border border-border/70 bg-background/45 p-3">
                <Label htmlFor={`service-end-coupon-${stationId}`}>Cupom</Label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    id={`service-end-coupon-${stationId}`}
                    value={endCouponCode}
                    onChange={(event) => setEndCouponCode(event.target.value.toUpperCase())}
                    list={`service-end-coupons-${stationId}`}
                    placeholder="Selecionar cupom"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setEndShowCoupon(false)}>
                    Remover
                  </Button>
                </div>
                <datalist id={`service-end-coupons-${stationId}`}>
                  {coupons.map((coupon) => (
                    <option key={coupon.id} value={coupon.code}>
                      {couponLabel(coupon)}
                    </option>
                  ))}
                </datalist>
                {endCouponPreview?.message ? (
                  <p className="text-xs text-muted-foreground">{endCouponPreview.message}</p>
                ) : endCouponDiscountInCents > 0 ? (
                  <p className="text-xs text-primary">Desconto {formatCurrencyFromCents(endCouponDiscountInCents)}</p>
                ) : null}
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => setEndShowCoupon(true)}>
                <Ticket className="h-4 w-4" />
                Aplicar cupom
              </Button>
            )}

            <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>Desconto</span>
                <span>{formatCurrencyFromCents(endCouponDiscountInCents)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/70 pt-2">
                <span className="font-black text-foreground">Total</span>
                <span className="text-lg font-black text-foreground">{formatCurrencyFromCents(endTotalInCents)}</span>
              </div>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={!canEndPaidSubmit || isEndPending}>
              <Square className="h-4 w-4" />
              Encerrar e registrar venda
            </Button>
            <ActionFeedback state={endState} />
          </form>
        ) : null}
      </ServiceReleaseModal>

      <ServiceReleaseModal
        open={cancelOpen}
        title={`Cancelar ${stationId.toUpperCase()}`}
        titleId={`service-cancel-title-${stationId}`}
        onClose={closeCancelDialog}
      >
        <form onSubmit={handleCancelSubmit} className="space-y-3">
          <input type="hidden" name="stationId" value={stationId} />

          {hasLinkedSale ? (
            <div className="rounded-2xl border border-rose-400/35 bg-rose-400/10 p-3">
              <span className="block text-[0.65rem] font-black uppercase tracking-[0.18em] text-rose-200">
                Venda vinculada
              </span>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeRelease?.saleNumber ?? "Venda"} será cancelada no PDV.
              </p>
              {activeRelease?.saleTotal ? (
                <p className="mt-1 text-lg font-black text-foreground">
                  {formatCurrencyFromCents(centsFromMoney(activeRelease.saleTotal))}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-background/45 p-3 text-sm text-muted-foreground">
              Cancelar este tempo não gera venda nem nota fiscal.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`service-cancel-reason-${stationId}`}>Motivo</Label>
            <Input
              id={`service-cancel-reason-${stationId}`}
              name="cancelReason"
              placeholder="Ex.: cliente desistiu"
              required
              minLength={3}
            />
          </div>

          {hasLinkedSale ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`service-refund-status-${stationId}`}>Estorno</Label>
                  <select
                    id={`service-refund-status-${stationId}`}
                    name="refundStatus"
                    className="admin-native-select"
                    value={refundStatus}
                    onChange={(event) => setRefundStatus(event.target.value as RefundStatus)}
                  >
                    {Object.values(RefundStatus).map((status) => (
                      <option key={status} value={status}>
                        {refundStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </div>

                {refundStatus === RefundStatus.CONFIRMED ? (
                  <div className="space-y-1.5">
                    <Label htmlFor={`service-refund-method-${stationId}`}>Forma</Label>
                    <select
                      id={`service-refund-method-${stationId}`}
                      name="refundMethod"
                      className="admin-native-select"
                      value={refundMethod}
                      onChange={(event) => setRefundMethod(event.target.value as PaymentMethod)}
                    >
                      {Object.values(PaymentMethod).map((method) => (
                        <option key={method} value={method}>
                          {paymentLabels[method]}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input type="hidden" name="refundMethod" value="" />
                )}
              </div>

              {refundStatus === RefundStatus.CONFIRMED ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`service-refund-amount-${stationId}`}>Valor estornado</Label>
                    <Input
                      id={`service-refund-amount-${stationId}`}
                      name="refundAmount"
                      inputMode="decimal"
                      defaultValue={activeRelease?.saleTotal ? activeRelease.saleTotal.toFixed(2) : ""}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`service-refund-nsu-${stationId}`}>NSU / ID Pix</Label>
                    <Input id={`service-refund-nsu-${stationId}`} name="refundNsu" />
                  </div>
                </div>
              ) : (
                <>
                  <input type="hidden" name="refundAmount" value="" />
                  <input type="hidden" name="refundNsu" value="" />
                </>
              )}

              <input type="hidden" name="refundAuthorizationCode" value="" />
              <input type="hidden" name="refundTerminalId" value="" />
              <input type="hidden" name="refundExternalTransactionId" value="" />
              <input type="hidden" name="refundReceiptText" value="" />
            </>
          ) : (
            <>
              <input type="hidden" name="refundStatus" value={RefundStatus.NOT_REQUIRED} />
              <input type="hidden" name="refundMethod" value="" />
              <input type="hidden" name="refundAmount" value="" />
              <input type="hidden" name="refundNsu" value="" />
              <input type="hidden" name="refundAuthorizationCode" value="" />
              <input type="hidden" name="refundTerminalId" value="" />
              <input type="hidden" name="refundExternalTransactionId" value="" />
              <input type="hidden" name="refundReceiptText" value="" />
            </>
          )}

          <Button type="submit" variant="destructive" className="w-full gap-2" disabled={isCancelPending}>
            <Ban className="h-4 w-4" />
            Cancelar serviço
          </Button>
          <ActionFeedback state={cancelState} />
        </form>
      </ServiceReleaseModal>

      {isBusy && isPaused ? (
        <div className="flex flex-wrap gap-2">
          <form onSubmit={handleResumeSubmit}>
            <input type="hidden" name="stationId" value={stationId} />
            <Button type="submit" size="sm" className="gap-2" disabled={isResumePending}>
              <RotateCcw className="h-4 w-4" />
              Retomar
            </Button>
          </form>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="gap-2"
            disabled={isCancelPending}
            onClick={() => {
              setCancelState(initialActionState);
              setCancelOpen(true);
            }}
          >
            <Ban className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      ) : isBusy && activePaidOpenBilling ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <form onSubmit={handlePauseSubmit}>
              <input type="hidden" name="stationId" value={stationId} />
              <Button type="submit" size="sm" variant="secondary" className="gap-2" disabled={isPausePending}>
                <Pause className="h-4 w-4" />
                Pausar
              </Button>
            </form>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="gap-2"
              disabled={isEndPending}
              onClick={() => {
                setEndState(initialActionState);
                setEndPaymentOpen(true);
              }}
            >
              <Square className="h-4 w-4" />
              Encerrar e cobrar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={isCancelPending}
              onClick={() => {
                setCancelState(initialActionState);
                setCancelOpen(true);
              }}
            >
              <Ban className="h-4 w-4" />
              Cancelar
            </Button>
          </div>
          <ActionFeedback state={endState} />
        </div>
      ) : isBusy ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <form onSubmit={handlePauseSubmit}>
              <input type="hidden" name="stationId" value={stationId} />
              <Button type="submit" size="sm" variant="secondary" className="gap-2" disabled={isPausePending}>
                <Pause className="h-4 w-4" />
                Pausar
              </Button>
            </form>
            <form onSubmit={handleEndSubmit}>
              <input type="hidden" name="stationId" value={stationId} />
              <Button type="submit" size="sm" variant="destructive" className="gap-2" disabled={isEndPending}>
                <Square className="h-4 w-4" />
                Encerrar tempo
              </Button>
            </form>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={isCancelPending}
              onClick={() => {
                setCancelState(initialActionState);
                setCancelOpen(true);
              }}
            >
              <Ban className="h-4 w-4" />
              Cancelar
            </Button>
          </div>
          <ActionFeedback state={endState} />
        </div>
      ) : null}
      {isBusy ? (
        <div className="space-y-1">
          <ActionFeedback state={controlState} />
          <ActionFeedback state={cancelState} />
        </div>
      ) : null}
    </div>
  );
}
