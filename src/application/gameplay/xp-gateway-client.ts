export type XpGatewayReleasePayload = {
  integrationId: string;
  saleId: string;
  stationId: string;
  planCode: string;
  durationMinutes: number;
  amount: number;
  paidAt: string;
  operator: string;
  customerId?: string;
};

export type XpGatewayClientConfig = {
  baseUrl: string;
  integrationKey: string;
  timeoutMs: number;
  retryMax: number;
};

export type XpGatewayReleaseResult = {
  ok: boolean;
  attempts: number;
  statusCode?: number;
  responsePayload?: unknown;
  errorMessage?: string;
};

type FetchLike = typeof fetch;
type SleepLike = (ms: number) => Promise<void>;

export function getXpGatewayConfig(): XpGatewayClientConfig | null {
  const baseUrl = process.env.XP_GATEWAY_BASE_URL?.trim();
  const integrationKey = process.env.XP_GATEWAY_INTEGRATION_KEY?.trim();

  if (!baseUrl || !integrationKey) {
    return null;
  }

  const timeoutMs = Number(process.env.XP_GATEWAY_TIMEOUT_MS ?? "8000");
  const retryMax = Number(process.env.XP_GATEWAY_RETRY_MAX ?? "2");

  return {
    baseUrl: baseUrl.replace(/\/+$/g, ""),
    integrationKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
    retryMax: Number.isFinite(retryMax) && retryMax >= 0 ? retryMax : 2,
  };
}

async function readResponsePayload(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function isRetryableHttpStatus(status: number) {
  return status >= 500 && status <= 599;
}

function getBackoffMs(attemptIndex: number) {
  return Math.min(600 * 2 ** attemptIndex, 3000);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Tempo limite atingido ao chamar o XP Gateway.";
    }

    return error.message;
  }

  return "Falha desconhecida ao chamar o XP Gateway.";
}

export async function postGameplayRelease(
  payload: XpGatewayReleasePayload,
  config: XpGatewayClientConfig,
  options?: {
    fetchFn?: FetchLike;
    sleep?: SleepLike;
    backoffMs?: (attemptIndex: number) => number;
  },
): Promise<XpGatewayReleaseResult> {
  const fetchFn = options?.fetchFn ?? fetch;
  const sleep = options?.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const backoffMs = options?.backoffMs ?? getBackoffMs;
  const maxAttempts = Math.max(1, config.retryMax + 1);
  let lastErrorMessage = "Nao foi possivel liberar o gameplay.";
  let lastStatusCode: number | undefined;
  let lastResponsePayload: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetchFn(`${config.baseUrl}/api/integrations/pdv/release`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-integration-key": config.integrationKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      lastStatusCode = response.status;
      lastResponsePayload = await readResponsePayload(response);

      if (response.ok) {
        return {
          ok: true,
          attempts: attempt,
          statusCode: response.status,
          responsePayload: lastResponsePayload,
        };
      }

      lastErrorMessage = `XP Gateway respondeu com status ${response.status}.`;

      if (!isRetryableHttpStatus(response.status) || attempt === maxAttempts) {
        return {
          ok: false,
          attempts: attempt,
          statusCode: response.status,
          responsePayload: lastResponsePayload,
          errorMessage: lastErrorMessage,
        };
      }
    } catch (error) {
      lastErrorMessage = getErrorMessage(error);
      if (attempt === maxAttempts) {
        return {
          ok: false,
          attempts: attempt,
          statusCode: lastStatusCode,
          responsePayload: lastResponsePayload,
          errorMessage: lastErrorMessage,
        };
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(backoffMs(attempt - 1));
  }

  return {
    ok: false,
    attempts: maxAttempts,
    statusCode: lastStatusCode,
    responsePayload: lastResponsePayload,
    errorMessage: lastErrorMessage,
  };
}
