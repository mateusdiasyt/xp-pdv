"use client";

import { RecordStatus } from "@prisma/client";
import { useActionState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { createUserAction } from "@/presentation/admin/users/actions";

type RoleOption = {
  id: string;
  name: string;
  slug: string;
};

type CreateUserFormProps = {
  roles: RoleOption[];
};

export function CreateUserForm({ roles }: CreateUserFormProps) {
  const [state, formAction] = useActionState(createUserAction, initialActionState);
  const defaultRoleId = roles.find((role) => role.slug === "caixa")?.id ?? roles[0]?.id;

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" placeholder="Nome completo" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="usuario@empresa.com" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha inicial</Label>
        <Input id="password" name="password" type="password" placeholder="Minimo 8 caracteres" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="roleId">Perfil</Label>
        <select
          id="roleId"
          name="roleId"
          className="admin-native-select"
          defaultValue={defaultRoleId}
          required
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          className="admin-native-select"
          defaultValue={RecordStatus.ACTIVE}
          required
        >
          <option value={RecordStatus.ACTIVE}>Ativo</option>
          <option value={RecordStatus.INACTIVE}>Inativo</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <FormSubmitButton>Criar usuario</FormSubmitButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

