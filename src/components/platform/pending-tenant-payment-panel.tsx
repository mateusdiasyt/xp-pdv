"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CreditCard, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { signOut } from "next-auth/react";

import {
  activateCurrentTenantPaidPlanAction,
  authorizeCurrentTenantPaymentAction,
  createCurrentTenantPaymentCheckoutAction,
} from "@/app/(admin)/admin/payment/actions";
import {
  formatCentsToBRL,
  PLATFORM_PLAN_PRICES,
  type PlatformBillingCycleMonths,
} from "@/domain/platform/billing-plans";
import type { PlatformPlanName } from "@/domain/platform/plan-entitlements";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";

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
  const [isLinkSubmitting, setIsLinkSubmitting] = useState(false);
  const [isCardFormReady, setIsCardFormReady] = useState(false);
  const [cardFormMessage, setCardFormMessage] = useState("Carregando pagamento seguro...");
  const [planName, setPlanName] = useState<PlatformPlanName>(defaultPlanName);
  const [billingCycleMonths, setBillingCycleMonths] =
    useState<PlatformBillingCycleMonths>(defaultBillingCycleMonths);
  const cardFormRef = useRef<MercadoPagoCardFormController | null>(null);
  const isSubmittingRef = useRef(false);
  const planNameRef = useRef(planName);
  const billingCycleMonthsRef = useRef(billingCycleMonths);
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
  const latestSubscriptionStatus = latestSubscription?.status.toLowerCase() ?? "";
  const latestPaymentLinkIsPending = latestSubscriptionStatus === "pending" && Boolean(latestSubscription?.mercadoPagoInitPoint);
  const shouldShowLatestLink = Boolean(
    latestSubscription?.mercadoPagoInitPoint &&
      !planExpiredOrRemoved &&
      !planExpiredByDate &&
      (latestPaymentLinkIsPending || !hasActivePlan),
  );
  const fallbackLinkLabel = hasActivePlan
    ? latestPaymentLinkIsPending
      ? "Gerar novo link de renovacao"
      : "Gerar link de renovacao"
    : shouldShowLatestLink
      ? "Link alternativo"
      : "Gerar link de pagamento";
  const paymentButtonLabel = hasActivePlan ? "Renovar" : "Confirmar";
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

  useEffect(() => {
    planNameRef.current = planName;
    billingCycleMonthsRef.current = billingCycleMonths;
  }, [billingCycleMonths, planName]);

  useEffect(() => {
    if (!cycleOptions.some((option) => option.billingCycleMonths === billingCycleMonths)) {
      setBillingCycleMonths((cycleOptions[0]?.billingCycleMonths ?? 1) as PlatformBillingCycleMonths);
    }
  }, [billingCycleMonths, cycleOptions]);

  useEffect(() => {
    let disposed = false;

    async function mountCardForm() {
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
                  if (hasActivePlan) {
                    window.location.reload();
                    return;
                  }

                  if (result.redirectUrl) {
                    await signOut({ callbackUrl: result.redirectUrl });
                  }
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
  }, [amountCents, hasActivePlan, hasAuthorizedSubscription, mercadoPagoPublicKey]);

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

  async function handleFallbackLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLinkSubmitting) {
      return;
    }

    setIsLinkSubmitting(true);
    setState(initialActionState);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("planName", planName);
      formData.set("billingCycleMonths", String(billingCycleMonths));

      const result = await createCurrentTenantPaymentCheckoutAction(initialActionState, formData);
      setState(result);

      if (result.status === "success" && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
      }
    } catch {
      setState({
        status: "error",
        message: "Nao foi possivel gerar o link agora.",
      });
    } finally {
      setIsLinkSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border/80 bg-card/82 p-5 shadow-[0_28px_110px_-72px_rgba(0,0,0,0.92)] sm:p-6">
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

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
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
          <p className="mt-1 text-sm text-muted-foreground">{remainingTimeLabel}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/50 p-4 lg:col-span-3">
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
      ) : (
      <form id="mendoza-card-form" className="mt-5 rounded-2xl border border-border/70 bg-background/45 p-4">
        <div className="mb-4 flex flex-col gap-1">
          <p className="text-sm font-black text-foreground">
            {hasActivePlan ? "Renovar plano" : "Pagamento do plano"}
          </p>
          <p className="text-sm text-muted-foreground">
            {hasActivePlan
              ? "Escolha o periodo adicional. O novo tempo sera somado ao vencimento atual."
              : "Escolha o plano e confirme o cartao para liberar o acesso."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Plano</span>
            <select
              name="planName"
              value={planName}
              onChange={(event) => setPlanName(normalizePlanName(event.currentTarget.value))}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            >
              <option value="Ouro">Ouro</option>
              <option value="Platina">Platina</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Pagamento</span>
            <select
              name="billingCycleMonths"
              value={String(billingCycleMonths)}
              onChange={(event) => setBillingCycleMonths(normalizeCycle(event.currentTarget.value))}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            >
              {cycleOptions.map((option) => (
                <option key={`${option.planName}-${option.billingCycleMonths}`} value={option.billingCycleMonths}>
                  {option.label} - {formatCentsToBRL(option.amountCents)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Numero do cartao</span>
            <div
              id="mendoza-card-number"
              className="h-12 rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none transition-colors focus-within:border-primary"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Nome no cartao</span>
            <input
              id="mendoza-card-holder"
              defaultValue={isTestEnvironment ? "APRO" : ""}
              className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
              placeholder="Nome impresso no cartao"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Validade</span>
            <div
              id="mendoza-card-expiration"
              className="h-12 rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none transition-colors focus-within:border-primary"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">CVV</span>
            <div
              id="mendoza-card-security"
              className="h-12 rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none transition-colors focus-within:border-primary"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Documento</span>
            <select
              id="mendoza-card-document-type"
              className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">CPF/CNPJ</span>
            <input
              id="mendoza-card-document"
              defaultValue={isTestEnvironment ? "12345678909" : ""}
              className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
              placeholder="Somente numeros"
            />
          </label>
        </div>

        <input id="mendoza-card-email" type="hidden" defaultValue={ownerEmail} />
        <select id="mendoza-card-issuer" className="hidden" aria-hidden="true" />
        <select id="mendoza-card-installments" className="hidden" aria-hidden="true" />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            {cardFormMessage}
          </div>

          <button
            type="submit"
            disabled={!isCardFormReady || isSubmitting || !mercadoPagoPublicKey}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 text-sm font-black text-primary-foreground shadow-[0_18px_52px_-32px_hsl(var(--primary))] transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {isSubmitting ? "Confirmando..." : `${paymentButtonLabel} ${formatCentsToBRL(amountCents)}`}
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
      )}

      <form onSubmit={handleFallbackLinkSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        {shouldShowLatestLink ? (
          <a
            href={latestSubscription!.mercadoPagoInitPoint!}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-black text-foreground transition-colors hover:border-primary/45 hover:bg-primary/10"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir ultimo link
          </a>
        ) : null}

        <input type="hidden" name="planName" value={planName} />
        <input type="hidden" name="billingCycleMonths" value={billingCycleMonths} />
        <button
          type="submit"
          disabled={isLinkSubmitting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-black text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground disabled:cursor-wait disabled:opacity-60"
        >
          {isLinkSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          {fallbackLinkLabel}
        </button>
      </form>
    </section>
  );
}
