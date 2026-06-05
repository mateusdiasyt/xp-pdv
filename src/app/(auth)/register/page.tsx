import Link from "next/link";
import { redirect } from "next/navigation";

import { buildTenantAdminPath } from "@/application/platform/platform-service";
import { RegisterTenantForm } from "@/components/platform/register-tenant-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";

export default async function RegisterPage() {
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect(buildTenantAdminPath(session.user.tenantSlug));
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-2xl">
        <Card className="border-border/80 bg-card/88 shadow-xl shadow-zinc-950/20">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Criar conta</CardTitle>
            <CardDescription>
              O cadastro entra como pendente. Depois da aprovacao, o cliente recebe um banco vazio e isolado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <RegisterTenantForm />
            <p className="text-center text-sm text-muted-foreground">
              Ja tem acesso?{" "}
              <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary/80">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
