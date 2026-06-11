"use client";

import { CreditCard, KeyRound, Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { updateGatewayConfigurationAction } from "@/app/super-admin/actions";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import type { PlatformGatewayConfigurationSnapshot } from "@/application/platform/gateway-service";

type SuperAdminGatewayFormProps = {
  gateway: PlatformGatewayConfigurationSnapshot;
};

export function SuperAdminGatewayForm({ gateway }: SuperAdminGatewayFormProps) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setState(initialActionState);

    try {
      const result = await updateGatewayConfigurationAction(initialActionState, new FormData(event.currentTarget));
      setState(result);

      if (result.status === "success") {
        window.location.reload();
      }
    } catch {
      setState({
        status: "error",
        message: "Nao foi possivel salvar o gateway. Se o problema persistir, contate o Mateus.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Ambiente</span>
          <select
            name="environment"
            defaultValue={gateway.environment}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
          >
            <option value="test">Teste</option>
            <option value="production">Producao</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Public Key</span>
          <input
            name="publicKey"
            defaultValue={gateway.publicKey}
            placeholder="TEST-..."
            className="h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary"
            required
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Access Token</span>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 transition-colors focus-within:border-primary">
          <KeyRound className="h-4 w-4 text-primary" />
          <input
            name="accessToken"
            placeholder={gateway.hasAccessToken ? "Token ja configurado. Preencha apenas para trocar." : "TEST-..."}
            className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm text-foreground outline-none"
            type="password"
          />
        </div>
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="runConnectionTest"
          value="1"
          defaultChecked
          className="h-4 w-4 accent-primary"
        />
        Testar conexao com Mercado Pago ao salvar
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" className="gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {isSubmitting ? "Salvando..." : "Salvar gateway"}
        </Button>
        <p className="text-xs text-muted-foreground">
          O Access Token fica criptografado no banco e so e usado no backend.
        </p>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
