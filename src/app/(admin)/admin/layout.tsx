import type { CSSProperties } from "react";

import { headers } from "next/headers";

import {
  buildBrandThemeVariables,
  getBrandCustomizationSnapshot,
} from "@/application/customization/brand-customization-service";
import { getAccountNotificationData } from "@/application/accounts/account-payable-service";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { FooterCredit } from "@/components/admin/footer-credit";
import { getServerAuthSession } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerAuthSession();
  const requestHeaders = await headers();
  const { customization } = await getBrandCustomizationSnapshot();
  const themeVariables = buildBrandThemeVariables(customization);
  const isPublicAdminApp = requestHeaders.get("x-public-admin-app") === "1";
  const user = session?.user;

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

  const accountNotificationData = await getAccountNotificationData();
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
    </div>
  );
}
