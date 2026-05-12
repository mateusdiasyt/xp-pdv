"use client";

import { Printer } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type PrintReceiptButtonProps = {
  children?: ReactNode;
};

export function PrintReceiptButton({ children = "Imprimir ticket" }: PrintReceiptButtonProps) {
  return (
    <Button type="button" className="gap-2" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {children}
    </Button>
  );
}
