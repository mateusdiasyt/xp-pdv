import { NextRequest, NextResponse } from "next/server";

import { getActiveGameplayReleaseByStationId } from "@/infrastructure/db/repositories/gameplay-release-repository";

function getExpectedDeviceKey() {
  return process.env.XP_TV_DEVICE_KEY?.trim();
}

function getRemainingSeconds(unlockedUntil: Date, serverTime: Date) {
  return Math.max(0, Math.floor((unlockedUntil.getTime() - serverTime.getTime()) / 1000));
}

export async function GET(request: NextRequest) {
  const expectedDeviceKey = getExpectedDeviceKey();
  const receivedDeviceKey = request.headers.get("x-device-key")?.trim();

  if (expectedDeviceKey && receivedDeviceKey !== expectedDeviceKey) {
    return NextResponse.json(
      {
        stationId: null,
        status: "UNAUTHORIZED",
        message: "Chave da TV invalida. Contate o Mateus.",
      },
      { status: 401 },
    );
  }

  const stationId = request.nextUrl.searchParams.get("stationId")?.trim().toLowerCase();

  if (!stationId) {
    return NextResponse.json(
      {
        stationId: null,
        status: "ERROR",
        message: "Informe a estacao da TV. Contate o Mateus.",
      },
      { status: 400 },
    );
  }

  const serverTime = new Date();
  const activeRelease = await getActiveGameplayReleaseByStationId(stationId, serverTime);

  if (!activeRelease?.releasedUntil) {
    return NextResponse.json({
      stationId,
      status: "LOCKED",
      saleId: null,
      planCode: null,
      unlockedUntil: null,
      releasedUntil: null,
      remainingSeconds: 0,
      serverTime: serverTime.toISOString(),
    });
  }

  return NextResponse.json({
    stationId: activeRelease.stationId,
    status: "ACTIVE",
    saleId: activeRelease.saleId,
    saleNumber: activeRelease.sale.saleNumber,
    planCode: activeRelease.planCode,
    unlockedUntil: activeRelease.releasedUntil.toISOString(),
    releasedUntil: activeRelease.releasedUntil.toISOString(),
    remainingSeconds: getRemainingSeconds(activeRelease.releasedUntil, serverTime),
    serverTime: serverTime.toISOString(),
  });
}
