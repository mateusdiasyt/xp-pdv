"use client";

import { type FormEvent, useState } from "react";
import { Loader2, LogIn } from "lucide-react";

import { sellerLoginAction } from "@/app/seller/actions";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/presentation/admin/common/action-state";

export function SellerLoginForm() {
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
      const result = await sellerLoginAction(initialActionState, new FormData(event.currentTarget));

      if (result.status === "success") {
        window.location.href = "/seller";
        return;
      }

      setError(result.message ?? "Nao foi possivel entrar.");
    } catch {
      setError("Nao foi possivel entrar agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-white/72">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-primary"
          required
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-white/72">Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-primary"
          required
        />
      </label>
      {error ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full gap-2" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {isSubmitting ? "Entrando..." : "Entrar como vendedor"}
      </Button>
    </form>
  );
}
