"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <Button type="button" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Novo usuario
      </Button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                aria-label="Fechar modal"
                onClick={() => setOpen(false)}
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-user-title"
                className="relative z-10 grid w-full max-w-[min(860px,95vw)] overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
              >
                <header className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
                  <div>
                    <h2 id="create-user-title" className="text-base font-black text-foreground">
                      Novo usuario
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cadastre uma nova conta com perfil e status inicial.
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Fechar</span>
                  </Button>
                </header>
                <div className="max-h-[78vh] overflow-y-auto p-5">
                  <CreateUserForm roles={roles} />
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
