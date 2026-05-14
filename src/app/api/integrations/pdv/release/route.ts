import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { releaseGameplayInsidePdv } from "@/application/gameplay/internal-gameplay-gateway";

const releasePayloadSchema = z.object({
  integrationId: z.string().min(1),
  saleId: z.string().min(1),
  stationId: z.string().min(1),
  planCode: z.string().min(1),
  durationMinutes: z.coerce.number().int().positive(),
  amount: z.coerce.number().nonnegative(),
  paidAt: z.string().min(1),
  operator: z.string().min(1),
  customerId: z.string().optional(),
});

function getExpectedIntegrationKey() {
  return process.env.PDV_INTEGRATION_KEY?.trim() || process.env.XP_GATEWAY_INTEGRATION_KEY?.trim();
}

export async function POST(request: NextRequest) {
  const expectedKey = getExpectedIntegrationKey();
  const receivedKey = request.headers.get("x-integration-key")?.trim();

  if (!expectedKey || receivedKey !== expectedKey) {
    return NextResponse.json(
      {
        status: "UNAUTHORIZED",
        message: "Chave de integracao invalida. Contate o Mateus.",
      },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const payload = releasePayloadSchema.parse(body);
    const result = await releaseGameplayInsidePdv({
      ...payload,
      stationId: payload.stationId.trim().toLowerCase(),
      planCode: payload.planCode.trim(),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Dados invalidos para liberar gameplay. Contate o Mateus."
      : "Nao foi possivel liberar gameplay no PDV. Contate o Mateus.";

    return NextResponse.json(
      {
        status: "ERROR",
        message,
      },
      { status: 400 },
    );
  }
}
