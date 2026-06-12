"use client";

import { type FormEvent, useState } from "react";
import { Building2, CheckCircle2 } from "lucide-react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerTenantAction, type RegisterTenantState } from "@/app/(auth)/register/actions";

const initialState: RegisterTenantState = {
  status: "idle",
};

export function RegisterTenantForm() {
  const [state, setState] = useState<RegisterTenantState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setIsPending(true);
    setState(initialState);

    try {
      const formData = new FormData(event.currentTarget);
      const ownerEmail = String(formData.get("ownerEmail") ?? "");
      const password = String(formData.get("password") ?? "");
      const result = await registerTenantAction(initialState, formData);
      setState(result);

      if (result.status === "success") {
        const redirectUrl = result.redirectUrl ?? "/login?registered=1";
        const tenantSlug = result.tenantSlug ?? "";
        const signInResult = await signIn("credentials", {
          email: ownerEmail,
          password,
          workspace: tenantSlug,
          accessScope: "tenant",
          callbackUrl: redirectUrl,
          redirect: false,
        });

        if (!signInResult || signInResult.error || !signInResult.ok) {
          const loginUrl = new URL("/login", window.location.origin);
          loginUrl.searchParams.set("registered", "1");
          loginUrl.searchParams.set("callbackUrl", redirectUrl);

          if (tenantSlug) {
            loginUrl.searchParams.set("workspace", tenantSlug);
          }

          window.location.assign(loginUrl.toString());
          return;
        }

        window.location.assign(signInResult?.url ?? redirectUrl);
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
        {isPending ? "Criando painel..." : "Criar conta"}
      </Button>
    </form>
  );
}
