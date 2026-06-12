"use client";

import { type FormEvent, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";

import { createPlatformSellerAction } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/presentation/admin/common/action-state";

export function SuperAdminSellerForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await createPlatformSellerAction(initialActionState, new FormData(event.currentTarget));

      if (result.status === "success") {
        setMessage(result.message ?? "Vendedor criado.");
        window.setTimeout(() => window.location.reload(), 250);
        return;
      }

      setError(result.message ?? "Nao foi possivel criar o vendedor.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel criar o vendedor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border/70 bg-background/45 p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <UserPlus className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-black text-foreground">Novo vendedor</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Crie acesso para gerar links de planos e acompanhar comissoes.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_1.15fr_0.75fr_0.75fr_auto] lg:items-end">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Nome</span>
          <input
            name="name"
            placeholder="Nome do vendedor"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            disabled={isSubmitting}
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Email</span>
          <input
            name="email"
            type="email"
            placeholder="vendedor@mendozapdv.com.br"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            disabled={isSubmitting}
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Senha</span>
          <input
            name="password"
            type="password"
            minLength={6}
            placeholder="Min. 6 caracteres"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            disabled={isSubmitting}
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Comissao</span>
          <input
            name="commissionPercent"
            inputMode="decimal"
            defaultValue="10"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
            disabled={isSubmitting}
            required
          />
        </label>

        <Button type="submit" className="h-11 gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {isSubmitting ? "Criando..." : "Criar"}
        </Button>
      </div>

      {message ? (
        <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
