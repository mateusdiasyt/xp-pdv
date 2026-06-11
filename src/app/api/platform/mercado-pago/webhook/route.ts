import { NextResponse } from "next/server";

import { processMercadoPagoWebhook } from "@/application/platform/mercado-pago-billing-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const rawBody = await request.text();
  let payload: Record<string, unknown> = {};

  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  try {
    const result = await processMercadoPagoWebhook({
      payload,
      headers: request.headers,
      searchParams: url.searchParams,
    });

    if (result.status === "unauthorized") {
      return NextResponse.json({ ok: false, message: result.message }, { status: 401 });
    }

    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Falha ao processar webhook.",
      },
      { status: 500 },
    );
  }
}
