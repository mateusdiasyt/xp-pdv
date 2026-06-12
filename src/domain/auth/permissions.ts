export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",
  SALES_VIEW: "sales:view",
  COUPONS_VIEW: "coupons:view",
  COUPONS_MANAGE: "coupons:manage",
  SERVICES_VIEW: "services:view",
  PAYMENTS_VIEW: "payments:view",
  ACCOUNTS_VIEW: "accounts:view",
  ACCOUNTS_MANAGE: "accounts:manage",
  REPORTS_VIEW: "reports:view",
  FISCAL_VIEW: "fiscal:view",
  SERVICE_FISCAL_VIEW: "service-fiscal:view",
  SERVICE_FISCAL_MANAGE: "service-fiscal:manage",
  CATEGORIES_VIEW: "categories:view",
  CATEGORIES_MANAGE: "categories:manage",
  SUPPLIERS_VIEW: "suppliers:view",
  SUPPLIERS_MANAGE: "suppliers:manage",
  CUSTOMERS_VIEW: "customers:view",
  CUSTOMERS_MANAGE: "customers:manage",
  PRODUCTS_VIEW: "products:view",
  PRODUCTS_MANAGE: "products:manage",
  STOCK_VIEW: "stock:view",
  STOCK_MANAGE: "stock:manage",
  CASH_VIEW: "cash:view",
  CASH_MANAGE: "cash:manage",
  PDV_VIEW: "pdv:view",
  PDV_MANAGE: "pdv:manage",
  PDV_CANCEL: "pdv:cancel",
  SUPPORT_VIEW: "support:view",
  SUPPORT_MANAGE: "support:manage",
  MODULES_VIEW: "modules:view",
  GOALS_VIEW: "goals:view",
  GOALS_MANAGE: "goals:manage",
  CUSTOMIZATION_VIEW: "customization:view",
  CUSTOMIZATION_MANAGE: "customization:manage",
  TV_APP_VIEW: "tv-app:view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(
  userPermissions: string[] | undefined,
  permission: PermissionKey,
): boolean {
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }

  return userPermissions.includes(permission);
}

export function hasAnyPermission(
  userPermissions: string[] | undefined,
  permissions: PermissionKey[],
): boolean {
  return permissions.some((permission) => hasPermission(userPermissions, permission));
}
