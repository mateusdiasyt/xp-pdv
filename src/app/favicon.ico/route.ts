import { buildBrandAssetResponse } from "@/lib/branding-assets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return buildBrandAssetResponse("favicon", request);
}
