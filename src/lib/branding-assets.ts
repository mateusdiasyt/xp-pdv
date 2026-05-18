import { NextResponse } from "next/server";

import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";

type BrandAsset = "logo" | "favicon";

function parseDataUrlImage(dataUrl: string) {
  const matches = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!matches) {
    return null;
  }

  const [, mimeType, base64Payload] = matches;
  try {
    const bytes = Buffer.from(base64Payload, "base64");
    return {
      mimeType,
      bytes,
    };
  } catch {
    return null;
  }
}

export async function buildBrandAssetResponse(asset: BrandAsset, request: Request) {
  const { customization } = await getBrandCustomizationSnapshot();
  const targetAssetDataUrl = asset === "logo" ? customization.logoDataUrl : customization.faviconDataUrl;
  const parsedDataUrl = targetAssetDataUrl ? parseDataUrlImage(targetAssetDataUrl) : null;

  if (parsedDataUrl) {
    return new NextResponse(parsedDataUrl.bytes, {
      headers: {
        "Content-Type": parsedDataUrl.mimeType,
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  }

  const fallbackPath = asset === "logo" ? "/logo-maia.png" : "/favicon-maia-square.png";
  return NextResponse.redirect(new URL(fallbackPath, request.url), {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}
