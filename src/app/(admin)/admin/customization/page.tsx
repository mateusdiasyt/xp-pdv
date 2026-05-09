import { requirePermission } from "@/application/auth/guards";
import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";
import { getFiscalEnvironmentSnapshot } from "@/application/fiscal/fiscal-configuration-service";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { UpdateBrandCustomizationForm } from "@/presentation/admin/customization/update-brand-customization-form";
import { UpdateFiscalEnvironmentForm } from "@/presentation/admin/customization/update-fiscal-environment-form";

export default async function CustomizationPage() {
  const session = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const { customization, setupPending } = await getBrandCustomizationSnapshot();
  const fiscal = await getFiscalEnvironmentSnapshot();
  const canManageFiscalEnvironment = hasPermission(session.user.permissions, PERMISSIONS.USERS_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modulo ERP"
        title="Personalizacao"
        description="Altere nome da aba, cores da interface, logo e favicon para adaptar o sistema para cada empresa."
      />

      <Card>
        <CardHeader>
          <CardTitle>Marca e identidade visual</CardTitle>
          <CardDescription>
            As alteracoes sao aplicadas no painel, na tela de login e na aba do navegador.
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
                browserTitle: customization.browserTitle,
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

      <Card>
        <CardHeader>
          <CardTitle>Ambiente fiscal NFC-e</CardTitle>
          <CardDescription>
            Troque entre homologacao e producao sem redeploy. A alteracao vale para novas emissoes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fiscal.setupPending ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
              O modulo fiscal precisa da tabela `FiscalConfiguration` no banco atual. Rode `db:push` e tente novamente.
            </div>
          ) : canManageFiscalEnvironment ? (
            <UpdateFiscalEnvironmentForm
              initialEnvironment={fiscal.environment}
              persisted={fiscal.persisted}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Somente usuarios administradores podem trocar o ambiente fiscal.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
