import { AccountNotificationBell } from "@/components/admin/account-notification-bell";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";

type AdminHeaderProps = {
  userName?: string | null;
  userEmail?: string | null;
  roleSlug: string;
  permissions: string[];
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
          <AdminUserMenu userName={userName} userEmail={userEmail} />
          {canViewAccounts ? <AccountNotificationBell {...accountNotifications} /> : null}
        </div>
      </div>
    </header>
  );
}
