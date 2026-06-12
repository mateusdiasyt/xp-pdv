import { redirect } from "next/navigation";

import { getPlatformGatewayConfigurationSnapshot } from "@/application/platform/gateway-service";
import { getTenantPaymentPortalState } from "@/application/platform/mercado-pago-billing-service";
import { buildTenantAdminPath } from "@/application/platform/platform-service";
import { PendingTenantPaymentPanel } from "@/components/platform/pending-tenant-payment-panel";
import type { PlatformBillingCycleMonths } from "@/domain/platform/billing-plans";
import { resolveActivePlatformPlan, type PlatformPlanName } from "@/domain/platform/plan-entitlements";
import { getServerAuthSession } from "@/lib/auth";

function normalizePlanName(value?: string | null): PlatformPlanName {
  return value === "Platina" ? "Platina" : "Ouro";
}

function normalizeCycle(value?: number | null): PlatformBillingCycleMonths {
  return value === 3 || value === 6 || value === 12 ? value : 1;
}

export default async function PendingTenantPaymentPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  const portalState = await getTenantPaymentPortalState(session.user.tenantSlug);

  if (!portalState) {
    redirect("/login");
  }

  const activePlan = resolveActivePlatformPlan({
    planName: portalState.planName,
    planStatus: portalState.planStatus,
    planExpiresAt: portalState.planExpiresAt,
  });

  if (portalState.tenantStatus === "ACTIVE" && activePlan) {
    redirect(buildTenantAdminPath(session.user.tenantSlug));
  }

  const gateway = await getPlatformGatewayConfigurationSnapshot();

  return (
    <PendingTenantPaymentPanel
      tenantName={portalState.tenantName}
      tenantStatus={portalState.tenantStatus}
      ownerEmail={portalState.ownerEmail}
      planStatus={portalState.planStatus}
      planExpiresAt={portalState.planExpiresAt?.toISOString() ?? null}
      mercadoPagoPublicKey={gateway.publicKey}
      mercadoPagoEnvironment={gateway.environment}
      defaultPlanName={normalizePlanName(portalState.latestSubscription?.planName ?? portalState.planName)}
      defaultBillingCycleMonths={normalizeCycle(portalState.latestSubscription?.billingCycleMonths)}
      latestSubscription={portalState.latestSubscription}
    />
  );
}
