"use client";

import { Play, Square } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { endServiceSessionAction, manualServiceReleaseAction } from "@/presentation/admin/gameplay/actions";

type ManualServiceControlFormProps = {
  stationId: string;
  isBusy: boolean;
};

const durationOptions = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1h" },
  { value: "FREE", label: "Livre" },
];

export function ManualServiceControlForm({ stationId, isBusy }: ManualServiceControlFormProps) {
  const router = useRouter();
  const [releaseState, releaseAction] = useActionState(manualServiceReleaseAction, initialActionState);
  const [endState, endAction] = useActionState(endServiceSessionAction, initialActionState);

  useEffect(() => {
    if (releaseState.status === "success" || endState.status === "success") {
      router.refresh();
    }
  }, [endState.status, releaseState.status, router]);

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <form action={releaseAction} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input type="hidden" name="stationId" value={stationId} />
        <select
          name="durationPreset"
          className="admin-native-select h-9"
          defaultValue="30"
          disabled={isBusy}
          aria-label="Tempo para liberacao manual"
        >
          {durationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="gap-2" disabled={isBusy}>
          <Play className="h-4 w-4" />
          Liberar
        </Button>
      </form>
      <ActionFeedback state={releaseState} />

      {isBusy ? (
        <form action={endAction} className="space-y-2">
          <input type="hidden" name="stationId" value={stationId} />
          <Button type="submit" size="sm" variant="destructive" className="gap-2">
            <Square className="h-4 w-4" />
            Encerrar tempo
          </Button>
          <ActionFeedback state={endState} />
        </form>
      ) : null}
    </div>
  );
}
