"use client";

import { RecordStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
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
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const defaultRoleId = roles.find((role) => role.slug === "caixa")?.id ?? roles[0]?.id;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setState(initialActionState);

    try {
      const result = await createUserAction(initialActionState, new FormData(event.currentTarget));
      setState(result);

      if (result.status === "success") {
        window.location.reload();
        return;
      }
    } catch {
      setState({
        status: "error",
        message: "Nao foi possivel criar o usuario. Se o problema persistir, contate o Mateus.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
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
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "Salvando..." : "Criar usuario"}
        </Button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

