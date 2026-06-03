"use client";

import { RotateCcw } from "lucide-react";
import { type FormEvent, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import { retryGameplayReleaseAction } from "@/presentation/admin/gameplay/actions";

type RetryGameplayReleaseFormProps = {
  saleId: string | null;
  disabled?: boolean;
};

export function RetryGameplayReleaseForm({ saleId, disabled }: RetryGameplayReleaseFormProps) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setIsPending(true);
    setState(initialActionState);

    try {
      const result = await retryGameplayReleaseAction(initialActionState, formData);
      setState(result);

      if (result.status === "success") {
        window.setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel reenviar a liberacao.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="saleId" value={saleId ?? ""} />
      <Button type="submit" size="sm" variant="outline" className="gap-2" disabled={disabled || isPending}>
        <RotateCcw className="h-4 w-4" />
        Reenviar liberacao
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}
