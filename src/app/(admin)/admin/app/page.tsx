import { Download, RefreshCw, Tv } from "lucide-react";

import { requirePermission } from "@/application/auth/guards";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { tvAppUpdateManifest } from "@/domain/tv-app/update-manifest";

export default async function TvAppPage() {
  await requirePermission(PERMISSIONS.DASHBOARD_VIEW);

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
