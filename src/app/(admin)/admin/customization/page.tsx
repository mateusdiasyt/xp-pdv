import { requirePermission } from "@/application/auth/guards";
import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";
import { getFiscalSettingsSnapshot } from "@/application/fiscal/fiscal-configuration-service";
import {
  getTenantCustomLinkState,
  getTenantModuleEntitlements,
} from "@/application/platform/platform-service";
import { PageHeader } from "@/components/admin/page-header";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { canUsePlatformModule } from "@/domain/platform/plan-entitlements";
import { CustomizationSections } from "@/presentation/admin/customization/customization-sections";
import { TenantCustomLinkForm } from "@/presentation/admin/customization/tenant-custom-link-form";
import { UpdateBrandCustomizationForm } from "@/presentation/admin/customization/update-brand-customization-form";
import { UpdateFiscalEnvironmentForm } from "@/presentation/admin/customization/update-fiscal-environment-form";

export default async function CustomizationPage() {
  const session = await requirePermission(PERMISSIONS.CUSTOMIZATION_VIEW);
  const [{ customization, setupPending }, entitlements] = await Promise.all([
    getBrandCustomizationSnapshot(),
    getTenantModuleEntitlements(session.user.tenantSlug),
  ]);
  const canUseCustomLink = canUsePlatformModule(entitlements, "custom-link");
  const canUseFiscal = canUsePlatformModule(entitlements, "fiscal-focus");
  const fiscal = canUseFiscal ? await getFiscalSettingsSnapshot() : null;
  const tenantLink = canUseCustomLink ? await getTenantCustomLinkState(session.user.tenantSlug) : null;
  const canManageFiscalEnvironment = hasPermission(session.user.permissions, PERMISSIONS.USERS_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ERP"
        title="Configuracoes"
        description="Ajuste identidade visual, horario operacional e credenciais fiscais do sistema."
      />

      <CustomizationSections
        brandPanel={
          setupPending ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
              A area de personalizacao precisa da tabela `BrandCustomization` no banco atual. Rode `db:push` e tente novamente.
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
                businessTimezone: customization.businessTimezone,
                businessDayStartsAt: customization.businessDayStartsAt,
                businessDayEndsAt: customization.businessDayEndsAt,
              }}
            />
          )
        }
        linkPanel={tenantLink ? <TenantCustomLinkForm currentSlug={tenantLink.slug} /> : null}
        fiscalPanel={
          fiscal?.setupPending ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
              O plugin fiscal precisa da tabela `FiscalConfiguration` no banco atual. Rode `db:push` e tente novamente.
            </div>
          ) : fiscal && canManageFiscalEnvironment ? (
            <UpdateFiscalEnvironmentForm
              settings={fiscal}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Somente usuarios administradores podem trocar o ambiente fiscal.
            </p>
          )
        }
        lockedSections={{
          ...(canUseCustomLink
            ? {}
            : {
                link: {
                  title: "Link personalizado bloqueado",
                  description:
                    "O endereco exclusivo do PDV fica disponivel para clientes com Plano Platina ativo.",
                },
              }),
          ...(canUseFiscal
            ? {}
            : {
                fiscal: {
                  title: "Fiscal / Focus NFe bloqueado",
                  description:
                    "Tokens, CNPJ, ambiente de emissao e configuracoes NFC-e ficam disponiveis para clientes com Plano Platina ativo.",
                },
              }),
        }}
      />
    </div>
  );
}
