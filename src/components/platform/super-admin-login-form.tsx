"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const superAdminLoginSchema = z.object({
  email: z.string().email("Digite um email valido"),
  password: z.string().min(6, "Digite sua senha"),
});

type SuperAdminLoginSchema = z.infer<typeof superAdminLoginSchema>;

export function SuperAdminLoginForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<SuperAdminLoginSchema>({
    resolver: zodResolver(superAdminLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: SuperAdminLoginSchema) {
    setErrorMessage(null);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      accessScope: "platform",
      callbackUrl: "/super-admin",
      redirect: false,
    });

    if (!result || result.error) {
      setErrorMessage("Credenciais invalidas ou conta sem permissao de super admin.");
      return;
    }

    window.location.assign(result.url ?? "/super-admin");
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="super-admin-email">Email</Label>
        <Input
          id="super-admin-email"
          type="email"
          autoComplete="email"
          placeholder="admin@mendozapdv.com.br"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-rose-300">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="super-admin-password">Senha</Label>
        <Input
          id="super-admin-password"
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-rose-300">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <Button
        className="h-11 w-full gap-2"
        type="submit"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? <ShieldCheck className="h-4 w-4 animate-pulse" /> : <LogIn className="h-4 w-4" />}
        {form.formState.isSubmitting ? "Entrando..." : "Entrar no super admin"}
      </Button>
    </form>
  );
}
