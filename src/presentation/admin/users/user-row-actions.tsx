"use client";

import { Loader2, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";

import { Button } from "@/components/ui/button";

type UserRowActionsProps = {
  onAssignPermissions: () => void;
  onToggleStatus: () => void;
  toggleLabel: string;
  destructiveToggle?: boolean;
  isToggling?: boolean;
};

export function UserRowActions({
  onAssignPermissions,
  onToggleStatus,
  toggleLabel,
  destructiveToggle = false,
  isToggling = false,
}: UserRowActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onAssignPermissions}>
        <ShieldCheck className="h-4 w-4" />
        Acesso
      </Button>
      <Button
        type="button"
        variant={destructiveToggle ? "destructive" : "outline"}
        size="sm"
        className="gap-2"
        onClick={onToggleStatus}
        disabled={isToggling}
      >
        {isToggling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : destructiveToggle ? (
          <UserRoundX className="h-4 w-4" />
        ) : (
          <UserRoundCheck className="h-4 w-4" />
        )}
        {isToggling ? "Salvando..." : toggleLabel}
      </Button>
    </div>
  );
}
