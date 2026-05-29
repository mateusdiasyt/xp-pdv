"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import type { ActionState } from "@/presentation/admin/common/action-state";

type ActionFeedbackProps = {
  state: ActionState;
};

export function ActionFeedback({ state }: ActionFeedbackProps) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "success") {
    return (
      <p
        role="status"
        className="mt-3 flex w-fit max-w-full items-center gap-2.5 rounded-2xl border border-primary/35 bg-background/95 px-3.5 py-2.5 text-sm text-foreground shadow-[0_10px_28px_-20px_hsl(var(--primary)/0.95)]"
      >
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/15 text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
        <span className="leading-relaxed text-foreground/95">{state.message}</span>
      </p>
    );
  }

  return (
    <p
      role="alert"
      className="mt-3 flex w-fit max-w-full items-center gap-2.5 rounded-2xl border border-rose-500/35 bg-background/95 px-3.5 py-2.5 text-sm text-rose-200 shadow-[0_10px_28px_-20px_rgba(244,63,94,0.8)]"
    >
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rose-500/35 bg-rose-500/15 text-rose-300">
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
      <span className="leading-relaxed">{state.message}</span>
    </p>
  );
}
