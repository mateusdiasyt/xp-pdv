import bcrypt from "bcryptjs";

import { createUserSchema, updateUserAccessSchema, updateUserStatusSchema } from "@/domain/users/schemas";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  createUser,
  findOperatorRole,
  listActiveOperators,
  listPermissions,
  listRoles,
  listUsers,
  updateUserAccess,
  updateUserStatus,
} from "@/infrastructure/db/repositories/user-repository";

export async function getUsers(search?: string) {
  return listUsers(search);
}

export async function getOperators() {
  return listActiveOperators();
}

export async function getRoles() {
  return listRoles();
}

export async function getPermissions() {
  return listPermissions();
}

export async function createUserRecord(input: FormData, actorId?: string) {
  const parsed = createUserSchema.parse({
    name: input.get("name"),
    email: input.get("email"),
    password: input.get("password"),
    roleId: input.get("roleId"),
    status: input.get("status"),
  });

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const created = await createUser({
    name: parsed.name.trim(),
    email: parsed.email.toLowerCase(),
    passwordHash,
    roleId: parsed.roleId,
    status: parsed.status,
  });

  await createAuditLog({
    userId: actorId,
    action: "users.create",
    entity: "User",
    entityId: created.id,
    metadata: {
      email: created.email,
      roleId: created.roleId,
    },
  });
}

export async function createOperatorRecord(input: FormData, actorId?: string) {
  const operatorRole = await findOperatorRole();
  if (!operatorRole) {
    throw new Error("Perfil de operador nao encontrado.");
  }

  const parsed = createUserSchema.parse({
    name: input.get("name"),
    email: input.get("email"),
    password: input.get("password"),
    roleId: operatorRole.id,
    status: "ACTIVE",
  });

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const created = await createUser({
    name: parsed.name.trim(),
    email: parsed.email.toLowerCase(),
    passwordHash,
    roleId: operatorRole.id,
    status: parsed.status,
  });

  await createAuditLog({
    userId: actorId,
    action: "operators.create",
    entity: "User",
    entityId: created.id,
    metadata: {
      email: created.email,
      roleId: created.roleId,
    },
  });

  return {
    id: created.id,
    name: created.name,
    email: created.email,
    roleName: operatorRole.name,
    status: created.status,
  };
}

export async function updateUserStatusRecord(input: FormData, actorId?: string) {
  const parsed = updateUserStatusSchema.parse({
    userId: input.get("userId"),
    status: input.get("status"),
  });

  const updated = await updateUserStatus(parsed);

  await createAuditLog({
    userId: actorId,
    action: "users.status.update",
    entity: "User",
    entityId: updated.id,
    metadata: {
      status: updated.status,
    },
  });
}

export async function updateUserAccessRecord(input: FormData, actorId?: string) {
  const parsed = updateUserAccessSchema.parse({
    userId: input.get("userId"),
    roleId: input.get("roleId"),
    permissionIds: input.getAll("permissionIds").map((value) => String(value)),
  });

  const updated = await updateUserAccess({
    userId: parsed.userId,
    roleId: parsed.roleId,
    permissionIds: parsed.permissionIds,
  });

  await createAuditLog({
    userId: actorId,
    action: "users.access.update",
    entity: "User",
    entityId: updated.id,
    metadata: {
      roleId: updated.roleId,
      permissionCount: updated.directPermissions.length,
    },
  });
}
