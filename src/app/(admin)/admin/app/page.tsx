import { cookies, headers } from "next/headers";

import { Download, KeyRound, RefreshCw, Tv } from "lucide-react";

import { getTenantModuleEntitlements } from "@/application/platform/platform-service";
import { ModuleLockCard } from "@/components/admin/module-lock-card";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  tvAppPageAccessCookieName,
  tvAppPageAccessCookieValue,
} from "@/domain/tv-app/app-page-access";
import { tvAppUpdateManifest } from "@/domain/tv-app/update-manifest";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { getServerAuthSession } from "@/lib/auth";
import { DEFAULT_WORKSPACE_SLUG } from "@/lib/tenant-routes";
import { canUsePlatformModule } from "@/domain/platform/plan-entitlements";

import { unlockTvAppPageAction } from "./actions";

type TvAppPageProps = {
  searchParams: Promise<{
    pin?: string;
  }>;
};

export default async function TvAppPage({ searchParams }: TvAppPageProps) {
  const [session, cookieStore, requestHeaders, params] = await Promise.all([
    getServerAuthSession(),
    cookies(),
    headers(),
    searchParams,
  ]);
  const hasPinAccess = cookieStore.get(tvAppPageAccessCookieName)?.value === tvAppPageAccessCookieValue;
  const canUseSessionAccess =
    session?.user.roleSlug === "administrador" ||
    hasPermission(session?.user.permissions, PERMISSIONS.TV_APP_VIEW);
  const canViewPage = canUseSessionAccess || hasPinAccess;

  if (!canViewPage) {
    return <TvAppPinGate hasError={params.pin === "invalid"} />;
  }

  const tenantSlug = session?.user.tenantSlug ?? requestHeaders.get("x-tenant-slug") ?? DEFAULT_WORKSPACE_SLUG;
  const entitlements = await getTenantModuleEntitlements(tenantSlug);

  if (!canUsePlatformModule(entitlements, "tv-app")) {
    return (
      <div className="space-y-5 text-white">
        <PageHeader eyebrow="Plugin Platina" title="App da TV" description="APK e atualizacao obrigatoria ficam disponiveis no Plano Platina." />
        <ModuleLockCard
          title="App TV bloqueado"
          description="Ative o Plano Platina no painel super admin para liberar o APK, controle de atualizacoes e uso do app nas Smart TVs."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 text-white">
      <PageHeader eyebrow="TV" title="App da TV" description="APK usado nas TVs do bar." />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-card/78">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Tv className="size-4 text-primary" />
              Versao atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/55">Version code</p>
                <p className="mt-1 text-2xl font-semibold">{tvAppUpdateManifest.versionCode}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/55">Versao</p>
                <p className="mt-1 text-2xl font-semibold">{tvAppUpdateManifest.versionName}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/55">Tipo</p>
                <p className="mt-1 text-2xl font-semibold">Obrigatoria</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-transparent bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary/92"
                href={tvAppUpdateManifest.apkPath}
                download
              >
                <Download className="size-4" />
                Baixar APK
              </a>
              <a
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border/80 bg-background/85 px-3.5 text-sm font-medium text-white shadow-sm transition-all hover:border-border hover:bg-muted/70"
                href="/api/tv-app/latest"
                target="_blank"
                rel="noreferrer"
              >
                <RefreshCw className="size-4" />
                Ver JSON
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/78">
          <CardHeader className="pb-3">
            <CardTitle className="text-white">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tvAppUpdateManifest.releaseNotes.map((note) => (
                <div key={note} className="rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-sm text-white/85">
                  {note}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TvAppPinGate({ hasError }: { hasError: boolean }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <Card className="w-full max-w-sm border-border/80 bg-card/86 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/35 bg-primary/12 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div>
            <CardTitle className="text-xl text-white">Acesso ao APK</CardTitle>
            <p className="mt-1 text-sm text-white/55">Digite o PIN para baixar o app da TV.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form action={unlockTvAppPageAction} className="space-y-3">
            <input
              autoFocus
              autoComplete="one-time-code"
              className="h-12 w-full rounded-xl border border-border/80 bg-background/80 px-4 text-center text-lg font-semibold tracking-[0.35em] text-white outline-none transition focus:border-primary/70 focus:ring-4 focus:ring-primary/15"
              inputMode="numeric"
              maxLength={8}
              name="pin"
              placeholder="PIN"
              type="password"
            />
            {hasError ? <p className="text-sm font-medium text-primary">PIN incorreto.</p> : null}
            <button
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-primary/30"
              type="submit"
            >
              Entrar
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
