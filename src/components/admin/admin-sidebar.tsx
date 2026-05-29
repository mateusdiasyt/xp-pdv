"use client";

import { usePathname } from "next/navigation";

import { BrandLogo } from "@/components/admin/brand-logo";
import { adminNavigation } from "@/components/admin/navigation";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  roleSlug: string;
  permissions: string[];
};

export function AdminSidebar({ roleSlug, permissions }: AdminSidebarProps) {
  const pathname = usePathname();

  const isAdmin = roleSlug === "administrador";
  const items = adminNavigation.filter((item) => isAdmin || permissions.includes(item.permission));

  return (
    <aside className="sticky top-0 z-[80] flex h-screen w-[5.25rem] shrink-0 flex-col overflow-visible border-r border-sidebar-border/45 bg-sidebar/58 text-sidebar-foreground shadow-[22px_0_70px_-48px_rgba(0,0,0,0.9)] backdrop-blur-2xl supports-[backdrop-filter]:bg-sidebar/46">
      <div className="flex h-[5.25rem] items-center justify-center border-b border-sidebar-border/35 px-3">
        <BrandLogo priority className="max-h-11 w-11" />
      </div>

      <nav className="flex-1 space-y-2 overflow-visible px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(item.href.replace("#novo-registro", ""));

          return (
            <a
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={cn(
                "group relative flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_16px_28px_-16px_color-mix(in_oklab,var(--sidebar-primary)_78%,transparent)]"
                  : "border border-sidebar-border/35 bg-sidebar-accent/28 text-sidebar-foreground/72 hover:border-sidebar-border/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-[120] -translate-y-1/2 whitespace-nowrap rounded-xl border border-sidebar-border/50 bg-sidebar/92 px-3 py-2 text-xs font-semibold text-sidebar-foreground opacity-0 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.88)] backdrop-blur-xl transition-all duration-150 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100">
                {item.label}
              </span>
            </a>
          );
        })}
      </nav>

    </aside>
  );
}
