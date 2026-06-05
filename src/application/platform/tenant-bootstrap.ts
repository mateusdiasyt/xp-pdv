import bcrypt from "bcryptjs";
import { PrismaClient, RecordStatus } from "@prisma/client";

const permissions = [
  { key: "dashboard:view", description: "Visualizar painel administrativo" },
  { key: "users:view", description: "Visualizar usuarios" },
  { key: "users:manage", description: "Criar e editar usuarios" },
  { key: "categories:view", description: "Visualizar categorias" },
  { key: "categories:manage", description: "Criar e editar categorias" },
  { key: "suppliers:view", description: "Visualizar fornecedores" },
  { key: "suppliers:manage", description: "Criar e editar fornecedores" },
  { key: "customers:view", description: "Visualizar clientes" },
  { key: "customers:manage", description: "Criar e editar clientes" },
  { key: "products:view", description: "Visualizar produtos" },
  { key: "products:manage", description: "Criar e editar produtos" },
  { key: "stock:view", description: "Visualizar movimentacoes de estoque" },
  { key: "stock:manage", description: "Registrar movimentacoes de estoque" },
  { key: "cash:view", description: "Visualizar sessoes de caixa" },
  { key: "cash:manage", description: "Abrir e fechar caixa, registrar sangria e suprimento" },
  { key: "pdv:view", description: "Visualizar vendas no PDV" },
  { key: "pdv:manage", description: "Registrar vendas no PDV" },
  { key: "pdv:cancel", description: "Cancelar vendas no PDV" },
];

const rolePermissions = {
  administrador: permissions.map((permission) => permission.key),
  gerente: [
    "dashboard:view",
    "users:view",
    "categories:view",
    "categories:manage",
    "suppliers:view",
    "suppliers:manage",
    "customers:view",
    "customers:manage",
    "products:view",
    "products:manage",
    "stock:view",
    "stock:manage",
    "cash:view",
    "cash:manage",
    "pdv:view",
    "pdv:manage",
    "pdv:cancel",
  ],
  operador: [
    "dashboard:view",
    "categories:view",
    "suppliers:view",
    "customers:view",
    "customers:manage",
    "products:view",
    "stock:view",
    "stock:manage",
    "cash:view",
    "cash:manage",
    "pdv:view",
    "pdv:manage",
  ],
} as const;

export async function seedTenantDatabase(
  prisma: PrismaClient,
  data: {
    tenantName: string;
    tenantSlug: string;
    ownerName: string;
    ownerEmail: string;
    ownerPasswordHash?: string | null;
    ownerPassword?: string | null;
  },
) {
  const defaultUnit = await prisma.businessUnit.upsert({
    where: { code: "HQ" },
    update: {
      name: "Unidade Principal",
    },
    create: {
      code: "HQ",
      name: "Unidade Principal",
    },
  });

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  const roles = [
    {
      slug: "administrador",
      name: "Administrador",
      description: "Controle total da plataforma",
    },
    {
      slug: "gerente",
      name: "Gerente",
      description: "Gestao operacional e acompanhamento de indicadores",
    },
    {
      slug: "operador",
      name: "Operador",
      description: "Operacao diaria de cadastro e estoque",
    },
  ];

  for (const role of roles) {
    const roleRecord = await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
      create: {
        ...role,
        isSystem: true,
      },
    });

    const allowedPermissionKeys = rolePermissions[role.slug as keyof typeof rolePermissions];
    const permissionRecords = await prisma.permission.findMany({
      where: {
        key: { in: allowedPermissionKeys as string[] },
      },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: roleRecord.id },
    });

    await prisma.rolePermission.createMany({
      data: permissionRecords.map((permission) => ({
        roleId: roleRecord.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { slug: "administrador" },
  });

  const passwordHash =
    data.ownerPasswordHash ??
    (await bcrypt.hash(data.ownerPassword ?? process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin123!", 12));

  await prisma.user.upsert({
    where: { email: data.ownerEmail.toLowerCase() },
    update: {
      name: data.ownerName,
      passwordHash,
      roleId: adminRole.id,
      status: RecordStatus.ACTIVE,
      unitId: defaultUnit.id,
    },
    create: {
      name: data.ownerName,
      email: data.ownerEmail.toLowerCase(),
      passwordHash,
      roleId: adminRole.id,
      status: RecordStatus.ACTIVE,
      unitId: defaultUnit.id,
    },
  });

  await prisma.cashRegister.upsert({
    where: { code: "CAIXA-01" },
    update: {
      name: "Caixa Principal",
      status: RecordStatus.ACTIVE,
      unitId: defaultUnit.id,
    },
    create: {
      code: "CAIXA-01",
      name: "Caixa Principal",
      status: RecordStatus.ACTIVE,
      unitId: defaultUnit.id,
    },
  });

  await prisma.platformTenant.upsert({
    where: { slug: data.tenantSlug },
    update: {
      name: data.tenantName,
      status: "ACTIVE",
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail.toLowerCase(),
      isDefault: true,
      approvedAt: new Date(),
    },
    create: {
      slug: data.tenantSlug,
      name: data.tenantName,
      status: "ACTIVE",
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail.toLowerCase(),
      isDefault: true,
      approvedAt: new Date(),
    },
  });
}
