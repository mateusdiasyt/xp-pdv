import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";

export async function requirePlatformAdmin() {
  const session = await getServerAuthSession();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  if (!session.user.isPlatformAdmin) {
    redirect("/forbidden");
  }

  return session;
}
