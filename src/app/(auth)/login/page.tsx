import type { CSSProperties } from "react";
import { redirect } from "next/navigation";

import {
  buildBrandThemeVariables,
  getBrandCustomizationSnapshot,
} from "@/application/customization/brand-customization-service";
import { buildTenantAdminPath } from "@/application/platform/platform-service";
import { BrandLogo } from "@/components/admin/brand-logo";
import { LoginForm } from "@/components/admin/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getServerAuthSession();
  const { customization } = await getBrandCustomizationSnapshot();
  const themeVariables = buildBrandThemeVariables(customization);

  if (session?.user) {
    redirect(buildTenantAdminPath(session.user.tenantSlug));
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12" style={themeVariables as CSSProperties}>
      <section className="w-full max-w-md">
        <Card className="border-border/80 bg-card/88 shadow-xl shadow-zinc-900/10">
          <CardHeader className="space-y-3">
            <BrandLogo priority className="mx-auto w-52" />
            <CardTitle className="text-2xl">Entrar no painel administrativo</CardTitle>
            <CardDescription>
              Acesso protegido para operacao administrativa, cadastro e controle de estoque.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
