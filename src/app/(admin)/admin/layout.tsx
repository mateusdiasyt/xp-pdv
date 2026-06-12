import type { CSSProperties } from "react";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildBrandThemeVariables,
  defaultBrandCustomization,
  getBrandCustomizationSnapshot,
} from "@/application/customization/brand-customization-service";
import { getAccountNotificationData } from "@/application/accounts/account-payable-service";
import {
  buildTenantAdminPath,
  getTenantCompanyOnboardingState,
  getTenantModuleEntitlements,
} from "@/application/platform/platform-service";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { CompanyNameOnboardingModal } from "@/components/admin/company-name-onboarding-modal";
import { FooterCredit } from "@/components/admin/footer-credit";
import { PendingTenantHeader } from "@/components/platform/pending-tenant-header";
import { getServerAuthSession } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerAuthSession();
  const requestHeaders = await headers();
  const isPublicAdminApp = requestHeaders.get("x-public-admin-app") === "1";
  const adminPath = requestHeaders.get("x-admin-path") ?? "/admin";
  const user = session?.user;
  const shouldLoadTenantCustomization = Boolean(
    user && (!user.platformTenantStatus || user.platformTenantStatus === "ACTIVE"),
  );
  const activeTenantEntitlements =
    user && user.platformTenantStatus === "ACTIVE"
      ? await getTenantModuleEntitlements(user.tenantSlug)
      : null;
  const isPlanBlocked = Boolean(user && user.platformTenantStatus === "ACTIVE" && !activeTenantEntitlements?.activePlan);

  if (isPlanBlocked && adminPath !== "/admin/payment") {
    redirect(buildTenantAdminPath(user!.tenantSlug, "/admin/payment"));
  }

  const { customization } = shouldLoadTenantCustomization
    ? await getBrandCustomizationSnapshot()
    : { customization: defaultBrandCustomization };
  const themeVariables = buildBrandThemeVariables(customization);

  if (!user && !isPublicAdminApp) {
    return null;
  }

  if (!user && isPublicAdminApp) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background" style={themeVariables as CSSProperties}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_28%),radial-gradient(circle_at_86%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_34%)]" />
        <main className="relative min-h-screen px-4 py-8 md:px-6 xl:px-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">{children}</div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if ((user.platformTenantStatus && user.platformTenantStatus !== "ACTIVE") || isPlanBlocked) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background" style={themeVariables as CSSProperties}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_28%),radial-gradient(circle_at_86%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_34%)]" />
        <div className="relative flex min-h-screen flex-col">
          <PendingTenantHeader userName={user.name} userEmail={user.email} />
          <main className="flex-1 px-4 py-8 md:px-6 xl:px-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    );
  }

  const [accountNotificationData, companyOnboarding, moduleEntitlements] = await Promise.all([
    getAccountNotificationData(),
    getTenantCompanyOnboardingState(user.tenantSlug),
    activeTenantEntitlements ? Promise.resolve(activeTenantEntitlements) : getTenantModuleEntitlements(user.tenantSlug),
  ]);
  const accountNotifications = {
    count: accountNotificationData.count,
    overdueCount: accountNotificationData.overdueCount,
    dueSoonCount: accountNotificationData.dueSoonCount,
    items: accountNotificationData.items.map((item) => ({
      id: item.id,
      name: item.name,
      amount: Number(item.amount),
      dueDate: item.dueDate.toISOString().slice(0, 10),
    })),
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background" style={themeVariables as CSSProperties}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_28%),radial-gradient(circle_at_86%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_34%)]" />
      <div className="relative flex min-h-screen">
        <div className="hidden md:block">
          <AdminSidebar
            roleSlug={user.roleSlug}
            permissions={user.permissions}
            entitlements={moduleEntitlements}
          />
        </div>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AdminHeader
            userName={user.name}
            userEmail={user.email}
            roleSlug={user.roleSlug}
            permissions={user.permissions}
            accountNotifications={accountNotifications}
          />
          <main className="flex-1 px-4 pb-8 pt-5 md:px-6 xl:px-8">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">{children}</div>
          </main>
          <footer className="px-4 py-4 md:px-6 xl:px-8">
            <div className="mx-auto w-full max-w-[1600px]">
              <FooterCredit />
            </div>
          </footer>
        </div>
      </div>
      {companyOnboarding?.shouldConfirmCompanyName ? (
        <CompanyNameOnboardingModal initialCompanyName={companyOnboarding.companyName} />
      ) : null}
    </div>
  );
}
