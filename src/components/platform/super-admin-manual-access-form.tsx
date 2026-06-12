"use client";

import { type FormEvent, useState } from "react";
import { CalendarDays, Clock3, Loader2, PowerOff, ShieldCheck } from "lucide-react";

import { removeTenantPlanAction, updateTenantPlanAction } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";

type SuperAdminManualAccessFormProps = {
  tenantId: string;
  currentPlanName: string | null;
  planExpiresAtLabel: string;
  planExpiresAtInput: string;
};

export function SuperAdminManualAccessForm({
  tenantId,
  currentPlanName,
  planExpiresAtLabel,
  planExpiresAtInput,
}: SuperAdminManualAccessFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | "remove" | null>(null);

  async function handleSaveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pendingAction) {
      return;
    }

    setErrorMessage(null);
    setPendingAction("save");

    try {
      await updateTenantPlanAction(new FormData(event.currentTarget));
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o acesso.");
      setPendingAction(null);
    }
  }

  async function handleRemoveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pendingAction) {
      return;
    }

    setErrorMessage(null);
    setPendingAction("remove");

    try {
      await removeTenantPlanAction(new FormData(event.currentTarget));
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel remover o acesso.");
      setPendingAction(null);
    }
  }

  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <form onSubmit={handleSaveAccess}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground">Acesso manual do painel</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Libera, corrige validade ou remove o acesso sem gerar cobranca.
            </p>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Acesso atual</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Atual: <strong className="text-foreground">{currentPlanName ?? "Nao definido"}</strong>
            </p>
          </div>
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            {planExpiresAtLabel}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Plano liberado</span>
            <select
              name="planName"
              defaultValue={currentPlanName === "Platina" ? "Platina" : "Ouro"}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
              disabled={Boolean(pendingAction)}
            >
              <option value="Ouro">Ouro</option>
              <option value="Platina">Platina</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Validade</span>
            <select
              name="durationMonths"
              defaultValue={planExpiresAtInput ? "custom" : "1"}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
              disabled={Boolean(pendingAction)}
            >
              <option value="1">1 mes</option>
              <option value="3">3 meses</option>
              <option value="6">6 meses</option>
              <option value="12">1 ano</option>
              <option value="custom">Data manual</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Vence em</span>
            <input
              type="date"
              name="planExpiresAt"
              defaultValue={planExpiresAtInput}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
              disabled={Boolean(pendingAction)}
            />
          </label>

          <Button type="submit" size="sm" className="h-10 gap-2" disabled={Boolean(pendingAction)}>
            {pendingAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
            {pendingAction === "save" ? "Salvando..." : "Salvar acesso"}
          </Button>
        </div>
      </form>

      {currentPlanName ? (
        <form onSubmit={handleRemoveAccess} className="mt-3 flex justify-end">
          <input type="hidden" name="tenantId" value={tenantId} />
          <Button type="submit" size="sm" variant="outline" className="gap-2" disabled={Boolean(pendingAction)}>
            {pendingAction === "remove" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PowerOff className="h-4 w-4" />
            )}
            {pendingAction === "remove" ? "Removendo..." : "Remover acesso manual"}
          </Button>
        </form>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
