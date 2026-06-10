import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";

export async function requirePlatformAdmin() {
  const session = await getServerAuthSession();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/super-admin/login");
  }

  if (!session.user.isPlatformAdmin || session.user.accessScope !== "platform") {
    redirect("/forbidden");
  }

  return session;
}
