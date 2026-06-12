"use client";

import { type FormEvent, useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

import { createSellerSubscriptionCheckoutAction } from "@/app/seller/actions";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/presentation/admin/common/action-state";

type TenantOption = {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  status: string;
};

type SellerCheckoutFormProps = {
  tenants: TenantOption[];
};

export function SellerCheckoutForm({ tenants }: SellerCheckoutFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setGeneratedUrl(null);

    try {
      const result = await createSellerSubscriptionCheckoutAction(
        initialActionState,
        new FormData(event.currentTarget),
      );

      if (result.status === "success" && result.redirectUrl) {
        setGeneratedUrl(result.redirectUrl);
        window.open(result.redirectUrl, "_blank", "noopener,noreferrer");
        return;
      }

      setError(result.message ?? "Nao foi possivel gerar o link.");
    } catch {
      setError("Nao foi possivel gerar o link agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-border/70 bg-card/72 p-5">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Venda</p>
        <h2 className="mt-1 text-2xl font-black text-foreground">Gerar link de pagamento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o cliente, plano e periodo. O link fica marcado com a sua comissao.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Cliente</span>
          <select
            name="tenantId"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            disabled={isSubmitting || tenants.length === 0}
            required
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} - {tenant.ownerEmail}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Plano</span>
          <select
            name="planName"
            defaultValue="Ouro"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            disabled={isSubmitting}
          >
            <option value="Ouro">Ouro</option>
            <option value="Platina">Platina</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Periodo</span>
          <select
            name="billingCycleMonths"
            defaultValue="1"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            disabled={isSubmitting}
          >
            <option value="1">1 mes</option>
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
            <option value="12">1 ano</option>
          </select>
        </label>
      </div>

      {generatedUrl ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
          Link criado e aberto em nova aba.
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {generatedUrl ? (
          <Button render={<a href={generatedUrl} target="_blank" rel="noreferrer" />} type="button" variant="outline">
            <ExternalLink className="h-4 w-4" />
            Abrir link
          </Button>
        ) : null}
        <Button type="submit" className="gap-2" disabled={isSubmitting || tenants.length === 0}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {isSubmitting ? "Gerando..." : "Gerar link"}
        </Button>
      </div>
    </form>
  );
}
