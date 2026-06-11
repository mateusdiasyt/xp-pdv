"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Building2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerTenantAction, type RegisterTenantState } from "@/app/(auth)/register/actions";
import {
  formatCentsToBRL,
  PLATFORM_PLAN_PRICES,
  type PlatformBillingCycleMonths,
} from "@/domain/platform/billing-plans";
import type { PlatformPlanName } from "@/domain/platform/plan-entitlements";

const initialState: RegisterTenantState = {
  status: "idle",
};

type RegisterTenantFormProps = {
  defaultPlanName?: PlatformPlanName;
  defaultBillingCycleMonths?: PlatformBillingCycleMonths;
};

export function RegisterTenantForm({
  defaultPlanName = "Ouro",
  defaultBillingCycleMonths = 1,
}: RegisterTenantFormProps) {
  const [state, setState] = useState<RegisterTenantState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [planName, setPlanName] = useState<PlatformPlanName>(defaultPlanName);
  const cycleOptions = useMemo(
    () => PLATFORM_PLAN_PRICES.filter((price) => price.planName === planName),
    [planName],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setIsPending(true);
    setState(initialState);

    try {
      const result = await registerTenantAction(initialState, new FormData(event.currentTarget));
      setState(result);

      if (result.status === "success") {
        window.location.href = result.redirectUrl ?? "/login?registered=1";
      }
    } catch {
      setState({
        status: "error",
        message: "Nao foi possivel criar a conta agora.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="planName">Plano</Label>
          <select
            id="planName"
            name="planName"
            value={planName}
            onChange={(event) => setPlanName(event.currentTarget.value as PlatformPlanName)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
          >
            <option value="Ouro">Ouro</option>
            <option value="Platina">Platina</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="billingCycleMonths">Pagamento</Label>
          <select
            id="billingCycleMonths"
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
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" name="fullName" placeholder="Joao Silva" autoComplete="name" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="document">CPF ou CNPJ</Label>
          <Input id="document" name="document" inputMode="numeric" placeholder="000.000.000-00" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerEmail">Email</Label>
          <Input id="ownerEmail" name="ownerEmail" type="email" placeholder="joao@email.com" autoComplete="email" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Repetir senha</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="whatsapp">Numero de WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" inputMode="tel" placeholder="(11) 99999-9999" autoComplete="tel" required />
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <p className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full gap-2" disabled={isPending}>
        {isPending ? <CheckCircle2 className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
        {isPending ? "Gerando pagamento..." : "Criar conta e pagar"}
      </Button>
    </form>
  );
}
