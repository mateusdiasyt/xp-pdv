"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateUserForm } from "@/presentation/admin/users/create-user-form";

type RoleOption = {
  id: string;
  name: string;
  slug: string;
};

type CreateUserDialogProps = {
  roles: RoleOption[];
};

export function CreateUserDialog({ roles }: CreateUserDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm" className="gap-2" />}>
        <Plus className="h-4 w-4" />
        Novo usuario
      </DialogTrigger>
      <DialogContent className="max-w-[min(860px,95vw)] gap-0 border-border/80 bg-card p-0 sm:max-w-[min(860px,95vw)]">
        <DialogHeader className="border-b border-border/70 px-5 py-4 pr-14">
          <DialogTitle>Novo usuario</DialogTitle>
          <DialogDescription>Cadastre uma nova conta com perfil e status inicial.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[78vh] overflow-y-auto p-5">
          <CreateUserForm roles={roles} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
