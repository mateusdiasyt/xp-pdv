"use client";

import { Loader2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTransition } from "react";

type PendingTenantHeaderProps = {
  userName?: string | null;
  userEmail?: string | null;
};

export function PendingTenantHeader({ userName, userEmail }: PendingTenantHeaderProps) {
  const [isPendingSignOut, startSignOutTransition] = useTransition();

  function handleSignOut() {
    startSignOutTransition(async () => {
      await signOut({ callbackUrl: "/login" });
    });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/72 px-4 py-3 backdrop-blur-2xl md:px-6 xl:px-8">
      <div className="mx-auto flex h-11 w-full max-w-[1600px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/42 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-[0_8px_24px_-22px_rgba(0,0,0,0.8)]">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Mendoza PDV
          </div>
          <div className="hidden min-w-0 text-sm sm:block">
            <p className="truncate font-semibold text-foreground">{userName ?? "Conta pendente"}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail ?? "Aguardando pagamento"}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPendingSignOut}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card/85 px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/45 hover:bg-primary/10 disabled:cursor-wait disabled:opacity-70"
        >
          {isPendingSignOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {isPendingSignOut ? "Saindo..." : "Trocar conta"}
        </button>
      </div>
    </header>
  );
}
