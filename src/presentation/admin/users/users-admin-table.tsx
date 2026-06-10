"use client";

import { RecordStatus } from "@prisma/client";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleUserStatusAction } from "@/presentation/admin/users/actions";
import { CreateUserDialog } from "@/presentation/admin/users/create-user-dialog";
import { UpdateUserAccessForm } from "@/presentation/admin/users/update-user-access-form";
import { UserRowActions } from "@/presentation/admin/users/user-row-actions";

type UserListItem = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  rolePermissionIds: string[];
  directPermissionIds: string[];
  status: RecordStatus;
};

type RoleOption = {
  id: string;
  name: string;
  slug: string;
  permissionIds: string[];
};

type PermissionOption = {
  id: string;
  key: string;
  description: string | null;
};

type UsersAdminTableProps = {
  users: UserListItem[];
  roles: RoleOption[];
  permissions: PermissionOption[];
  canManageUsers: boolean;
  search?: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getTotalPermissions(user: UserListItem) {
  const permissionIds = new Set<string>();
  for (const permissionId of user.rolePermissionIds) {
    permissionIds.add(permissionId);
  }
  for (const permissionId of user.directPermissionIds) {
    permissionIds.add(permissionId);
  }
  return permissionIds.size;
}

export function UsersAdminTable({
  users,
  roles,
  permissions,
  canManageUsers,
  search,
}: UsersAdminTableProps) {
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0],
    [selectedUserId, users],
  );

  function openPermissionsForUser(userId: string) {
    setSelectedUserId(userId);
    setIsPermissionsDialogOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-3 border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Lista de usuarios</CardTitle>
              <CardDescription>{users.length} registro(s) encontrado(s).</CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form method="GET" className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={search ?? ""}
                  placeholder="Buscar usuario"
                  className="h-8 w-[260px] pl-9"
                />
              </form>
              {canManageUsers ? (
                <CreateUserDialog roles={roles.map((role) => ({ id: role.id, name: role.name, slug: role.slug }))} />
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-center">Total permissoes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum usuario encontrado.
                  </TableCell>
                </TableRow>
              ) : null}

              {users.map((user, index) => {
                const nextStatus = user.status === RecordStatus.ACTIVE ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
                const totalPermissions = getTotalPermissions(user);
                const toggleFormId = `toggle-user-status-${user.id}`;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.roleName}</TableCell>
                    <TableCell className="text-center font-medium">{totalPermissions}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.status === RecordStatus.ACTIVE
                            ? "border border-emerald-500/25 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15"
                            : "border border-zinc-500/25 bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/15"
                        }
                      >
                        {user.status === RecordStatus.ACTIVE ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <form id={toggleFormId} action={toggleUserStatusAction} className="hidden">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="status" value={nextStatus} />
                      </form>
                      {canManageUsers ? (
                        <UserRowActions
                          onAssignPermissions={() => openPermissionsForUser(user.id)}
                          toggleFormId={toggleFormId}
                          toggleLabel={nextStatus === RecordStatus.ACTIVE ? "Reativar usuario" : "Desativar usuario"}
                          destructiveToggle={nextStatus === RecordStatus.INACTIVE}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem permissao</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            Mostrando {users.length === 0 ? 0 : 1}-{users.length} de {users.length} registro(s)
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-[min(1200px,96vw)] gap-0 border-border/80 bg-card p-0 sm:max-w-[min(1200px,96vw)]">
          <DialogHeader className="border-b border-border/70 px-5 py-4 pr-14">
            <DialogTitle>Atribuir permissoes</DialogTitle>
            <DialogDescription>
              {selectedUser
                ? `Ajuste as permissoes de ${selectedUser.name} com base no perfil e nas excecoes necessarias.`
                : "Selecione um usuario para editar as permissoes."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto p-5">
            {selectedUser ? (
              <UpdateUserAccessForm
                users={[
                  {
                    id: selectedUser.id,
                    name: selectedUser.name,
                    email: selectedUser.email,
                    roleId: selectedUser.roleId,
                    directPermissionIds: selectedUser.directPermissionIds,
                  },
                ]}
                roles={roles}
                permissions={permissions}
                initialUserId={selectedUser.id}
                lockUser
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
