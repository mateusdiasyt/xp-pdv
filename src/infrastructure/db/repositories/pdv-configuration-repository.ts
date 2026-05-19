import { prisma } from "@/lib/prisma";

const PDV_CONFIGURATION_SCOPE = "GLOBAL";

export async function getPdvConfiguration() {
  const configuration = await prisma.pdvConfiguration.findUnique({
    where: {
      scope: PDV_CONFIGURATION_SCOPE,
    },
  });

  return {
    happyHourActive: configuration?.happyHourActive ?? false,
    happyHourUpdatedAt: configuration?.happyHourUpdatedAt ?? null,
  };
}

export async function updatePdvHappyHourState(data: {
  active: boolean;
  updatedById?: string;
  updatedByName?: string;
}) {
  return prisma.pdvConfiguration.upsert({
    where: {
      scope: PDV_CONFIGURATION_SCOPE,
    },
    create: {
      scope: PDV_CONFIGURATION_SCOPE,
      happyHourActive: data.active,
      happyHourUpdatedAt: new Date(),
      updatedById: data.updatedById,
      updatedByName: data.updatedByName,
    },
    update: {
      happyHourActive: data.active,
      happyHourUpdatedAt: new Date(),
      updatedById: data.updatedById,
      updatedByName: data.updatedByName,
    },
  });
}
