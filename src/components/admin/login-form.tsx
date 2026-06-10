"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resolveLoginTenantsAction,
  type LoginTenantChoice,
} from "@/presentation/auth/login/actions";

const loginSchema = z.object({
  email: z.string().email("Digite um email valido"),
  password: z.string().min(6, "Digite sua senha"),
});

type LoginSchema = z.infer<typeof loginSchema>;

function extractWorkspaceFromCallbackUrl(callbackUrl: string | null) {
  if (!callbackUrl) {
    return "";
  }

  try {
    const url = callbackUrl.startsWith("/") ? new URL(callbackUrl, "https://xp.local") : new URL(callbackUrl);
    const match = url.pathname.match(/^\/app\/([^/.]+)(?:\/|$)/);
    return match?.[1] ?? "";
  } catch {
    const match = callbackUrl.match(/^\/app\/([^/.]+)(?:\/|$)/);
    return match?.[1] ?? "";
  }
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl");
  const workspace = searchParams.get("workspace")?.trim() || extractWorkspaceFromCallbackUrl(rawCallbackUrl);
  const callbackUrl = rawCallbackUrl ?? (workspace ? `/app/${workspace}` : "/admin");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tenantChoices, setTenantChoices] = useState<LoginTenantChoice[]>([]);
  const [loginValues, setLoginValues] = useState<LoginSchema | null>(null);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState<string | null>(null);

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function getCallbackUrlForTenant(tenantSlug: string) {
    if (workspace) {
      return callbackUrl;
    }

    return `/app/${tenantSlug}`;
  }

  async function signInToTenant(values: LoginSchema, tenantSlug: string) {
    setErrorMessage(null);
    setSelectedTenantSlug(tenantSlug);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      workspace: tenantSlug,
      callbackUrl: getCallbackUrlForTenant(tenantSlug),
      redirect: false,
    });

    if (!result || result.error) {
      setErrorMessage("Credenciais invalidas ou usuario sem acesso.");
      setSelectedTenantSlug(null);
      return;
    }

    window.location.assign(result.url ?? getCallbackUrlForTenant(tenantSlug));
  }

  async function onSubmit(values: LoginSchema) {
    setErrorMessage(null);
    setTenantChoices([]);
    setLoginValues(values);

    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    if (workspace) {
      formData.set("preferredWorkspace", workspace);
    }

    const resolution = await resolveLoginTenantsAction(formData);

    if (resolution.status === "error" || !resolution.tenants?.length) {
      setErrorMessage(resolution.message ?? "Credenciais invalidas ou usuario sem acesso.");
      return;
    }

    if (resolution.tenants.length === 1) {
      await signInToTenant(values, resolution.tenants[0].slug);
      return;
    }

    setTenantChoices(resolution.tenants);
  }

  return (
    <>
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

        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

        <Button className="w-full gap-2" type="submit" disabled={form.formState.isSubmitting || Boolean(selectedTenantSlug)}>
          <LogIn className="h-4 w-4" />
          {form.formState.isSubmitting || selectedTenantSlug ? "Entrando..." : "Entrar no painel"}
        </Button>
      </form>

      {tenantChoices.length > 1 && loginValues ? (
        <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/72 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-[#121012] p-5 text-white shadow-[0_44px_160px_-70px_rgba(0,0,0,0.95)]">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Acesso encontrado</p>
              <h2 className="mt-2 text-2xl font-black">Acessar qual PDV?</h2>
            </div>

            <div className="space-y-2">
              {tenantChoices.map((tenant) => (
                <button
                  key={tenant.slug}
                  type="button"
                  onClick={() => void signInToTenant(loginValues, tenant.slug)}
                  disabled={Boolean(selectedTenantSlug)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">{tenant.name}</span>
                      <span className="block truncate font-mono text-xs text-white/42">/{tenant.slug}</span>
                    </span>
                  </span>
                  <LogIn className="h-4 w-4 shrink-0 text-white/55" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setTenantChoices([]);
                setSelectedTenantSlug(null);
              }}
              className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/68 transition-colors hover:bg-white/8 hover:text-white"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
