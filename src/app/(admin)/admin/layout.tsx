import type { CSSProperties } from "react";

import { headers } from "next/headers";

import {
  buildBrandThemeVariables,
  getBrandCustomizationSnapshot,
} from "@/application/customization/brand-customization-service";
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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_15%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_30%),radial-gradient(circle_at_88%_4%,color-mix(in_oklab,var(--accent)_24%,transparent),transparent_36%),radial-gradient(circle_at_80%_88%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_30%)]" />
        <main className="relative min-h-screen px-4 py-8 md:px-6 xl:px-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">{children}</div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background" style={themeVariables as CSSProperties}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_15%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_30%),radial-gradient(circle_at_88%_4%,color-mix(in_oklab,var(--accent)_24%,transparent),transparent_36%),radial-gradient(circle_at_80%_88%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_30%)]" />
      <div className="relative flex min-h-screen">
        <div className="hidden md:block">
          <AdminSidebar
            roleSlug={user.roleSlug}
            permissions={user.permissions}
          />
        </div>

        <div className="flex min-h-screen flex-1 flex-col">
          <AdminHeader
            userName={user.name}
            userEmail={user.email}
            roleSlug={user.roleSlug}
            permissions={user.permissions}
          />
          <main className="flex-1 px-3 pb-8 pt-4 md:px-5 md:pt-5 xl:px-6">
            <div className="mx-auto flex w-full max-w-[1660px] flex-col gap-6">{children}</div>
          </main>
          <footer className="border-t border-border/70 px-3 py-3 md:px-5 xl:px-6">
            <div className="mx-auto w-full max-w-[1660px]">
              <FooterCredit />
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}