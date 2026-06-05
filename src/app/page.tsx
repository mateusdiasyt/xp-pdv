import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildTenantAdminPath } from "@/application/platform/platform-service";
import { getServerAuthSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect(buildTenantAdminPath(session.user.tenantSlug));
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="flex flex-col justify-center gap-5">
            <div className="inline-flex w-fit rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              XP PDV
            </div>
            <div className="space-y-3">
              <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">PDV, estoque e fiscal para operacao real.</h1>
              <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                Controle vendas, caixa, produtos, NFC-e, comandas, servicos e relatorios em um painel escuro e direto.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button render={<Link href="/login" />}>
                Entrar
              </Button>
              <Button render={<Link href="/register" />} variant="outline">
                Criar conta
              </Button>
            </div>
          </div>

          <Card className="border-border/80 bg-card/82 shadow-[0_28px_90px_-58px_rgba(0,0,0,0.9)]">
            <CardHeader>
              <CardTitle>Conta por cliente</CardTitle>
              <CardDescription>
                Cada cliente aprovado recebe um ambiente isolado, com produtos, vendas e fiscal separados.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                Banco novo e vazio para cada cliente aprovado.
              </div>
              <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                Configuracoes Focus NFe ficam no banco do proprio cliente.
              </div>
              <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                Seu bar continua preservado como cliente XP Arcade.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
