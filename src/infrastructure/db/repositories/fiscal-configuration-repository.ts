import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const FISCAL_CONFIGURATION_SCOPE = "GLOBAL";

export function isMissingFiscalConfigurationTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" && String(error.meta?.table ?? "").includes("FiscalConfiguration");
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();
    return normalizedMessage.includes("fiscalconfiguration") && normalizedMessage.includes("does not exist");
  }

  return false;
}

export async function getFiscalConfiguration() {
  return prisma.fiscalConfiguration.findUnique({
    where: {
      scope: FISCAL_CONFIGURATION_SCOPE,
    },
  });
}

export async function upsertFiscalConfiguration(data: {
  environment: string;
  updatedById?: string;
  updatedByName?: string;
}) {
  return prisma.fiscalConfiguration.upsert({
    where: {
      scope: FISCAL_CONFIGURATION_SCOPE,
    },
    create: {
      scope: FISCAL_CONFIGURATION_SCOPE,
      ...data,
    },
    update: data,
  });
}
