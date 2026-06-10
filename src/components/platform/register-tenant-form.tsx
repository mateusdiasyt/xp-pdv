"use client";

import { useActionState } from "react";
import { Building2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerTenantAction, type RegisterTenantState } from "@/app/(auth)/register/actions";

const initialState: RegisterTenantState = {
  status: "idle",
};

export function RegisterTenantForm() {
  const [state, action, isPending] = useActionState(registerTenantAction, initialState);

  return (
    <form action={action} className="space-y-4">
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
        {isPending ? "Enviando..." : "Solicitar cadastro"}
      </Button>
    </form>
  );
}
