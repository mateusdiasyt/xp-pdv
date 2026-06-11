import { NextResponse } from "next/server";

import { syncMercadoPagoSubscriptionByPreapprovalId } from "@/application/platform/mercado-pago-billing-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preapprovalId =
    url.searchParams.get("preapproval_id") ??
    url.searchParams.get("preapprovalId") ??
    url.searchParams.get("id");
  const redirectUrl = new URL("/login?subscription=received", request.url);

  if (preapprovalId) {
    try {
      await syncMercadoPagoSubscriptionByPreapprovalId(preapprovalId);
      redirectUrl.searchParams.set("subscription", "synced");
    } catch {
      redirectUrl.searchParams.set("subscription", "pending");
    }
  }

  return NextResponse.redirect(redirectUrl);
}
