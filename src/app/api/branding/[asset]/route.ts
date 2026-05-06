import { NextResponse } from "next/server";

import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";

export const dynamic = "force-dynamic";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;

  if (asset !== "logo" && asset !== "favicon") {
    return NextResponse.json({ ok: false, message: "Asset nao suportado." }, { status: 404 });
  }

  const { customization } = await getBrandCustomizationSnapshot();
  const targetAssetDataUrl = asset === "logo" ? customization.logoDataUrl : customization.faviconDataUrl;
  const parsedDataUrl = targetAssetDataUrl ? parseDataUrlImage(targetAssetDataUrl) : null;

  if (parsedDataUrl) {
    return new NextResponse(parsedDataUrl.bytes, {
      headers: {
        "Content-Type": parsedDataUrl.mimeType,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const fallbackPath = asset === "logo" ? "/logo-maia.png" : "/favicon-maia-square.png";
  return NextResponse.redirect(new URL(fallbackPath, request.url), 307);
}
