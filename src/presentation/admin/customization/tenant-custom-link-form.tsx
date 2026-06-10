"use client";

import { CheckCircle2, Loader2, Link2 } from "lucide-react";
import { signOut } from "next-auth/react";
import type { FormEvent } from "react";
import { useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import {
  checkTenantCustomLinkAction,
  updateTenantCustomLinkAction,
} from "@/presentation/admin/customization/actions";

type TenantCustomLinkFormProps = {
  currentSlug: string;
};

type TenantLinkActionData = {
  slug?: string;
  available?: boolean;
  changed?: boolean;
};

function readActionData(state: ActionState) {
  return (state.data ?? {}) as TenantLinkActionData;
}

export function TenantCustomLinkForm({ currentSlug }: TenantCustomLinkFormProps) {
  const [slug, setSlug] = useState(currentSlug);
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isChecking, setIsChecking] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const actionData = readActionData(state);
  const checkedSlug = actionData.slug;
  const isAvailable = state.status === "success" && actionData.available === true && checkedSlug === slug.trim();
  const previewSlug = slug.trim() || currentSlug;

  async function handleCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsChecking(true);
    setState(initialActionState);

    const result = await checkTenantCustomLinkAction(new FormData(event.currentTarget));
    setState(result);

    const nextSlug = readActionData(result).slug;
    if (nextSlug) {
      setSlug(nextSlug);
    }

    setIsChecking(false);
  }

  async function handleApply() {
    setIsApplying(true);
    setState(initialActionState);

    const formData = new FormData();
    formData.set("slug", slug);

    const result = await updateTenantCustomLinkAction(formData);
    setState(result);

    if (result.status === "success") {
      const nextSlug = readActionData(result).slug ?? slug;

      if (nextSlug !== currentSlug) {
        await signOut({
          callbackUrl: `/login?workspace=${encodeURIComponent(nextSlug)}&link=updated`,
        });
        return;
      }
    }

    setIsApplying(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">Definir link personalizado</h3>
            <p className="text-xs text-muted-foreground">O link precisa ser unico para cada cliente.</p>
          </div>
        </div>

        <form onSubmit={handleCheck} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="tenantSlug">Link do cliente</Label>
            <Input
              id="tenantSlug"
              name="slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="meu-bar"
              autoComplete="off"
            />
          </div>

          <Button type="submit" variant="outline" disabled={isChecking || isApplying}>
            {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verificar
          </Button>

          <Button type="button" disabled={!isAvailable || isApplying} onClick={handleApply}>
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aplicar link
          </Button>
        </form>

        <div className="mt-4 rounded-2xl border border-border/65 bg-background/45 px-3 py-2 font-mono text-xs text-muted-foreground">
          /app/{previewSlug}/admin
        </div>
      </div>

      <ActionFeedback state={state} />
    </div>
  );
}
