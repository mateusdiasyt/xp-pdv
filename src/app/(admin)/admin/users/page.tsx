import { requirePermission } from "@/application/auth/guards";
import {
  ensureUserAccessControlPresets,
  getPermissions,
  getRoles,
  getUsers,
} from "@/application/users/user-service";
import { PageHeader } from "@/components/admin/page-header";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { UsersAdminTable } from "@/presentation/admin/users/users-admin-table";

type UsersPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await requirePermission(PERMISSIONS.USERS_VIEW);
  const { q } = await searchParams;
  const search = q?.trim() || undefined;

  await ensureUserAccessControlPresets();
  const [users, roles, permissions] = await Promise.all([getUsers(search), getRoles(), getPermissions()]);
  const canManageUsers = hasPermission(session.user.permissions, PERMISSIONS.USERS_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ERP"
        title="Usuarios"
        description="Cadastre contas e defina perfis como Administrador, Financeiro ou Caixa."
      />

      <UsersAdminTable
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          roleName: user.role.name,
          rolePermissionIds: user.role.permissions.map((item) => item.permissionId),
          directPermissionIds: user.directPermissions.map((item) => item.permissionId),
          status: user.status,
        }))}
        roles={roles.map((role) => ({
          id: role.id,
          name: role.name,
          slug: role.slug,
          permissionIds: role.permissions.map((item) => item.permissionId),
        }))}
        permissions={permissions.map((permission) => ({
          id: permission.id,
          key: permission.key,
          description: permission.description,
        }))}
        canManageUsers={canManageUsers}
        search={search}
      />
    </div>
  );
}
