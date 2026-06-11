"use client";

import { usePathname } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { BrandLogo } from "@/components/admin/brand-logo";
import { adminNavigation } from "@/components/admin/navigation";
import { canUsePlatformModule, type TenantModuleEntitlements } from "@/domain/platform/plan-entitlements";
import { getWorkspaceSlugFromPathname, toTenantAdminHref } from "@/lib/tenant-routes";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  roleSlug: string;
  permissions: string[];
  entitlements: TenantModuleEntitlements;
};

export function AdminSidebar({ roleSlug, permissions, entitlements }: AdminSidebarProps) {
  const pathname = usePathname();
  const workspaceSlug = getWorkspaceSlugFromPathname(pathname);

  const isAdmin = roleSlug === "administrador";
  const items = adminNavigation.filter((item) => isAdmin || permissions.includes(item.permission));
  const groupedItems = ["Operacao", "Financeiro", "Cadastros", "Sistema"].map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }));

  return (
    <aside className="group/sidebar sticky top-0 z-[80] flex h-screen w-[4.75rem] shrink-0 flex-col overflow-hidden border-r border-sidebar-border/35 bg-sidebar/48 text-sidebar-foreground shadow-[18px_0_70px_-62px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-[width,background-color,border-color] duration-300 ease-out hover:w-64 hover:border-sidebar-border/55 hover:bg-sidebar/58 supports-[backdrop-filter]:bg-sidebar/38">
      <div className="flex h-20 shrink-0 items-center px-4">
        <BrandLogo
          priority
          className="h-11 w-11 shrink-0 overflow-hidden transition-[width] duration-300 ease-out group-hover/sidebar:w-40"
        />
      </div>

      <nav className="admin-scrollbar flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 pb-5">
        {groupedItems.map(({ group, items: groupItems }) => {
          if (groupItems.length === 0) {
            return null;
          }

          return (
            <div key={group} className="space-y-2">
              <p className="h-0 overflow-hidden px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/38 opacity-0 transition-all duration-200 group-hover/sidebar:h-5 group-hover/sidebar:opacity-100">
                {group}
              </p>

              <div className="space-y-1.5">
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const itemHref = toTenantAdminHref(item.href, workspaceSlug);
                  const isLocked = item.requiredModule
                    ? !canUsePlatformModule(entitlements, item.requiredModule)
                    : false;
                  const isActive =
                    itemHref.endsWith("/admin")
                      ? pathname === itemHref || pathname === "/admin"
                      : pathname?.startsWith(itemHref.replace("#novo-registro", "")) ||
                        pathname?.startsWith(item.href.replace("#novo-registro", ""));

                  return (
                    <a
                      key={item.href}
                      href={itemHref}
                      aria-label={item.label}
                      aria-disabled={isLocked}
                      title={isLocked ? `${item.label} - disponivel no Plano Platina ativo` : item.label}
                      onClick={
                        isLocked
                          ? (event) => {
                              event.preventDefault();
                            }
                          : undefined
                      }
                      className={cn(
                        "flex h-11 w-full items-center justify-center gap-3 rounded-xl text-sm font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar group-hover/sidebar:justify-start group-hover/sidebar:px-3",
                        isLocked
                          ? "cursor-not-allowed border border-transparent text-sidebar-foreground/34 hover:border-sidebar-border/25 hover:bg-sidebar-accent/18"
                          : isActive
                          ? "border border-sidebar-primary/30 bg-sidebar-primary/14 text-sidebar-foreground shadow-[0_12px_28px_-22px_color-mix(in_oklab,var(--sidebar-primary)_82%,transparent)]"
                          : "border border-transparent text-sidebar-foreground/64 hover:border-sidebar-border/45 hover:bg-sidebar-accent/44 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          isLocked
                            ? "text-sidebar-foreground/34"
                            : isActive
                              ? "text-sidebar-primary"
                              : "text-sidebar-foreground/64",
                        )}
                      />
                      <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:w-auto group-hover/sidebar:opacity-100">
                        {item.label}
                      </span>
                      {isLocked ? (
                        <LockKeyhole className="ml-auto hidden size-3.5 shrink-0 text-sidebar-foreground/42 group-hover/sidebar:block" />
                      ) : null}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
