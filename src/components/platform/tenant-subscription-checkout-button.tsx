"use client";

import { type FormEvent, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

import { createTenantSubscriptionCheckoutAction } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/presentation/admin/common/action-state";

type TenantSubscriptionCheckoutButtonProps = {
  tenantId: string;
  defaultPlanName: "Ouro" | "Platina";
  defaultBillingCycleMonths?: number;
};

export function TenantSubscriptionCheckoutButton({
  tenantId,
  defaultPlanName,
  defaultBillingCycleMonths = 1,
}: TenantSubscriptionCheckoutButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTenantSubscriptionCheckoutAction(initialActionState, new FormData(event.currentTarget));

      if (result.status === "success" && result.redirectUrl) {
        window.open(result.redirectUrl, "_blank", "noopener,noreferrer");
        window.location.reload();
        return;
      }

      setError(result.message ?? "Nao foi possivel gerar a cobranca.");
    } catch {
      setError("Nao foi possivel gerar a cobranca agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select
          name="planName"
          defaultValue={defaultPlanName}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
        >
          <option value="Ouro">Ouro</option>
          <option value="Platina">Platina</option>
        </select>
        <select
          name="billingCycleMonths"
          defaultValue={String(defaultBillingCycleMonths)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
        >
          <option value="1">1 mes</option>
          <option value="3">3 meses</option>
          <option value="6">6 meses</option>
          <option value="12">1 ano</option>
        </select>
        <Button type="submit" size="sm" className="h-10 gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {isSubmitting ? "Gerando..." : "Cobrar"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
