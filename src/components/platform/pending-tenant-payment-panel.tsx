"use client";

import { type FormEvent, useMemo, useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

import { createCurrentTenantPaymentCheckoutAction } from "@/app/(admin)/admin/payment/actions";
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
  ownerEmail: string;
  defaultPlanName: PlatformPlanName;
  defaultBillingCycleMonths: PlatformBillingCycleMonths;
  latestSubscription: LatestSubscription;
};

function normalizePlanName(value: string): PlatformPlanName {
  return value === "Platina" ? "Platina" : "Ouro";
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

export function PendingTenantPaymentPanel({
  tenantName,
  ownerEmail,
  defaultPlanName,
  defaultBillingCycleMonths,
  latestSubscription,
}: PendingTenantPaymentPanelProps) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planName, setPlanName] = useState<PlatformPlanName>(defaultPlanName);
  const cycleOptions = useMemo(
    () => PLATFORM_PLAN_PRICES.filter((price) => price.planName === planName),
    [planName],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setState(initialActionState);

    try {
      const result = await createCurrentTenantPaymentCheckoutAction(
        initialActionState,
        new FormData(event.currentTarget),
      );
      setState(result);

      if (result.status === "success" && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
      }
    } catch {
      setState({
        status: "error",
        message: "Nao foi possivel gerar o pagamento agora.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border/80 bg-card/82 p-5 shadow-[0_28px_110px_-72px_rgba(0,0,0,0.92)] sm:p-6">
      <div className="flex flex-col gap-5 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Mendoza PDV</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">Aguardando pagamento</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Sua conta foi criada. Para liberar o painel, finalize a assinatura pelo Mercado Pago.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
          Painel bloqueado
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Conta</p>
          <p className="mt-2 text-lg font-black text-foreground">{tenantName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{ownerEmail}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Ultima assinatura</p>
          <p className="mt-2 text-lg font-black text-foreground">
            {latestSubscription
              ? `${latestSubscription.planName} - ${formatCentsToBRL(latestSubscription.amountCents)}`
              : "Nenhuma cobranca criada"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {latestSubscription ? paymentStatusLabel(latestSubscription.status) : "Gere o primeiro link abaixo."}
          </p>
        </div>
      </div>

      {latestSubscription?.mercadoPagoInitPoint ? (
        <a
          href={latestSubscription.mercadoPagoInitPoint}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-black text-foreground transition-colors hover:border-primary/45 hover:bg-primary/10"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir ultimo link de pagamento
        </a>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 rounded-2xl border border-border/70 bg-background/45 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
              defaultValue={String(defaultBillingCycleMonths)}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            >
              {cycleOptions.map((option) => (
                <option key={`${option.planName}-${option.billingCycleMonths}`} value={option.billingCycleMonths}>
                  {option.label} - {formatCentsToBRL(option.amountCents)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 text-sm font-black text-primary-foreground shadow-[0_18px_52px_-32px_hsl(var(--primary))] transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {isSubmitting ? "Gerando..." : "Gerar novo link"}
          </button>
        </div>

        {state.status === "error" && state.message ? (
          <p className="mt-3 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
