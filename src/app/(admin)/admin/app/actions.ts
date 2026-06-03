"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getTvAppPagePin,
  tvAppPageAccessCookieName,
  tvAppPageAccessCookieValue,
} from "@/domain/tv-app/app-page-access";

export async function unlockTvAppPageAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "").trim();

  if (pin !== getTvAppPagePin()) {
    redirect("/admin/app?pin=invalid");
  }

  const cookieStore = await cookies();

  cookieStore.set(tvAppPageAccessCookieName, tvAppPageAccessCookieValue, {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: "/admin/app",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/admin/app");
}
