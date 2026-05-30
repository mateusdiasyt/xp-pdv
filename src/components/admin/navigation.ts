import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  BadgePercent,
  ChartColumnBig,
  ContactRound,
  CreditCard,
  FileCode2,
  FileCheck2,
  Gamepad2,
  Receipt,
  LineChart,
  Package,
  ShieldUser,
  Store,
  Target,
  LifeBuoy,
  PaintbrushVertical,
  Tv,
  Warehouse,
} from "lucide-react";

import { PERMISSIONS, type PermissionKey } from "@/domain/auth/permissions";

export type AdminNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: PermissionKey;
};

export const adminNavigation: AdminNavigationItem[] = [
  {
    label: "Painel",
    href: "/admin",
    icon: ChartColumnBig,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    label: "PDV",
    href: "/admin/pdv",
    icon: Receipt,
    permission: PERMISSIONS.PDV_VIEW,
  },
  {
    label: "Cupons",
    href: "/admin/coupons",
    icon: BadgePercent,
    permission: PERMISSIONS.PDV_VIEW,
  },
  {
    label: "Servicos",
    href: "/admin/services",
    icon: Gamepad2,
    permission: PERMISSIONS.PDV_VIEW,
  },
  {
    label: "Pagamentos",
    href: "/admin/payments",
    icon: CreditCard,
    permission: PERMISSIONS.PDV_VIEW,
  },
  {
    label: "Relatorios",
    href: "/admin/reports",
    icon: LineChart,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    label: "Fiscal",
    href: "/admin/fiscal",
    icon: FileCode2,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    label: "NFS-e Servicos",
    href: "/admin/service-fiscal",
    icon: FileCheck2,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    label: "Administradores",
    href: "/admin/users",
    icon: ShieldUser,
    permission: PERMISSIONS.USERS_VIEW,
  },
  {
    label: "Categorias",
    href: "/admin/categories",
    icon: Boxes,
    permission: PERMISSIONS.CATEGORIES_VIEW,
  },
  {
    label: "Fornecedores",
    href: "/admin/suppliers",
    icon: Store,
    permission: PERMISSIONS.SUPPLIERS_VIEW,
  },
  {
    label: "Clientes",
    href: "/admin/customers",
    icon: ContactRound,
    permission: PERMISSIONS.CUSTOMERS_VIEW,
  },
  {
    label: "Produtos",
    href: "/admin/products",
    icon: Package,
    permission: PERMISSIONS.PRODUCTS_VIEW,
  },
  {
    label: "Estoque",
    href: "/admin/stock",
    icon: Warehouse,
    permission: PERMISSIONS.STOCK_VIEW,
  },
  {
    label: "Suporte",
    href: "/admin/support",
    icon: LifeBuoy,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    label: "Metas",
    href: "/admin/metas",
    icon: Target,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    label: "Personalizacao",
    href: "/admin/customization",
    icon: PaintbrushVertical,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    label: "App TV",
    href: "/admin/app",
    icon: Tv,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
];
