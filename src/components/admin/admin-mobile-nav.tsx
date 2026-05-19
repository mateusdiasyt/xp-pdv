"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";

import { BrandLogo } from "@/components/admin/brand-logo";
import { adminNavigation } from "@/components/admin/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type AdminMobileNavProps = {
  roleSlug: string;
  permissions: string[];
};

export function AdminMobileNav({ roleSlug, permissions }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = roleSlug === "administrador";
  const items = adminNavigation.filter((item) => isAdmin || permissions.includes(item.permission));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="icon-sm" className="rounded-full" />}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Abrir menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col border-sidebar-border/80 bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="border-b border-sidebar-border/80 p-6">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <BrandLogo className="max-w-[176px]" />
        </SheetHeader>
        <div className="flex-1 space-y-1.5 p-3">
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
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
