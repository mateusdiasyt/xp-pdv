import { NextResponse, type NextRequest } from "next/server";

import { tvAppUpdateManifest } from "@/domain/tv-app/update-manifest";

export function GET(request: NextRequest) {
  const apkUrl = new URL(tvAppUpdateManifest.apkPath, request.nextUrl.origin).toString();

  return NextResponse.json({
    versionCode: tvAppUpdateManifest.versionCode,
    versionName: tvAppUpdateManifest.versionName,
    apkUrl,
    required: tvAppUpdateManifest.required,
    publishedAt: tvAppUpdateManifest.publishedAt,
    releaseNotes: tvAppUpdateManifest.releaseNotes,
  });
}
