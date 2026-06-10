import bcrypt from "bcryptjs";
import { PlatformTenantStatus, PrismaClient, RecordStatus } from "@prisma/client";

import {
  ACCESS_PERMISSIONS,
  ACCESS_ROLE_PERMISSION_KEYS,
  ACCESS_ROLES,
} from "../src/domain/auth/access-control-presets";

const prisma = new PrismaClient();

async function main() {
  const defaultTenantSlug = process.env.DEFAULT_WORKSPACE_SLUG ?? "xp-arcade";
  const defaultTenantName = process.env.DEFAULT_WORKSPACE_NAME ?? "XP Arcade & Bar";
  const defaultAdminEmail = (process.env.DEFAULT_ADMIN_EMAIL ?? "admin@mendozapdv.com.br").toLowerCase();

  const defaultTenant = await prisma.platformTenant.upsert({
    where: { slug: defaultTenantSlug },
    update: {
      name: defaultTenantName,
      status: PlatformTenantStatus.ACTIVE,
      ownerName: "Administrador Sistema",
      ownerEmail: defaultAdminEmail.toLowerCase(),
      isDefault: true,
      approvedAt: new Date(),
    },
    create: {
      slug: defaultTenantSlug,
      name: defaultTenantName,
      status: PlatformTenantStatus.ACTIVE,
      ownerName: "Administrador Sistema",
      ownerEmail: defaultAdminEmail.toLowerCase(),
      isDefault: true,
      approvedAt: new Date(),
    },
  });

  await prisma.platformTenant.updateMany({
    where: {
      id: { not: defaultTenant.id },
      isDefault: true,
    },
    data: {
      isDefault: false,
    },
  });

  const defaultUnit = await prisma.businessUnit.upsert({
    where: { code: "HQ" },
    update: {},
    create: {
      code: "HQ",
      name: "Unidade Principal",
    },
  });

  for (const permission of ACCESS_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const role of ACCESS_ROLES) {
    const roleRecord = await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
      create: {
        ...role,
        isSystem: true,
      },
    });

    const allowedPermissionKeys = ACCESS_ROLE_PERMISSION_KEYS[role.slug];
    const permissionRecords = await prisma.permission.findMany({
      where: {
        key: { in: allowedPermissionKeys as string[] },
      },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: roleRecord.id },
    });

    await prisma.rolePermission.createMany({
      data: permissionRecords.map((permission) => ({
        roleId: roleRecord.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { slug: "administrador" },
  });

  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin123!";
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: defaultAdminEmail },
    update: {
      name: "Administrador Sistema",
      passwordHash: hashedPassword,
      roleId: adminRole.id,
      status: RecordStatus.ACTIVE,
      unitId: defaultUnit.id,
    },
    create: {
      name: "Administrador Sistema",
      email: defaultAdminEmail,
      passwordHash: hashedPassword,
      roleId: adminRole.id,
      status: RecordStatus.ACTIVE,
      unitId: defaultUnit.id,
    },
  });

  await prisma.cashRegister.upsert({
    where: { code: "CAIXA-01" },
    update: {
      name: "Caixa Principal",
      status: RecordStatus.ACTIVE,
      unitId: defaultUnit.id,
    },
    create: {
      code: "CAIXA-01",
      name: "Caixa Principal",
      status: RecordStatus.ACTIVE,
      unitId: defaultUnit.id,
    },
  });

  await prisma.platformTenantUser.upsert({
    where: {
      tenantId_email: {
        tenantId: defaultTenant.id,
        email: defaultAdminEmail.toLowerCase(),
      },
    },
    update: {
      name: "Administrador Sistema",
      role: "owner",
      isOwner: true,
      isPlatformAdmin: true,
    },
    create: {
      tenantId: defaultTenant.id,
      email: defaultAdminEmail.toLowerCase(),
      name: "Administrador Sistema",
      role: "owner",
      isOwner: true,
      isPlatformAdmin: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failure", error);
    await prisma.$disconnect();
    process.exit(1);
  });
