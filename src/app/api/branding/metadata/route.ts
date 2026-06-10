import { NextResponse } from "next/server";

import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { customization } = await getBrandCustomizationSnapshot();

  return NextResponse.json(
    {
      browserTitle: customization.browserTitle,
      faviconHref: "/api/branding/favicon?v=mendoza",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
