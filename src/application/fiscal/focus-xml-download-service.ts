import { resolveFiscalEnvironment } from "@/application/fiscal/fiscal-configuration-service";

export type FocusEnvironment = "homologacao" | "producao";

export type FocusConnection = {
  environment: FocusEnvironment;
  baseUrl: string;
  token: string;
};

type FocusNfcePayload = {
  status?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_xml_cancelamento?: string;
};

type ResolveSaleXmlUrlInput = {
  existingXmlUrl?: string | null;
  reference: string;
  connection: FocusConnection;
  preferCancellationXml?: boolean;
};

type ResolveSaleXmlUrlOutput = {
  xmlUrl: string | null;
  source: "stored" | "nota" | "cancelamento" | "none";
  persistableXmlUrl: string | null;
};

function normalizeEnvironment(value: string | null | undefined): FocusEnvironment {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.startsWith("prod") ? "producao" : "homologacao";
}

export function getFocusBaseUrl(environment: FocusEnvironment) {
  return environment === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

export function getFocusToken(environment: FocusEnvironment) {
  if (environment === "producao") {
    return process.env.FOCUS_NFE_TOKEN_PROD?.trim();
  }

  return process.env.FOCUS_NFE_TOKEN_HOMOLOG?.trim();
}

export async function resolveFocusConnection(preferredEnvironment?: string | null): Promise<FocusConnection | null> {
  const environment = preferredEnvironment
    ? normalizeEnvironment(preferredEnvironment)
    : await resolveFiscalEnvironment();
  const token = getFocusToken(environment);
  if (!token) {
    return null;
  }

  return {
    environment,
    baseUrl: getFocusBaseUrl(environment),
    token,
  };
}

function toBasicAuthHeader(token: string) {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

export function buildAbsoluteFocusUrl(baseUrl: string, maybePath: string | null | undefined) {
  if (!maybePath) {
    return null;
  }

  if (maybePath.startsWith("http://") || maybePath.startsWith("https://")) {
    return maybePath;
  }

  const normalizedPath = maybePath.startsWith("/") ? maybePath : `/${maybePath}`;
  return `${baseUrl}${normalizedPath}`;
}

export async function queryFocusNfceByReference(data: {
  connection: FocusConnection;
  reference: string;
}) {
  const response = await fetch(
    `${data.connection.baseUrl}/v2/nfce/${encodeURIComponent(data.reference)}?completa=1`,
    {
      method: "GET",
      headers: {
        Authorization: toBasicAuthHeader(data.connection.token),
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as FocusNfcePayload;
  return payload;
}

export function sanitizeSaleNumberForFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function resolveSaleXmlUrlForDownload(input: ResolveSaleXmlUrlInput): Promise<ResolveSaleXmlUrlOutput> {
  if (input.existingXmlUrl) {
    return {
      xmlUrl: input.existingXmlUrl,
      source: "stored",
      persistableXmlUrl: input.existingXmlUrl,
    };
  }

  const payload = await queryFocusNfceByReference({
    connection: input.connection,
    reference: input.reference,
  });

  if (!payload) {
    return {
      xmlUrl: null,
      source: "none",
      persistableXmlUrl: null,
    };
  }

  const xmlNotaUrl = buildAbsoluteFocusUrl(input.connection.baseUrl, payload.caminho_xml_nota_fiscal);
  const xmlCancelamentoUrl = buildAbsoluteFocusUrl(input.connection.baseUrl, payload.caminho_xml_cancelamento);

  if (input.preferCancellationXml && xmlCancelamentoUrl) {
    return {
      xmlUrl: xmlCancelamentoUrl,
      source: "cancelamento",
      persistableXmlUrl: xmlNotaUrl,
    };
  }

  if (xmlNotaUrl) {
    return {
      xmlUrl: xmlNotaUrl,
      source: "nota",
      persistableXmlUrl: xmlNotaUrl,
    };
  }

  if (xmlCancelamentoUrl) {
    return {
      xmlUrl: xmlCancelamentoUrl,
      source: "cancelamento",
      persistableXmlUrl: null,
    };
  }

  return {
    xmlUrl: null,
    source: "none",
    persistableXmlUrl: null,
  };
}

export async function downloadFocusXmlContent(data: {
  connection: FocusConnection;
  xmlUrl: string;
}) {
  const response = await fetch(data.xmlUrl, {
    method: "GET",
    headers: {
      Authorization: toBasicAuthHeader(data.connection.token),
      Accept: "application/xml, text/xml, */*",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const content = await response.text();
  return content || null;
}
