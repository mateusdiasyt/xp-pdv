import { NextResponse } from "next/server";

import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { customization } = await getBrandCustomizationSnapshot();
  const faviconVersion =
    "updatedAt" in customization && customization.updatedAt ? customization.updatedAt.getTime() : "default";

  return NextResponse.json(
    {
      browserTitle: customization.browserTitle,
      faviconHref: `/api/branding/favicon?v=${faviconVersion}`,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
