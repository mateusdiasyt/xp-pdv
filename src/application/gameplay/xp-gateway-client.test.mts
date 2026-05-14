import assert from "node:assert/strict";

import {
  postGameplayRelease,
  type XpGatewayClientConfig,
  type XpGatewayReleasePayload,
} from "./xp-gateway-client.ts";

const config: XpGatewayClientConfig = {
  baseUrl: "https://gateway.local",
  integrationKey: "secret",
  timeoutMs: 10,
  retryMax: 2,
};

const payload: XpGatewayReleasePayload = {
  integrationId: "pdv-xp-main",
  saleId: "sale-123",
  stationId: "tv-01",
  planCode: "GAMEPLAY-60",
  durationMinutes: 60,
  amount: 70,
  paidAt: "2026-05-14T10:00:00.000Z",
  operator: "Caixa",
};

const noDelay = async () => undefined;
const noBackoff = () => 0;

async function runCase(name: string, testCase: () => Promise<void>) {
  try {
    await testCase();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runCase("postGameplayRelease envia payload e retorna sucesso", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ releasedUntil: "2026-05-14T11:00:00.000Z" }), { status: 200 });
  };

  const result = await postGameplayRelease(payload, config, {
    fetchFn: fetchFn as typeof fetch,
    sleep: noDelay,
    backoffMs: noBackoff,
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://gateway.local/api/integrations/pdv/release");
  assert.equal((calls[0].init?.headers as Record<string, string>)["x-integration-key"], "secret");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), payload);
});

await runCase("postGameplayRelease tenta novamente em erro 500", async () => {
  let attempts = 0;
  const fetchFn = async () => {
    attempts += 1;
    if (attempts < 3) {
      return new Response(JSON.stringify({ error: "temporary" }), { status: 500 });
    }

    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  };

  const result = await postGameplayRelease(payload, config, {
    fetchFn: fetchFn as typeof fetch,
    sleep: noDelay,
    backoffMs: noBackoff,
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
  assert.equal(attempts, 3);
});

await runCase("postGameplayRelease tenta novamente em timeout", async () => {
  let attempts = 0;
  const timeoutError = new Error("aborted");
  timeoutError.name = "AbortError";

  const fetchFn = async () => {
    attempts += 1;
    if (attempts === 1) {
      throw timeoutError;
    }

    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  };

  const result = await postGameplayRelease(payload, config, {
    fetchFn: fetchFn as typeof fetch,
    sleep: noDelay,
    backoffMs: noBackoff,
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
});

await runCase("postGameplayRelease mantem saleId igual em todas as tentativas para idempotencia", async () => {
  const saleIds: string[] = [];
  const fetchFn = async (_url: string | URL | Request, init?: RequestInit) => {
    saleIds.push(JSON.parse(String(init?.body)).saleId);
    return new Response(JSON.stringify({ error: "gateway off" }), { status: 503 });
  };

  const result = await postGameplayRelease(payload, config, {
    fetchFn: fetchFn as typeof fetch,
    sleep: noDelay,
    backoffMs: noBackoff,
  });

  assert.equal(result.ok, false);
  assert.equal(result.attempts, 3);
  assert.deepEqual(saleIds, ["sale-123", "sale-123", "sale-123"]);
});
