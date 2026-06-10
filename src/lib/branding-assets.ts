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
  if (asset === "favicon") {
    return NextResponse.redirect(new URL("/mendoza-favicon.svg", request.url), {
      status: 307,
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  }

  const { customization } = await getBrandCustomizationSnapshot();
  const targetAssetDataUrl = customization.logoDataUrl;
  const parsedDataUrl = targetAssetDataUrl ? parseDataUrlImage(targetAssetDataUrl) : null;

  if (parsedDataUrl) {
    return new NextResponse(parsedDataUrl.bytes, {
      headers: {
        "Content-Type": parsedDataUrl.mimeType,
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  }

  return NextResponse.redirect(new URL("/mendoza-logo.svg", request.url), {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}
