import { requirePermission } from "@/application/auth/guards";
import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { UpdateBrandCustomizationForm } from "@/presentation/admin/customization/update-brand-customization-form";

export default async function CustomizationPage() {
  await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const { customization, setupPending } = await getBrandCustomizationSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modulo ERP"
        title="Personalizacao"
        description="Altere cores da interface, logo e favicon para adaptar o sistema para cada empresa."
      />

      <Card>
        <CardHeader>
          <CardTitle>Marca e identidade visual</CardTitle>
          <CardDescription>
            As alteracoes sao aplicadas no painel e na tela de login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {setupPending ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
              O modulo de personalizacao precisa da tabela `BrandCustomization` no banco atual. Rode `db:push` e tente novamente.
            </div>
          ) : (
            <UpdateBrandCustomizationForm
              initialValues={{
                primaryColor: customization.primaryColor,
                accentColor: customization.accentColor,
                backgroundColor: customization.backgroundColor,
                foregroundColor: customization.foregroundColor,
                logoDataUrl: customization.logoDataUrl,
                faviconDataUrl: customization.faviconDataUrl,
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
