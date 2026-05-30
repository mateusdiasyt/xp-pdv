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
    <aside className="group/sidebar sticky top-3 z-[80] my-3 ml-3 flex h-[calc(100vh-1.5rem)] w-[4.75rem] shrink-0 flex-col overflow-hidden rounded-[1.45rem] border border-sidebar-border/45 bg-sidebar/58 text-sidebar-foreground shadow-[24px_0_72px_-54px_rgba(0,0,0,0.95)] backdrop-blur-2xl transition-[width,background-color,border-color] duration-300 ease-out hover:w-[17rem] hover:border-sidebar-border/70 supports-[backdrop-filter]:bg-sidebar/46">
      <div className="flex h-[4.75rem] shrink-0 items-center px-3">
        <BrandLogo
          priority
          className="h-10 w-10 shrink-0 overflow-hidden transition-[width] duration-300 ease-out group-hover/sidebar:w-36"
        />
      </div>

      <nav className="admin-scrollbar flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 pb-4">
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
              className={cn(
                "flex h-12 w-full items-center justify-center gap-3 rounded-2xl text-sm font-semibold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar group-hover/sidebar:justify-start group-hover/sidebar:px-3",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_16px_28px_-16px_color-mix(in_oklab,var(--sidebar-primary)_78%,transparent)]"
                  : "border border-sidebar-border/35 bg-sidebar-accent/28 text-sidebar-foreground/72 hover:border-sidebar-border/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:w-auto group-hover/sidebar:opacity-100">
                {item.label}
              </span>
            </a>
          );
        })}
      </nav>

    </aside>
  );
}
