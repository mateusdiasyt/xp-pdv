import bcrypt from "bcryptjs";
import { RecordStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import {
  findLoginTenantAccessByEmail,
  findLoginTenantAccessBySlug,
  getActiveTenantBySlug,
  normalizeTenantSlug,
} from "@/application/platform/platform-service";
import {
  ACCESS_PERMISSIONS,
  ACCESS_ROLE_PERMISSION_KEYS,
  ACCESS_ROLES,
} from "@/domain/auth/access-control-presets";
import { getTenantPrismaClientBySlug } from "@/lib/prisma";

const DEFAULT_WORKSPACE_SLUG = process.env.DEFAULT_WORKSPACE_SLUG ?? "xp-arcade";

const credentialsSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha invalida"),
  workspace: z.string().optional(),
});

async function ensureTenantAccessControlPresets(prisma: PrismaClient) {
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

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Senha",
          type: "password",
        },
        workspace: {
          label: "Cliente",
          type: "text",
        },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();
        const requestedWorkspace = parsed.data.workspace ? normalizeTenantSlug(parsed.data.workspace) : null;
        let tenant: Awaited<ReturnType<typeof getActiveTenantBySlug>> | null = null;
        let isPlatformAdmin = false;

        try {
          const access = requestedWorkspace
            ? await findLoginTenantAccessBySlug(requestedWorkspace, email)
            : await findLoginTenantAccessByEmail(email);

          tenant = access?.tenant ?? (requestedWorkspace ? await getActiveTenantBySlug(requestedWorkspace) : null);
          isPlatformAdmin = Boolean(access?.isPlatformAdmin);
        } catch (error) {
          console.warn("[AUTH] Plataforma ainda nao disponivel para resolver tenant. Usando banco padrao.", error);
        }

        const tenantSlug = tenant?.slug ?? requestedWorkspace ?? DEFAULT_WORKSPACE_SLUG;
        const tenantPrisma = await getTenantPrismaClientBySlug(tenantSlug);
        await ensureTenantAccessControlPresets(tenantPrisma);

        const user = await tenantPrisma.user.findUnique({
          where: { email },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
            directPermissions: {
              include: {
                permission: true,
              },
            },
          },
        });

        if (!user || user.status !== RecordStatus.ACTIVE) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);

        if (!isPasswordValid) {
          return null;
        }

        const rolePermissions = user.role.permissions.map((item) => item.permission.key);
        const directPermissions = user.directPermissions.map((item) => item.permission.key);
        const mergedPermissions = Array.from(new Set([...rolePermissions, ...directPermissions]));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roleSlug: user.role.slug,
          permissions: mergedPermissions,
          status: user.status,
          tenantSlug,
          tenantName: tenant?.name ?? "XP Arcade & Bar",
          isPlatformAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.roleSlug = user.roleSlug;
        token.permissions = user.permissions;
        token.status = user.status;
        token.tenantSlug = user.tenantSlug;
        token.tenantName = user.tenantName;
        token.isPlatformAdmin = user.isPlatformAdmin;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roleSlug = token.roleSlug ?? "operador";
        session.user.permissions = token.permissions ?? [];
        session.user.status = token.status ?? "INACTIVE";
        session.user.tenantSlug = token.tenantSlug ?? DEFAULT_WORKSPACE_SLUG;
        session.user.tenantName = token.tenantName ?? "XP Arcade & Bar";
        session.user.isPlatformAdmin = Boolean(token.isPlatformAdmin);
      }

      return session;
    },
  },
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
