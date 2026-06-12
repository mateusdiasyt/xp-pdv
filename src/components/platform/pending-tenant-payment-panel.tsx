"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import Image from "next/image";
import { signOut } from "next-auth/react";

import {
  activateCurrentTenantPaidPlanAction,
  authorizeCurrentTenantPaymentAction,
} from "@/app/(admin)/admin/payment/actions";
import {
  formatCentsToBRL,
  PLATFORM_PLAN_PRICES,
  type PlatformBillingCycleMonths,
} from "@/domain/platform/billing-plans";
import type { PlatformPlanName } from "@/domain/platform/plan-entitlements";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";

type ConfirmedPaymentModal = {
  planName: PlatformPlanName;
  billingCycleMonths: PlatformBillingCycleMonths;
  amountCents: number;
  redirectUrl?: string;
  shouldSignOut: boolean;
};

type LatestSubscription = {
  planName: string;
  billingCycleMonths: number;
  amountCents: number;
  status: string;
  mercadoPagoInitPoint: string | null;
} | null;

type PendingTenantPaymentPanelProps = {
  tenantName: string;
  tenantStatus: string;
  ownerEmail: string;
  currentPlanName: string | null;
  planStatus: string;
  planExpiresAt: string | null;
  mercadoPagoPublicKey: string;
  mercadoPagoEnvironment: "test" | "production";
  defaultPlanName: PlatformPlanName;
  defaultBillingCycleMonths: PlatformBillingCycleMonths;
  latestSubscription: LatestSubscription;
};

type MercadoPagoCardFormData = {
  token?: string;
  paymentMethodId?: string;
};

type MercadoPagoCardFormController = {
  getCardFormData: () => MercadoPagoCardFormData;
  unmount?: () => void;
};

type MercadoPagoCardFormConfig = {
  amount: string;
  iframe: boolean;
  form: {
    id: string;
    cardNumber: { id: string; placeholder: string };
    expirationDate: { id: string; placeholder: string };
    securityCode: { id: string; placeholder: string };
    cardholderName: { id: string; placeholder: string };
    issuer: { id: string; placeholder: string };
    installments: { id: string; placeholder: string };
    identificationType: { id: string; placeholder: string };
    identificationNumber: { id: string; placeholder: string };
    cardholderEmail: { id: string; placeholder: string };
  };
  callbacks: {
    onFormMounted?: (error?: Error) => void;
    onSubmit?: (event?: Event) => void | Promise<void>;
    onFetching?: () => (() => void) | void;
  };
};

type MercadoPagoInstance = {
  cardForm: (config: MercadoPagoCardFormConfig) => MercadoPagoCardFormController;
};

type MercadoPagoConstructor = new (
  publicKey: string,
  options?: { locale?: string },
) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

let mercadoPagoSdkPromise: Promise<void> | null = null;

function loadMercadoPagoSdk() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.MercadoPago) {
    return Promise.resolve();
  }

  if (!mercadoPagoSdkPromise) {
    mercadoPagoSdkPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-mercado-pago-sdk="true"]');

      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Falha ao carregar Mercado Pago.")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://sdk.mercadopago.com/js/v2";
      script.async = true;
      script.dataset.mercadoPagoSdk = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Falha ao carregar Mercado Pago."));
      document.body.appendChild(script);
    });
  }

  return mercadoPagoSdkPromise;
}

function safelyUnmountCardForm(cardForm: MercadoPagoCardFormController | null) {
  try {
    cardForm?.unmount?.();
  } catch {
    // Mercado Pago SDK can leave the iframe already detached during fast remounts.
  }
}

function normalizePlanName(value: string): PlatformPlanName {
  return value === "Platina" ? "Platina" : "Ouro";
}

function normalizeCycle(value: string): PlatformBillingCycleMonths {
  const parsed = Number(value);
  return parsed === 3 || parsed === 6 || parsed === 12 ? parsed : 1;
}

function formatCycleLabel(value: PlatformBillingCycleMonths) {
  return value === 1 ? "1 mes" : `${value} meses`;
}

function paymentStatusLabel(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "pending") {
    return "Aguardando pagamento";
  }

  if (normalized === "authorized" || normalized === "active") {
    return "Pagamento confirmado";
  }

  return status;
}

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "Sem vencimento";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatPlanStatusLabel(status: string, isExpired: boolean) {
  if (isExpired) {
    return "Vencido";
  }

  if (status.toLowerCase() === "active") {
    return "Ativo";
  }

  if (status.toLowerCase() === "pending") {
    return "Pendente";
  }

  return status || "Nao definido";
}

function getRemainingTimeLabel(value: Date | null, isExpired: boolean) {
  if (!value) {
    return "Validade indefinida";
  }

  if (isExpired) {
    return "Vencido";
  }

  const milliseconds = value.getTime() - Date.now();
  const days = Math.max(0, Math.ceil(milliseconds / 86_400_000));

  if (days === 0) {
    return "Vence hoje";
  }

  if (days === 1) {
    return "1 dia restante";
  }

  return `${days} dias restantes`;
}

export function PendingTenantPaymentPanel({
  tenantName,
  tenantStatus,
  ownerEmail,
  currentPlanName,
  planStatus,
  planExpiresAt,
  mercadoPagoPublicKey,
  mercadoPagoEnvironment,
  defaultPlanName,
  defaultBillingCycleMonths,
  latestSubscription,
}: PendingTenantPaymentPanelProps) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isCardFormReady, setIsCardFormReady] = useState(false);
  const [cardFormMessage, setCardFormMessage] = useState("Carregando pagamento seguro...");
  const [confirmedPayment, setConfirmedPayment] = useState<ConfirmedPaymentModal | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [planName, setPlanName] = useState<PlatformPlanName>(defaultPlanName);
  const [billingCycleMonths, setBillingCycleMonths] =
    useState<PlatformBillingCycleMonths>(defaultBillingCycleMonths);
  const cardFormRef = useRef<MercadoPagoCardFormController | null>(null);
  const isSubmittingRef = useRef(false);
  const planNameRef = useRef(planName);
  const billingCycleMonthsRef = useRef(billingCycleMonths);
  const amountCentsRef = useRef(0);
  const isTestEnvironment = mercadoPagoEnvironment === "test";
  const isActiveTenant = tenantStatus === "ACTIVE";
  const planExpirationDate = planExpiresAt ? new Date(planExpiresAt) : null;
  const validPlanExpirationDate =
    planExpirationDate && !Number.isNaN(planExpirationDate.getTime()) ? planExpirationDate : null;
  const planExpiredOrRemoved = isActiveTenant && planStatus.toLowerCase() !== "active";
  const planExpiredByDate =
    isActiveTenant && validPlanExpirationDate ? validPlanExpirationDate.getTime() < Date.now() : false;
  const hasActivePlan = isActiveTenant && !planExpiredOrRemoved && !planExpiredByDate;
  const hasAuthorizedSubscription = ["authorized", "active"].includes(
    latestSubscription?.status.toLowerCase() ?? "",
  ) && tenantStatus !== "ACTIVE";
  const heading = hasActivePlan
    ? "Meu plano"
    : planExpiredOrRemoved || planExpiredByDate
      ? "Plano vencido"
      : "Aguardando pagamento";
  const description =
    hasActivePlan
      ? "Acompanhe a validade do seu plano e renove quando quiser."
      : planExpiredOrRemoved || planExpiredByDate
      ? "Escolha um plano e confirme o pagamento para liberar o painel novamente."
      : "Sua conta foi criada. Confirme o cartao para liberar o painel automaticamente.";
  const badgeLabel = hasActivePlan ? "Plano ativo" : "Painel bloqueado";
  const badgeClassName = hasActivePlan
    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
    : "border-amber-400/25 bg-amber-400/10 text-amber-100";
  const currentPlanLabel = currentPlanName ?? latestSubscription?.planName ?? defaultPlanName;
  const planStatusLabel = formatPlanStatusLabel(planStatus, planExpiredOrRemoved || planExpiredByDate);
  const remainingTimeLabel = getRemainingTimeLabel(validPlanExpirationDate, planExpiredOrRemoved || planExpiredByDate);
  const paymentButtonLabel = hasActivePlan ? "Renovar" : "Confirmar";
  const shouldRenderCheckout = !hasAuthorizedSubscription && (!hasActivePlan || isCheckoutOpen);
  const cycleOptions = useMemo(
    () => PLATFORM_PLAN_PRICES.filter((price) => price.planName === planName),
    [planName],
  );
  const selectedPrice = useMemo(
    () =>
      cycleOptions.find((price) => price.billingCycleMonths === billingCycleMonths) ??
      cycleOptions[0],
    [billingCycleMonths, cycleOptions],
  );
  const amountCents = selectedPrice?.amountCents ?? 0;
  const oneMonthAmountCents =
    PLATFORM_PLAN_PRICES.find((price) => price.planName === planName && price.billingCycleMonths === 1)?.amountCents ??
    amountCents;
  const fullPriceCents = oneMonthAmountCents * billingCycleMonths;
  const savingsCents = Math.max(0, fullPriceCents - amountCents);
  const monthlyEquivalentCents = Math.round(amountCents / billingCycleMonths);
  const longTermOptions = cycleOptions.filter((option) => option.billingCycleMonths > 1);

  useEffect(() => {
    if (!hasActivePlan) {
      setIsCheckoutOpen(true);
    }
  }, [hasActivePlan]);

  useEffect(() => {
    planNameRef.current = planName;
    billingCycleMonthsRef.current = billingCycleMonths;
    amountCentsRef.current = amountCents;
  }, [amountCents, billingCycleMonths, planName]);

  useEffect(() => {
    if (!cycleOptions.some((option) => option.billingCycleMonths === billingCycleMonths)) {
      setBillingCycleMonths((cycleOptions[0]?.billingCycleMonths ?? 1) as PlatformBillingCycleMonths);
    }
  }, [billingCycleMonths, cycleOptions]);

  useEffect(() => {
    let disposed = false;

    async function mountCardForm() {
      if (!shouldRenderCheckout) {
        safelyUnmountCardForm(cardFormRef.current);
        cardFormRef.current = null;
        setIsCardFormReady(false);
        setCardFormMessage("Clique em Renovar para abrir o pagamento seguro.");
        return;
      }

      if (hasAuthorizedSubscription) {
        setIsCardFormReady(false);
        setCardFormMessage("Pagamento confirmado. Libere o painel para continuar.");
        return;
      }

      if (!mercadoPagoPublicKey) {
        setCardFormMessage("Configure a Public Key do Mercado Pago no super admin.");
        setIsCardFormReady(false);
        return;
      }

      setIsCardFormReady(false);
      setCardFormMessage("Carregando pagamento seguro...");

      try {
        await loadMercadoPagoSdk();

        if (disposed) {
          return;
        }

        if (!window.MercadoPago) {
          throw new Error("SDK Mercado Pago indisponivel.");
        }

        safelyUnmountCardForm(cardFormRef.current);

        const mercadoPago = new window.MercadoPago(mercadoPagoPublicKey, { locale: "pt-BR" });
        const cardForm = mercadoPago.cardForm({
          amount: String((amountCents / 100).toFixed(2)),
          iframe: true,
          form: {
            id: "mendoza-card-form",
            cardNumber: {
              id: "mendoza-card-number",
              placeholder: "Numero do cartao",
            },
            expirationDate: {
              id: "mendoza-card-expiration",
              placeholder: "MM/AA",
            },
            securityCode: {
              id: "mendoza-card-security",
              placeholder: "CVV",
            },
            cardholderName: {
              id: "mendoza-card-holder",
              placeholder: "Nome impresso no cartao",
            },
            issuer: {
              id: "mendoza-card-issuer",
              placeholder: "Banco",
            },
            installments: {
              id: "mendoza-card-installments",
              placeholder: "Parcelas",
            },
            identificationType: {
              id: "mendoza-card-document-type",
              placeholder: "Documento",
            },
            identificationNumber: {
              id: "mendoza-card-document",
              placeholder: "CPF",
            },
            cardholderEmail: {
              id: "mendoza-card-email",
              placeholder: "Email",
            },
          },
          callbacks: {
            onFormMounted: (error?: Error) => {
              if (disposed) {
                return;
              }

              if (error) {
                setCardFormMessage("Nao foi possivel montar o cartao agora.");
                setState({
                  status: "error",
                  message: error.message || "Falha ao carregar o cartao.",
                });
                return;
              }

              setIsCardFormReady(true);
              setCardFormMessage("Pagamento protegido pelo Mercado Pago.");
            },
            onFetching: () => {
              if (!disposed) {
                setCardFormMessage("Validando dados do cartao...");
              }

              return () => {
                if (!disposed) {
                  setCardFormMessage("Pagamento protegido pelo Mercado Pago.");
                }
              };
            },
            onSubmit: async (event?: Event) => {
              event?.preventDefault();

              if (isSubmittingRef.current) {
                return;
              }

              const cardData = cardForm.getCardFormData();

              if (!cardData.token) {
                setState({
                  status: "error",
                  message: "Revise os dados do cartao antes de continuar.",
                });
                return;
              }

              isSubmittingRef.current = true;
              setIsSubmitting(true);
              setState(initialActionState);

              try {
                const formData = new FormData();
                formData.set("planName", planNameRef.current);
                formData.set("billingCycleMonths", String(billingCycleMonthsRef.current));
                formData.set("cardTokenId", cardData.token);

                const result = await authorizeCurrentTenantPaymentAction(initialActionState, formData);
                setState(result);

                if (result.status === "success") {
                  setConfirmedPayment({
                    planName: planNameRef.current,
                    billingCycleMonths: billingCycleMonthsRef.current,
                    amountCents: amountCentsRef.current,
                    redirectUrl: result.redirectUrl,
                    shouldSignOut: !hasActivePlan && Boolean(result.redirectUrl),
                  });
                }
              } catch {
                setState({
                  status: "error",
                  message: "Nao foi possivel confirmar o pagamento agora.",
                });
              } finally {
                isSubmittingRef.current = false;
                setIsSubmitting(false);
              }
            },
          },
        });

        cardFormRef.current = cardForm;
      } catch (error) {
        if (disposed) {
          return;
        }

        setIsCardFormReady(false);
        setCardFormMessage("Nao foi possivel carregar o pagamento seguro.");
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Falha ao carregar Mercado Pago.",
        });
      }
    }

    mountCardForm();

    return () => {
      disposed = true;
      safelyUnmountCardForm(cardFormRef.current);
      cardFormRef.current = null;
    };
  }, [amountCents, hasActivePlan, hasAuthorizedSubscription, mercadoPagoPublicKey, shouldRenderCheckout]);

  async function handleActivatePaidPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isActivating) {
      return;
    }

    setIsActivating(true);
    setState(initialActionState);

    try {
      const result = await activateCurrentTenantPaidPlanAction();
      setState(result);

      if (result.status === "success" && result.redirectUrl) {
        await signOut({ callbackUrl: result.redirectUrl });
      }
    } catch {
      setState({
        status: "error",
        message: "Nao foi possivel liberar o painel agora.",
      });
    } finally {
      setIsActivating(false);
    }
  }

  function handleOpenCheckout() {
    setState(initialActionState);
    setIsCheckoutOpen(true);
  }

  function handleCloseCheckout() {
    if (isSubmitting || !hasActivePlan) {
      return;
    }

    setState(initialActionState);
    setIsCheckoutOpen(false);
  }

  async function handleConfirmPaymentModal() {
    if (!confirmedPayment) {
      return;
    }

    const { redirectUrl, shouldSignOut } = confirmedPayment;
    setConfirmedPayment(null);

    if (shouldSignOut && redirectUrl) {
      await signOut({ callbackUrl: redirectUrl });
      return;
    }

    window.location.reload();
  }

  const paymentInputClassName =
    "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition-colors placeholder:text-slate-500 focus:border-[#009ee3]";
  const paymentFrameClassName =
    "h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition-colors focus-within:border-[#009ee3]";
  const paymentLabelClassName = "text-xs font-semibold text-slate-700";

  return (
    <section className="rounded-3xl border border-border/80 bg-card/82 p-5 shadow-[0_28px_110px_-72px_rgba(0,0,0,0.92)] sm:p-6">
      {confirmedPayment ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-emerald-300/25 bg-card p-5 shadow-[0_34px_110px_-48px_rgba(0,0,0,0.95)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-400/15 text-emerald-200">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
              Pagamento confirmado
            </p>
            <h2 className="mt-2 text-2xl font-black text-foreground">
              {confirmedPayment.shouldSignOut ? "Plano contratado" : "Renovacao realizada"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {confirmedPayment.shouldSignOut
                ? "O pagamento foi aprovado. Confirme para atualizar o acesso ao painel."
                : "O pagamento foi aprovado e o periodo sera somado ao vencimento atual."}
            </p>

            <div className="mt-5 space-y-2 rounded-2xl border border-border/70 bg-background/55 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Plano</span>
                <strong className="text-foreground">{confirmedPayment.planName}</strong>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Periodo</span>
                <strong className="text-foreground">
                  {formatCycleLabel(confirmedPayment.billingCycleMonths)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-2 text-sm">
                <span className="text-muted-foreground">Valor</span>
                <strong className="text-lg text-foreground">{formatCentsToBRL(confirmedPayment.amountCents)}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmPaymentModal}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-5 text-sm font-black text-primary-foreground shadow-[0_18px_52px_-32px_hsl(var(--primary))] transition-colors hover:bg-primary/90"
            >
              Confirmar
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-5 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Mendoza PDV</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{heading}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${badgeClassName}`}>
          {badgeLabel}
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Conta</p>
          <p className="mt-2 text-lg font-black text-foreground">{tenantName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{ownerEmail}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Plano atual</p>
          <p className="mt-2 text-lg font-black text-foreground">{currentPlanLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">{planStatusLabel}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Vencimento
          </p>
          <p className="mt-2 text-lg font-black text-foreground">{formatDateLabel(validPlanExpirationDate)}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{remainingTimeLabel}</p>
            {hasActivePlan ? (
              <button
                type="button"
                onClick={handleOpenCheckout}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-[#009ee3]/35 bg-[#009ee3] px-4 text-xs font-black text-white shadow-[0_16px_38px_-26px_#009ee3] transition-colors hover:bg-[#008ed0]"
              >
                Renovar
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Ultima assinatura</p>
          <p className="mt-2 text-lg font-black text-foreground">
            {latestSubscription
              ? `${latestSubscription.planName} - ${formatCentsToBRL(latestSubscription.amountCents)}`
              : "Nenhuma cobranca criada"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {latestSubscription ? paymentStatusLabel(latestSubscription.status) : "Preencha o cartao abaixo."}
          </p>
        </div>
      </div>

      {hasAuthorizedSubscription ? (
        <form onSubmit={handleActivatePaidPlan} className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-emerald-100">Pagamento confirmado</p>
              <p className="mt-1 text-sm text-emerald-100/70">
                Falta apenas finalizar a liberacao do ambiente do cliente.
              </p>
            </div>
            <button
              type="submit"
              disabled={isActivating}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/45 bg-emerald-300 px-5 text-sm font-black text-emerald-950 transition-colors hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-60"
            >
              {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {isActivating ? "Liberando..." : "Liberar painel"}
            </button>
          </div>

          {state.status === "error" && state.message ? (
            <p className="mt-3 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
          {state.status === "success" && state.message ? (
            <p className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}

      {shouldRenderCheckout ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,500px)]">
          <aside className="relative overflow-hidden rounded-[32px] border border-white/15 bg-[linear-gradient(180deg,#ff3aa5_0%,#c73aa6_48%,#6848b8_100%)] p-6 text-white shadow-[0_28px_90px_-58px_rgba(188,58,166,0.95)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.30),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.24),transparent_44%)]" />
            <div className="relative">
              <p className="inline-flex rounded-full border border-black/15 bg-black px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_35px_-24px_rgba(0,0,0,0.9)]">
                Economia inteligente
              </p>
              <h2 className="mt-4 max-w-2xl text-4xl font-black leading-[1.02] text-white sm:text-5xl">
                Mais meses, menos custo. Seu PDV segue ativo sem susto.
              </h2>
              <p className="mt-4 max-w-xl text-sm font-bold leading-6 text-white/78">
                Escolha um periodo maior e transforme renovacao em economia. O tempo comprado soma ao vencimento
                atual.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: "Economia real",
                    text: savingsCents > 0 ? `${formatCentsToBRL(savingsCents)} nesta renovacao.` : "Sem desconto aplicado.",
                    icon: TrendingUp,
                  },
                  {
                    title: "Custo por mes",
                    text: `${formatCentsToBRL(monthlyEquivalentCents)} no plano atual.`,
                    icon: WalletCards,
                  },
                  {
                    title: "Sem interrupcao",
                    text: "O vencimento atual continua contando.",
                    icon: CheckCircle2,
                  },
                  {
                    title: "Plano preservado",
                    text: "Modulos e dados seguem ativos.",
                    icon: ShieldCheck,
                  },
                ].map((benefit) => {
                  const BenefitIcon = benefit.icon;

                  return (
                    <div key={benefit.title} className="rounded-[26px] bg-white/16 p-5 ring-1 ring-black/10">
                      <BenefitIcon className="h-6 w-6 text-black" />
                      <p className="mt-4 text-xl font-black text-black">{benefit.title}</p>
                      <p className="mt-2 text-sm font-bold leading-5 text-white">{benefit.text}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {longTermOptions.map((option) => {
                  const optionIsSelected = option.billingCycleMonths === billingCycleMonths;
                  const optionFullPriceCents = oneMonthAmountCents * option.billingCycleMonths;
                  const optionSavingsCents = Math.max(0, optionFullPriceCents - option.amountCents);
                  const optionMonthlyCents = Math.round(option.amountCents / option.billingCycleMonths);
                  const optionSavingsPercent =
                    optionFullPriceCents > 0 ? Math.round((optionSavingsCents / optionFullPriceCents) * 100) : 0;

                  return (
                    <button
                      key={`${option.planName}-${option.billingCycleMonths}`}
                      type="button"
                      onClick={() => setBillingCycleMonths(option.billingCycleMonths)}
                      className={`rounded-[26px] p-5 text-left transition-all hover:-translate-y-0.5 ${
                        optionIsSelected
                          ? "bg-white text-slate-950 shadow-[0_20px_55px_-35px_rgba(0,0,0,0.75)]"
                          : "bg-black/22 text-white ring-1 ring-white/16 hover:bg-black/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-2xl font-black">{option.label}</p>
                          <p className={optionIsSelected ? "mt-1 text-sm font-bold text-slate-500" : "mt-1 text-sm font-bold text-white/72"}>
                            {formatCentsToBRL(optionMonthlyCents)} / mes
                          </p>
                        </div>
                        {optionSavingsPercent > 0 ? (
                          <span
                            className={
                              optionIsSelected
                                ? "rounded-full bg-black px-2.5 py-1 text-xs font-black text-white"
                                : "rounded-full bg-black px-2.5 py-1 text-xs font-black text-white"
                            }
                          >
                            -{optionSavingsPercent}%
                          </span>
                        ) : null}
                      </div>
                      <p className={optionIsSelected ? "mt-5 text-sm font-black text-slate-950" : "mt-5 text-sm font-black text-white"}>
                        Total {formatCentsToBRL(option.amountCents)}
                      </p>
                      <p className={optionIsSelected ? "mt-1 text-xs font-bold text-slate-500" : "mt-1 text-xs font-bold text-white/70"}>
                        Economiza {optionSavingsCents > 0 ? formatCentsToBRL(optionSavingsCents) : "R$ 0,00"}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-[26px] bg-black/24 p-5 ring-1 ring-white/16">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-black">
                  Melhor escolha agora
                </p>
                <p className="mt-2 text-2xl font-black text-white">
                  {formatCycleLabel(billingCycleMonths)} por {formatCentsToBRL(amountCents)}
                </p>
                <p className="mt-2 text-sm font-bold leading-5 text-white/76">
                  Quanto maior o periodo, menor o valor mensal e menos preocupacao com renovacao no meio da operacao.
                </p>
              </div>
            </div>
          </aside>

          <form
            id="mendoza-card-form"
            className="w-full max-w-[540px] rounded-[28px] border border-slate-200 bg-white p-5 text-slate-950 shadow-[0_30px_90px_-54px_rgba(0,158,227,0.65)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#009ee3]">Mercado Pago</p>
                <h2 className="mt-1 text-2xl font-light text-slate-950">Checkout transparente</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {hasActivePlan ? "Renove sem sair do seu painel." : "Finalize o pagamento para liberar o painel."}
                </p>
              </div>
              {hasActivePlan ? (
                <button
                  type="button"
                  onClick={handleCloseCheckout}
                  disabled={isSubmitting}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                  aria-label="Fechar checkout"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className={paymentLabelClassName}>Plano</span>
                <select
                  name="planName"
                  value={planName}
                  onChange={(event) => setPlanName(normalizePlanName(event.currentTarget.value))}
                  className={paymentInputClassName}
                >
                  <option value="Ouro">Ouro</option>
                  <option value="Platina">Platina</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className={paymentLabelClassName}>Pagamento</span>
                <select
                  name="billingCycleMonths"
                  value={String(billingCycleMonths)}
                  onChange={(event) => setBillingCycleMonths(normalizeCycle(event.currentTarget.value))}
                  className={paymentInputClassName}
                >
                  {cycleOptions.map((option) => (
                    <option key={`${option.planName}-${option.billingCycleMonths}`} value={option.billingCycleMonths}>
                      {option.label} - {formatCentsToBRL(option.amountCents)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="space-y-1.5">
                <span className={paymentLabelClassName}>Numero do cartao</span>
                <div id="mendoza-card-number" className={paymentFrameClassName} />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className={paymentLabelClassName}>Validade</span>
                  <div id="mendoza-card-expiration" className={paymentFrameClassName} />
                </label>

                <label className="space-y-1.5">
                  <span className={paymentLabelClassName}>CVV</span>
                  <div id="mendoza-card-security" className={paymentFrameClassName} />
                </label>
              </div>

              <label className="space-y-1.5">
                <span className={paymentLabelClassName}>Nome completo</span>
                <input
                  id="mendoza-card-holder"
                  defaultValue={isTestEnvironment ? "APRO" : ""}
                  className={paymentInputClassName}
                  placeholder="Nome impresso no cartao"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className={paymentLabelClassName}>Documento</span>
                  <select id="mendoza-card-document-type" className={paymentInputClassName} />
                </label>

                <label className="space-y-1.5">
                  <span className={paymentLabelClassName}>CPF/CNPJ</span>
                  <input
                    id="mendoza-card-document"
                    defaultValue={isTestEnvironment ? "12345678909" : ""}
                    className={paymentInputClassName}
                    placeholder="Somente numeros"
                  />
                </label>
              </div>
            </div>

            <input id="mendoza-card-email" type="hidden" defaultValue={ownerEmail} />
            <select id="mendoza-card-issuer" className="hidden" aria-hidden="true" />
            <select id="mendoza-card-installments" className="hidden" aria-hidden="true" />

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500">Total</span>
                <strong className="text-xl text-slate-950">{formatCentsToBRL(amountCents)}</strong>
              </div>
              <div className="mt-3 flex items-start gap-2 text-xs font-semibold leading-5 text-slate-600">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>
                  {cardFormMessage} Dados criptografados pelo Mercado Pago. O Mendoza PDV nao salva numero do cartao.
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isCardFormReady || isSubmitting || !mercadoPagoPublicKey}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#009ee3] bg-[#009ee3] px-5 text-sm font-black text-white shadow-[0_18px_52px_-32px_#009ee3] transition-colors hover:bg-[#008ed0] disabled:cursor-wait disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
              {isSubmitting ? "Confirmando..." : `${paymentButtonLabel} ${formatCentsToBRL(amountCents)}`}
            </button>

            <div className="mt-4 flex justify-center">
              <Image
                src="/mercadopago-selo22.png"
                alt="Compra 100% segura Mercado Pago"
                width={600}
                height={300}
                className="h-auto w-full max-w-[230px] object-contain opacity-95"
              />
            </div>

            {state.status === "error" && state.message ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.message}
              </p>
            ) : null}
            {state.status === "success" && state.message ? (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {state.message}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}
