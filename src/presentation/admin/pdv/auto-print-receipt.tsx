"use client";

import { useEffect, useRef } from "react";

type AutoPrintReceiptProps = {
  enabled: boolean;
};

export function AutoPrintReceipt({ enabled }: AutoPrintReceiptProps) {
  const didPrintRef = useRef(false);

  useEffect(() => {
    if (!enabled || didPrintRef.current) {
      return;
    }

    didPrintRef.current = true;
    const timeoutId = window.setTimeout(() => {
      window.print();

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("print");
      window.history.replaceState(null, "", nextUrl.toString());
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [enabled]);

  return null;
}
