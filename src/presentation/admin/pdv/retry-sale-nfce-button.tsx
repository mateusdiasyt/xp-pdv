"use client";

import { useState } from "react";

import { retrySaleNfceRequest } from "@/presentation/admin/pdv/actions";

type RetrySaleNfceButtonProps = {
  saleId: string;
};

export function RetrySaleNfceButton({ saleId }: RetrySaleNfceButtonProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleRetry() {
    const formData = new FormData();
    formData.set("saleId", saleId);
    setIsPending(true);

    try {
      await retrySaleNfceRequest(formData);
      window.setTimeout(() => {
        window.location.reload();
      }, 100);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={isPending}
      className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Reemitindo..." : "Reemitir NFC-e"}
    </button>
  );
}
