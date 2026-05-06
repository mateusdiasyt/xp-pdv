import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export function isMissingBrandCustomizationTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" && String(error.meta?.table ?? "").includes("BrandCustomization");
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();
    return normalizedMessage.includes("brandcustomization") && normalizedMessage.includes("does not exist");
  }

  return false;
}

export async function getLatestBrandCustomization() {
  return prisma.brandCustomization.findFirst({
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function upsertBrandCustomization(data: {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  logoDataUrl?: string | null;
  faviconDataUrl?: string | null;
  updatedById?: string;
  updatedByName?: string;
}) {
  const current = await prisma.brandCustomization.findFirst({
    select: {
      id: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (current) {
    return prisma.brandCustomization.update({
      where: {
        id: current.id,
      },
      data,
    });
  }

  return prisma.brandCustomization.create({
    data,
  });
}
