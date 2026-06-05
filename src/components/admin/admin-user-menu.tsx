"use client";

import { LogOut, Megaphone, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getWorkspaceSlugFromPathname, toTenantAdminHref } from "@/lib/tenant-routes";

type AdminUserMenuProps = {
  userName?: string | null;
  userEmail?: string | null;
};

export function AdminUserMenu({ userName, userEmail }: AdminUserMenuProps) {
  const [isPendingSignOut, startSignOutTransition] = useTransition();
  const pathname = usePathname();
  const workspaceSlug = getWorkspaceSlugFromPathname(pathname);

  function handleSignOut() {
    startSignOutTransition(async () => {
      await signOut({ callbackUrl: "/login" });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full border-border bg-card/85 px-3 text-sm font-medium text-foreground/90 shadow-sm"
          />
        }
      >
        <span className="max-w-[13rem] truncate">{userName ?? "Usuario"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 min-w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="truncate font-medium text-foreground">{userName ?? "Usuario"}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail ?? "Sem email"}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.location.assign(toTenantAdminHref("/admin/profile", workspaceSlug))}>
          <UserRound className="h-4 w-4" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.location.assign(toTenantAdminHref("/admin/updates", workspaceSlug))}>
          <Megaphone className="h-4 w-4" />
          Atualizacoes
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} variant="destructive" disabled={isPendingSignOut}>
          <LogOut className="h-4 w-4" />
          {isPendingSignOut ? "Saindo..." : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
