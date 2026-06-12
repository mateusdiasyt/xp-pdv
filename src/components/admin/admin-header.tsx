import { AccountNotificationBell } from "@/components/admin/account-notification-bell";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";

type AdminHeaderProps = {
  userName?: string | null;
  userEmail?: string | null;
  roleSlug: string;
  permissions: string[];
  planLabel?: string | null;
  planHref?: string;
  planIsActive?: boolean;
  accountNotifications: {
    count: number;
    overdueCount: number;
    dueSoonCount: number;
    items: Array<{
      id: string;
      name: string;
      amount: number;
      dueDate: string;
    }>;
  };
};

export function AdminHeader({
  userName,
  userEmail,
  roleSlug,
  permissions,
  planLabel,
  planHref,
  planIsActive = false,
  accountNotifications,
}: AdminHeaderProps) {
  const canViewAccounts = roleSlug === "administrador" || hasPermission(permissions, PERMISSIONS.ACCOUNTS_VIEW);

  return (
    <header className="sticky top-0 z-30 bg-background/64 px-4 py-3 backdrop-blur-2xl md:px-6 xl:px-8">
      <div className="mx-auto flex h-11 w-full max-w-[1600px] items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="md:hidden">
            <AdminMobileNav roleSlug={roleSlug} permissions={permissions} />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/42 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-[0_8px_24px_-22px_rgba(0,0,0,0.8)]">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Mendoza PDV
          </div>
        </div>

        <div className="flex items-center gap-2">
          {planLabel && planHref ? (
            <a
              href={planHref}
              className={
                planIsActive
                  ? "hidden h-9 items-center justify-center rounded-full border border-emerald-300/22 bg-emerald-400/10 px-3 text-xs font-black text-emerald-100 transition-colors hover:border-emerald-300/35 hover:bg-emerald-400/15 sm:inline-flex"
                  : "hidden h-9 items-center justify-center rounded-full border border-primary/35 bg-primary px-3 text-xs font-black text-primary-foreground shadow-[0_14px_36px_-24px_hsl(var(--primary))] transition-colors hover:bg-primary/90 sm:inline-flex"
              }
            >
              {planLabel}
            </a>
          ) : null}
          <AdminUserMenu userName={userName} userEmail={userEmail} />
          {canViewAccounts ? <AccountNotificationBell {...accountNotifications} /> : null}
        </div>
      </div>
    </header>
  );
}
