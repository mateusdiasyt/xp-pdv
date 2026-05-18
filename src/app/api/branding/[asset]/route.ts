import { NextResponse } from "next/server";

import { buildBrandAssetResponse } from "@/lib/branding-assets";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;

  if (asset !== "logo" && asset !== "favicon") {
    return NextResponse.json({ ok: false, message: "Asset nao suportado." }, { status: 404 });
  }

  return buildBrandAssetResponse(asset, request);
}
