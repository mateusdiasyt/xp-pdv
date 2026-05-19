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
    <aside className="sticky top-0 flex h-screen w-[18.5rem] shrink-0 flex-col border-r border-sidebar-border/85 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--sidebar)_92%,black),var(--sidebar))] text-sidebar-foreground backdrop-blur-xl">
      <div className="border-b border-sidebar-border/75 px-4 py-4">
        <div className="rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/65 p-4 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.65)]">
          <BrandLogo priority className="mx-auto max-w-[188px]" />
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
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
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_12px_24px_-14px_color-mix(in_oklab,var(--sidebar-primary)_70%,transparent)]"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent transition-colors",
                  isActive
                    ? "border-sidebar-primary-foreground/30 bg-sidebar-primary-foreground/12"
                    : "border-sidebar-border/55 bg-sidebar-accent/55 group-hover:border-sidebar-border/80",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

    </aside>
  );
}
