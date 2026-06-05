"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Digite um email valido"),
  password: z.string().min(6, "Digite sua senha"),
  workspace: z.string().optional(),
});

type LoginSchema = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspace = searchParams.get("workspace")?.trim() || "";
  const callbackUrl = searchParams.get("callbackUrl") ?? (workspace ? `/app/${workspace}/admin` : "/admin");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      workspace,
    },
  });

  async function onSubmit(values: LoginSchema) {
    setErrorMessage(null);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      workspace: values.workspace,
      callbackUrl,
      redirect: false,
    });

    if (!result || result.error) {
      setErrorMessage("Credenciais invalidas ou usuario sem acesso.");
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="admin@guildamaia.com"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-rose-600">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
        {form.formState.errors.password ? (
          <p className="text-xs text-rose-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      {workspace ? (
        <input type="hidden" {...form.register("workspace")} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="workspace">Cliente</Label>
          <Input id="workspace" placeholder="xp-arcade" {...form.register("workspace")} />
          <p className="text-xs text-muted-foreground">Pode deixar em branco se seu email estiver vinculado a uma conta.</p>
        </div>
      )}

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Button className="w-full gap-2" type="submit" disabled={form.formState.isSubmitting}>
        <LogIn className="h-4 w-4" />
        {form.formState.isSubmitting ? "Entrando..." : "Entrar no painel"}
      </Button>
    </form>
  );
}
