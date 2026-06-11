"use client";

import { RecordStatus } from "@prisma/client";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [pendingToggleUserId, setPendingToggleUserId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0],
    [selectedUserId, users],
  );

  function openPermissionsForUser(userId: string) {
    setSelectedUserId(userId);
    setIsPermissionsDialogOpen(true);
  }

  async function handleToggleStatus(userId: string, status: RecordStatus) {
    if (pendingToggleUserId) {
      return;
    }

    setPendingToggleUserId(userId);
    setToggleError(null);

    try {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("status", status);
      await toggleUserStatusAction(formData);
      window.location.reload();
    } catch {
      setToggleError("Nao foi possivel atualizar o status do usuario. Tente novamente.");
      setPendingToggleUserId(null);
    }
  }

  useEffect(() => {
    if (!isPermissionsDialogOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPermissionsDialogOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPermissionsDialogOpen]);

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
          {toggleError ? (
            <div className="mb-3 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {toggleError}
            </div>
          ) : null}

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
                      {canManageUsers ? (
                        <UserRowActions
                          onAssignPermissions={() => openPermissionsForUser(user.id)}
                          onToggleStatus={() => handleToggleStatus(user.id, nextStatus)}
                          toggleLabel={nextStatus === RecordStatus.ACTIVE ? "Reativar usuario" : "Desativar usuario"}
                          destructiveToggle={nextStatus === RecordStatus.INACTIVE}
                          isToggling={pendingToggleUserId === user.id}
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

      {isPermissionsDialogOpen
        ? createPortal(
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                aria-label="Fechar modal"
                onClick={() => setIsPermissionsDialogOpen(false)}
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="user-permissions-title"
                className="relative z-10 grid w-full max-w-[min(1200px,96vw)] overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
              >
                <header className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
                  <div>
                    <h2 id="user-permissions-title" className="text-base font-black text-foreground">
                      Atribuir permissoes
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedUser
                        ? `Ajuste as permissoes de ${selectedUser.name} com base no perfil e nas excecoes necessarias.`
                        : "Selecione um usuario para editar as permissoes."}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setIsPermissionsDialogOpen(false)}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Fechar</span>
                  </Button>
                </header>
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
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
