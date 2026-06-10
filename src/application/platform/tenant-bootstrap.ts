import bcrypt from "bcryptjs";
import { PrismaClient, RecordStatus } from "@prisma/client";

import {
  ACCESS_PERMISSIONS,
  ACCESS_ROLE_PERMISSION_KEYS,
  ACCESS_ROLES,
} from "@/domain/auth/access-control-presets";

export async function seedTenantDatabase(
  prisma: PrismaClient,
  data: {
    tenantName: string;
    tenantSlug: string;
    ownerName: string;
    ownerEmail: string;
    ownerPasswordHash?: string | null;
    ownerPassword?: string | null;
  },
) {
  const defaultUnit = await prisma.businessUnit.upsert({
    where: { code: "HQ" },
    update: {
      name: "Unidade Principal",
    },
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

  const passwordHash =
    data.ownerPasswordHash ??
    (await bcrypt.hash(data.ownerPassword ?? process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin123!", 12));

  await prisma.user.upsert({
    where: { email: data.ownerEmail.toLowerCase() },
    update: {
      name: data.ownerName,
      passwordHash,
      roleId: adminRole.id,
      status: RecordStatus.ACTIVE,
      unitId: defaultUnit.id,
    },
    create: {
      name: data.ownerName,
      email: data.ownerEmail.toLowerCase(),
      passwordHash,
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

  await prisma.platformTenant.upsert({
    where: { slug: data.tenantSlug },
    update: {
      name: data.tenantName,
      status: "ACTIVE",
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail.toLowerCase(),
      isDefault: true,
      approvedAt: new Date(),
    },
    create: {
      slug: data.tenantSlug,
      name: data.tenantName,
      status: "ACTIVE",
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail.toLowerCase(),
      isDefault: true,
      approvedAt: new Date(),
    },
  });
}
