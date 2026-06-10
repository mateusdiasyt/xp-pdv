import { redirect } from "next/navigation";

import { buildTenantAdminPath } from "@/application/platform/platform-service";
import { getServerAuthSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (session?.user?.isPlatformAdmin && session.user.accessScope === "platform") {
    redirect("/super-admin");
  }

  if (session?.user) {
    redirect(buildTenantAdminPath(session.user.tenantSlug));
  }

  redirect("/login");
}
