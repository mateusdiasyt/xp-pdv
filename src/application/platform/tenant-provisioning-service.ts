import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import { seedTenantDatabase } from "@/application/platform/tenant-bootstrap";
import { encryptSecretValue } from "@/lib/secret-crypto";
import { getPlatformPrisma } from "@/lib/prisma";

function normalizeDatabaseName(slug: string) {
  const suffix = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42);

  return `xp_pdv_${suffix || "cliente"}`;
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z0-9_]+$/.test(identifier)) {
    throw new Error("Nome tecnico do banco invalido.");
  }

  return `"${identifier}"`;
}

function buildDatabaseUrl(databaseName: string) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao configurado.");
  }

  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function splitSqlStatements(sql: string) {
  return sql
    .replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function applyTenantSchema(databaseUrl: string) {
  const schemaPath = fileURLToPath(new URL("../../infrastructure/platform/tenant-schema.sql", import.meta.url));
  const schemaSql = await readFile(schemaPath, "utf8");
  const statements = splitSqlStatements(schemaSql);
  const tenantPrisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    for (const statement of statements) {
      await tenantPrisma.$executeRawUnsafe(statement);
    }
  } finally {
    await tenantPrisma.$disconnect();
  }
}

async function ensureTenantDatabase(databaseName: string) {
  const platformPrisma = getPlatformPrisma();
  const existing = await platformPrisma.$queryRaw<Array<{ datname: string }>>`
    SELECT datname FROM pg_database WHERE datname = ${databaseName}
  `;

  if (existing.length > 0) {
    return;
  }

  await platformPrisma.$executeRawUnsafe(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
}

export async function provisionTenantDatabase(data: {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPasswordHash: string;
}) {
  const databaseName = normalizeDatabaseName(data.tenantSlug);
  const databaseUrl = buildDatabaseUrl(databaseName);

  await ensureTenantDatabase(databaseName);

  await applyTenantSchema(databaseUrl);

  const tenantPrisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    await seedTenantDatabase(tenantPrisma, {
      tenantName: data.tenantName,
      tenantSlug: data.tenantSlug,
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail,
      ownerPasswordHash: data.ownerPasswordHash,
    });
  } finally {
    await tenantPrisma.$disconnect();
  }

  return {
    databaseName,
    databaseUrlEncrypted: encryptSecretValue(databaseUrl),
  };
}
