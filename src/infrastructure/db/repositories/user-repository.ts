import { RecordStatus } from "@prisma/client";

import {
  ACCESS_PERMISSIONS,
  ACCESS_ROLE_PERMISSION_KEYS,
  ACCESS_ROLES,
} from "@/domain/auth/access-control-presets";
import { prisma } from "@/lib/prisma";

export async function ensureAccessControlPresets() {
  await prisma.$transaction(async (tx) => {
    for (const permission of ACCESS_PERMISSIONS) {
      await tx.permission.upsert({
        where: { key: permission.key },
        update: { description: permission.description },
        create: permission,
      });
    }

    for (const role of ACCESS_ROLES) {
      const roleRecord = await tx.role.upsert({
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
      const permissionRecords = await tx.permission.findMany({
        where: {
          key: { in: allowedPermissionKeys as string[] },
        },
      });

      await tx.rolePermission.deleteMany({
        where: { roleId: roleRecord.id },
      });

      if (permissionRecords.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionRecords.map((permission) => ({
            roleId: roleRecord.id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });
      }
    }
  });
}

export async function listUsers(search?: string) {
  return prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      role: {
        include: {
          permissions: {
            select: {
              permissionId: true,
            },
          },
        },
      },
      unit: true,
      directPermissions: {
        include: {
          permission: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function listActiveOperators() {
  return prisma.user.findMany({
    where: {
      status: RecordStatus.ACTIVE,
    },
    include: {
      role: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function listRoles() {
  return prisma.role.findMany({
    include: {
      permissions: {
        select: {
          permissionId: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({
    orderBy: {
      key: "asc",
    },
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  status: RecordStatus;
  unitId?: string;
}) {
  return prisma.user.create({
    data,
  });
}

export async function updateUserStatus(data: { userId: string; status: RecordStatus }) {
  return prisma.user.update({
    where: { id: data.userId },
    data: { status: data.status },
  });
}

export async function updateUserAccess(data: {
  userId: string;
  roleId: string;
  permissionIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: data.userId },
      data: {
        roleId: data.roleId,
      },
    });

    await tx.userPermission.deleteMany({
      where: {
        userId: data.userId,
      },
    });

    if (data.permissionIds.length > 0) {
      await tx.userPermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          userId: data.userId,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    return tx.user.findUniqueOrThrow({
      where: { id: data.userId },
      include: {
        role: true,
        directPermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  });
}

export async function countUsers() {
  return prisma.user.count();
}
