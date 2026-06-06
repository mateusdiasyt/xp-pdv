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

export type AdminNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: PermissionKey;
  group: "Operacao" | "Financeiro" | "Cadastros" | "Sistema";
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
    permission: PERMISSIONS.PDV_VIEW,
    group: "Operacao",
  },
  {
    label: "Cupons",
    href: "/admin/coupons",
    icon: BadgePercent,
    permission: PERMISSIONS.PDV_VIEW,
    group: "Operacao",
  },
  {
    label: "Servicos",
    href: "/admin/services",
    icon: Gamepad2,
    permission: PERMISSIONS.PDV_VIEW,
    group: "Operacao",
  },
  {
    label: "Pagamentos",
    href: "/admin/payments",
    icon: CreditCard,
    permission: PERMISSIONS.PDV_VIEW,
    group: "Financeiro",
  },
  {
    label: "Contas",
    href: "/admin/accounts",
    icon: Landmark,
    permission: PERMISSIONS.CASH_VIEW,
    group: "Financeiro",
  },
  {
    label: "Relatorios",
    href: "/admin/reports",
    icon: LineChart,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    group: "Financeiro",
  },
  {
    label: "Fiscal",
    href: "/admin/fiscal",
    icon: FileCode2,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    group: "Financeiro",
  },
  {
    label: "NFS-e Servicos",
    href: "/admin/service-fiscal",
    icon: FileCheck2,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    group: "Financeiro",
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
    label: "Administradores",
    href: "/admin/users",
    icon: ShieldUser,
    permission: PERMISSIONS.USERS_VIEW,
    group: "Sistema",
  },
  {
    label: "Suporte",
    href: "/admin/support",
    icon: LifeBuoy,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    group: "Sistema",
  },
  {
    label: "Metas",
    href: "/admin/metas",
    icon: Target,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    group: "Sistema",
  },
  {
    label: "Configuracoes",
    href: "/admin/customization",
    icon: PaintbrushVertical,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    group: "Sistema",
  },
  {
    label: "App TV",
    href: "/admin/app",
    icon: Tv,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    group: "Sistema",
  },
];
