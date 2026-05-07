import { PERMISSIONS, hasPermission } from "@/domain/auth/permissions";
import { resolveFiscalEnvironment } from "@/application/fiscal/fiscal-configuration-service";
import {
  getSaleFiscalDocumentById,
  updateSaleFiscalData,
} from "@/infrastructure/db/repositories/sale-fiscal-repository";
import { getServerAuthSession } from "@/lib/auth";

type FocusEnvironment = "homologacao" | "producao";

type FocusConsultaPayload = {
  caminho_xml_nota_fiscal?: string;
};

function normalizeEnvironment(value: string | null | undefined): FocusEnvironment {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.startsWith("prod") ? "producao" : "homologacao";
}

function getFocusBaseUrl(environment: FocusEnvironment) {
  return environment === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

function getFocusToken(environment: FocusEnvironment) {
  if (environment === "producao") {
    return process.env.FOCUS_NFE_TOKEN_PROD?.trim();
  }

  return process.env.FOCUS_NFE_TOKEN_HOMOLOG?.trim();
}

function buildAbsoluteUrl(baseUrl: string, maybePath: string | null | undefined) {
  if (!maybePath) {
    return null;
  }

  if (maybePath.startsWith("http://") || maybePath.startsWith("https://")) {
    return maybePath;
  }

  const normalizedPath = maybePath.startsWith("/") ? maybePath : `/${maybePath}`;
  return `${baseUrl}${normalizedPath}`;
}

async function queryFocusForXmlUrl(data: {
  reference: string;
  baseUrl: string;
  token: string;
}) {
  const response = await fetch(
    `${data.baseUrl}/v2/nfce/${encodeURIComponent(data.reference)}?completa=1`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${data.token}:`).toString("base64")}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as FocusConsultaPayload;
  return buildAbsoluteUrl(data.baseUrl, payload.caminho_xml_nota_fiscal);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      saleId: string;
    }>;
  },
) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new Response("Nao autorizado.", { status: 401 });
  }

  if (!hasPermission(session.user.permissions, PERMISSIONS.DASHBOARD_VIEW)) {
    return new Response("Sem permissao para baixar XML fiscal.", { status: 403 });
  }

  const { saleId } = await context.params;
  const sale = await getSaleFiscalDocumentById(saleId);
  if (!sale) {
    return new Response("Venda nao encontrada.", { status: 404 });
  }

  const reference = sale.fiscalReference ?? sale.saleNumber;
  if (!reference) {
    return new Response("Venda sem referencia fiscal para XML.", { status: 400 });
  }

  const environment = sale.fiscalEnvironment
    ? normalizeEnvironment(sale.fiscalEnvironment)
    : await resolveFiscalEnvironment();
  const baseUrl = getFocusBaseUrl(environment);
  const token = getFocusToken(environment);

  if (!token) {
    return new Response("Token fiscal nao configurado para este ambiente.", { status: 500 });
  }

  let xmlUrl = sale.fiscalXmlUrl;
  if (!xmlUrl) {
    xmlUrl = await queryFocusForXmlUrl({
      reference,
      baseUrl,
      token,
    });

    if (xmlUrl) {
      await updateSaleFiscalData(sale.id, {
        fiscalXmlUrl: xmlUrl,
        fiscalUpdatedAt: new Date(),
      });
    }
  }

  if (!xmlUrl) {
    return new Response("XML ainda nao disponivel para esta venda.", { status: 404 });
  }

  const xmlResponse = await fetch(xmlUrl, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
      Accept: "application/xml, text/xml, */*",
    },
    cache: "no-store",
  });

  if (!xmlResponse.ok) {
    return new Response("Nao foi possivel baixar o XML na Focus. Tente novamente em instantes.", {
      status: 502,
    });
  }

  const xmlContent = await xmlResponse.text();
  const encodedSaleNumber = sale.saleNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${encodedSaleNumber}.xml`;

  return new Response(xmlContent, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
