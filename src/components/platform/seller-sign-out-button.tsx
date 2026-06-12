"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";

import { sellerSignOutAction } from "@/app/seller/actions";
import { Button } from "@/components/ui/button";

export function SellerSignOutButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await sellerSignOutAction();
    window.location.href = "/seller/login";
  }

  return (
    <Button type="button" variant="outline" className="gap-2" onClick={handleClick} disabled={isSubmitting}>
      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Sair
    </Button>
  );
}
