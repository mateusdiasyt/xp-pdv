import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  BadgePercent,
  ChartColumnBig,
  ContactRound,
  CreditCard,
  Landmark,
  FileCode2,
  FileCheck2,
  Gamepad2,
  Receipt,
  LineChart,
  Package,
  Puzzle,
  ShieldUser,
  ScrollText,
  Store,
  Target,
  LifeBuoy,
  PaintbrushVertical,
  Tv,
  Warehouse,
} from "lucide-react";

import { PERMISSIONS, type PermissionKey } from "@/domain/auth/permissions";
import type { PlatformModuleKey } from "@/domain/platform/plan-entitlements";

export type AdminNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: PermissionKey;
  group: "Operacao" | "Financeiro" | "Cadastros" | "Sistema";
  requiredModule?: PlatformModuleKey;
};

export const adminNavigation: AdminNavigationItem[] = [
  {
    label: "Painel",
    href: "/admin",
    icon: ChartColumnBig,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    group: "Operacao",
  },
  {
    label: "PDV",
    href: "/admin/pdv",
    icon: Receipt,
    permission: PERMISSIONS.PDV_VIEW,
    group: "Operacao",
  },
  {
    label: "Todas as vendas",
    href: "/admin/sales",
    icon: ScrollText,
    permission: PERMISSIONS.SALES_VIEW,
    group: "Operacao",
  },
  {
    label: "Cupons",
    href: "/admin/coupons",
    icon: BadgePercent,
    permission: PERMISSIONS.COUPONS_VIEW,
    group: "Operacao",
  },
  {
    label: "Servicos",
    href: "/admin/services",
    icon: Gamepad2,
    permission: PERMISSIONS.SERVICES_VIEW,
    group: "Operacao",
  },
  {
    label: "Pagamentos",
    href: "/admin/payments",
    icon: CreditCard,
    permission: PERMISSIONS.PAYMENTS_VIEW,
    group: "Financeiro",
  },
  {
    label: "Contas",
    href: "/admin/accounts",
    icon: Landmark,
    permission: PERMISSIONS.ACCOUNTS_VIEW,
    group: "Financeiro",
  },
  {
    label: "Relatorios",
    href: "/admin/reports",
    icon: LineChart,
    permission: PERMISSIONS.REPORTS_VIEW,
    group: "Financeiro",
  },
  {
    label: "Fiscal",
    href: "/admin/fiscal",
    icon: FileCode2,
    permission: PERMISSIONS.FISCAL_VIEW,
    group: "Financeiro",
    requiredModule: "fiscal-focus",
  },
  {
    label: "NFS-e Servicos",
    href: "/admin/service-fiscal",
    icon: FileCheck2,
    permission: PERMISSIONS.SERVICE_FISCAL_VIEW,
    group: "Financeiro",
    requiredModule: "fiscal-focus",
  },
  {
    label: "Categorias",
    href: "/admin/categories",
    icon: Boxes,
    permission: PERMISSIONS.CATEGORIES_VIEW,
    group: "Cadastros",
  },
  {
    label: "Fornecedores",
    href: "/admin/suppliers",
    icon: Store,
    permission: PERMISSIONS.SUPPLIERS_VIEW,
    group: "Cadastros",
  },
  {
    label: "Clientes",
    href: "/admin/customers",
    icon: ContactRound,
    permission: PERMISSIONS.CUSTOMERS_VIEW,
    group: "Cadastros",
  },
  {
    label: "Produtos",
    href: "/admin/products",
    icon: Package,
    permission: PERMISSIONS.PRODUCTS_VIEW,
    group: "Cadastros",
  },
  {
    label: "Estoque",
    href: "/admin/stock",
    icon: Warehouse,
    permission: PERMISSIONS.STOCK_VIEW,
    group: "Cadastros",
  },
  {
    label: "Usuarios",
    href: "/admin/users",
    icon: ShieldUser,
    permission: PERMISSIONS.USERS_VIEW,
    group: "Sistema",
  },
  {
    label: "Suporte",
    href: "/admin/support",
    icon: LifeBuoy,
    permission: PERMISSIONS.SUPPORT_VIEW,
    group: "Sistema",
  },
  {
    label: "Plugins",
    href: "/admin/plugins",
    icon: Puzzle,
    permission: PERMISSIONS.MODULES_VIEW,
    group: "Sistema",
  },
  {
    label: "Metas",
    href: "/admin/metas",
    icon: Target,
    permission: PERMISSIONS.GOALS_VIEW,
    group: "Sistema",
  },
  {
    label: "Configuracoes",
    href: "/admin/customization",
    icon: PaintbrushVertical,
    permission: PERMISSIONS.CUSTOMIZATION_VIEW,
    group: "Sistema",
  },
  {
    label: "App TV",
    href: "/admin/app",
    icon: Tv,
    permission: PERMISSIONS.TV_APP_VIEW,
    group: "Sistema",
    requiredModule: "tv-app",
  },
];
