import { listFiscalSales } from "@/infrastructure/db/repositories/sale-fiscal-repository";

type GetFiscalExportsDataInput = {
  query?: string;
  startDate?: string;
  endDate?: string;
  fiscalStatus?: string;
};

function parseDateStart(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00.000`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function parseDateEnd(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function normalizeStatus(value?: string) {
  const normalized = (value ?? "ALL").trim().toUpperCase();
  if (!normalized) {
    return "ALL";
  }

  return normalized;
}

export async function getFiscalExportsData(input: GetFiscalExportsDataInput) {
  const normalizedQuery = input.query?.trim() ?? "";
  const normalizedStatus = normalizeStatus(input.fiscalStatus);
  const startDate = parseDateStart(input.startDate);
  const endDate = parseDateEnd(input.endDate);

  const sales = await listFiscalSales({
    query: normalizedQuery || undefined,
    fiscalStatus: normalizedStatus,
    startDate,
    endDate,
  });

  const authorizedCount = sales.filter((sale) => sale.fiscalStatus === "AUTHORIZED").length;
  const withXmlCount = sales.filter((sale) => Boolean(sale.fiscalXmlUrl || sale.fiscalReference)).length;

  return {
    filters: {
      query: normalizedQuery,
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      fiscalStatus: normalizedStatus,
    },
    summary: {
      totalSales: sales.length,
      authorizedCount,
      withXmlCount,
    },
    sales,
  };
}
