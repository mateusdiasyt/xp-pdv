"use client";

import { type FormEvent, useState } from "react";
import { CreditCard, ExternalLink, Loader2, X } from "lucide-react";

import { createTenantSubscriptionCheckoutAction } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/presentation/admin/common/action-state";

type SellerOption = {
  id: string;
  name: string;
  commissionLabel: string;
  status: string;
};

type TenantSubscriptionCheckoutButtonProps = {
  tenantId: string;
  defaultPlanName: "Ouro" | "Platina";
  defaultBillingCycleMonths?: number;
  sellers?: SellerOption[];
};

export function TenantSubscriptionCheckoutButton({
  tenantId,
  defaultPlanName,
  defaultBillingCycleMonths = 1,
  sellers = [],
}: TenantSubscriptionCheckoutButtonProps) {
  const [open, setOpen] = useState(false);
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
      const result = await createTenantSubscriptionCheckoutAction(initialActionState, new FormData(event.currentTarget));

      if (result.status === "success" && result.redirectUrl) {
        setGeneratedUrl(result.redirectUrl);
        window.open(result.redirectUrl, "_blank", "noopener,noreferrer");
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
    <>
      <Button type="button" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <CreditCard className="h-4 w-4" />
        Gerar link de pagamento
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/78 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-5 shadow-[0_40px_140px_-70px_rgba(0,0,0,0.95)]">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-border/70 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Mercado Pago</p>
                <h3 className="mt-1 text-xl font-black text-foreground">Gerar link de pagamento</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie uma cobranca avulsa para o cliente pagar fora do painel.
                </p>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" name="tenantId" value={tenantId} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Plano</span>
                  <select
                    name="planName"
                    defaultValue={defaultPlanName}
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
                    defaultValue={String(defaultBillingCycleMonths)}
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

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Vendedor</span>
                <select
                  name="sellerId"
                  defaultValue=""
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
                  disabled={isSubmitting}
                >
                  <option value="">Sem vendedor vinculado</option>
                  {sellers
                    .filter((seller) => seller.status === "active")
                    .map((seller) => (
                      <option key={seller.id} value={seller.id}>
                        {seller.name} - comissao {seller.commissionLabel}
                      </option>
                    ))}
                </select>
              </label>

              {generatedUrl ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                  Link criado. Ele foi aberto em uma nova aba e ficou registrado para o cliente.
                </div>
              ) : null}

              {error ? (
                <p className="rounded-2xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {generatedUrl ? (
                  <Button render={<a href={generatedUrl} target="_blank" rel="noreferrer" />} type="button" variant="outline">
                    <ExternalLink className="h-4 w-4" />
                    Abrir link
                  </Button>
                ) : null}
                <Button type="submit" className="gap-2" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {isSubmitting ? "Gerando..." : "Gerar link"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
