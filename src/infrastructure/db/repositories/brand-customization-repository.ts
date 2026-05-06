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

export async function ensureBrandCustomizationTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BrandCustomization" (
      "id" TEXT NOT NULL,
      "primaryColor" TEXT NOT NULL DEFAULT '#d4a62a',
      "accentColor" TEXT NOT NULL DEFAULT '#b9882a',
      "backgroundColor" TEXT NOT NULL DEFAULT '#0a0a0a',
      "foregroundColor" TEXT NOT NULL DEFAULT '#f4efe4',
      "logoDataUrl" TEXT,
      "faviconDataUrl" TEXT,
      "updatedById" TEXT,
      "updatedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "BrandCustomization_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'BrandCustomization_updatedById_fkey'
      ) THEN
        ALTER TABLE "BrandCustomization"
        ADD CONSTRAINT "BrandCustomization_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BrandCustomization_updatedAt_idx"
    ON "BrandCustomization"("updatedAt");
  `);
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
