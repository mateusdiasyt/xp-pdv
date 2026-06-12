"use client";

import { type FormEvent, useState } from "react";
import { Loader2, PowerOff, RotateCcw } from "lucide-react";

import { updatePlatformSellerStatusAction } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";

type SuperAdminSellerStatusButtonProps = {
  sellerId: string;
  currentStatus: string;
};

export function SuperAdminSellerStatusButton({ sellerId, currentStatus }: SuperAdminSellerStatusButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextStatus = currentStatus === "active" ? "inactive" : "active";
  const isActive = currentStatus === "active";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePlatformSellerStatusAction(new FormData(event.currentTarget));
      window.location.reload();
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="sellerId" value={sellerId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" size="sm" variant="outline" className="gap-2" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <PowerOff className="h-4 w-4" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        {isSubmitting ? "Salvando..." : isActive ? "Desativar" : "Ativar"}
      </Button>
    </form>
  );
}
