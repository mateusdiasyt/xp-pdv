"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SuperAdminSignOutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="gap-2"
      onClick={() => void signOut({ callbackUrl: "/super-admin/login" })}
    >
      <LogOut className="h-4 w-4" />
      Sair
    </Button>
  );
}
