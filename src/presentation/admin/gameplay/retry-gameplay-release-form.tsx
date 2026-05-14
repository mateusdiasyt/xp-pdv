"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { retryGameplayReleaseAction } from "@/presentation/admin/gameplay/actions";

type RetryGameplayReleaseFormProps = {
  saleId: string | null;
  disabled?: boolean;
};

export function RetryGameplayReleaseForm({ saleId, disabled }: RetryGameplayReleaseFormProps) {
  const [state, formAction] = useActionState(retryGameplayReleaseAction, initialActionState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="saleId" value={saleId ?? ""} />
      <Button type="submit" size="sm" variant="outline" className="gap-2" disabled={disabled}>
        <RotateCcw className="h-4 w-4" />
        Reenviar liberacao
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}
