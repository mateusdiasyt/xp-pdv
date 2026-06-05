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
          <Label htmlFor="companyName">Nome da empresa</Label>
          <Input id="companyName" name="companyName" placeholder="Bar do Joao" required />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="slug">Link do cliente</Label>
          <Input id="slug" name="slug" placeholder="bar-do-joao" required />
          <p className="text-xs text-muted-foreground">Vai ficar assim: /app/bar-do-joao/admin</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerName">Responsavel</Label>
          <Input id="ownerName" name="ownerName" placeholder="Joao" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerEmail">Email</Label>
          <Input id="ownerEmail" name="ownerEmail" type="email" placeholder="joao@email.com" required />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="password">Senha inicial</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
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
