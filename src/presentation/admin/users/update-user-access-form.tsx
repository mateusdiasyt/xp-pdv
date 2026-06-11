"use client";

import { Loader2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import { updateUserAccessAction } from "@/presentation/admin/users/actions";

type AccessUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  directPermissionIds: string[];
};

type AccessRole = {
  id: string;
  name: string;
  permissionIds: string[];
};

type AccessPermission = {
  id: string;
  key: string;
  description: string | null;
};

type UpdateUserAccessFormProps = {
  users: AccessUser[];
  roles: AccessRole[];
  permissions: AccessPermission[];
  initialUserId?: string;
  lockUser?: boolean;
};

type PermissionDisplay = {
  id: string;
  key: string;
  module: string;
  title: string;
  description: string;
};

const moduleOrder = [
  "Painel",
  "PDV",
  "Vendas",
  "Cupons",
  "Servicos",
  "Financeiro",
  "Fiscal",
  "Usuarios",
  "Categorias",
  "Fornecedores",
  "Clientes",
  "Produtos",
  "Estoque",
  "Caixa",
  "Sistema",
];

const permissionDictionary: Record<string, { module: string; title: string; description: string }> = {
  "dashboard:view": {
    module: "Painel",
    title: "Visualizar painel",
    description: "Acesso aos indicadores e cards principais do sistema.",
  },
  "users:view": {
    module: "Usuarios",
    title: "Visualizar usuarios",
    description: "Permite consultar lista, perfis e situacao dos usuarios.",
  },
  "users:manage": {
    module: "Usuarios",
    title: "Gerenciar usuarios",
    description: "Permite criar contas, alterar perfil e atualizar status.",
  },
  "sales:view": {
    module: "Vendas",
    title: "Visualizar vendas",
    description: "Permite consultar historico completo, comprovantes, DANFE e XML.",
  },
  "coupons:view": {
    module: "Cupons",
    title: "Visualizar cupons",
    description: "Permite consultar cupons cadastrados e regras de desconto.",
  },
  "coupons:manage": {
    module: "Cupons",
    title: "Gerenciar cupons",
    description: "Permite criar, editar e ativar/desativar cupons.",
  },
  "services:view": {
    module: "Servicos",
    title: "Visualizar servicos",
    description: "Permite abrir a tela de servicos por tempo e acompanhar estacoes.",
  },
  "payments:view": {
    module: "Financeiro",
    title: "Visualizar pagamentos",
    description: "Permite consultar auditoria de Pix, dinheiro, credito e debito.",
  },
  "accounts:view": {
    module: "Financeiro",
    title: "Visualizar contas",
    description: "Permite consultar contas, vencimentos e comprovantes.",
  },
  "accounts:manage": {
    module: "Financeiro",
    title: "Gerenciar contas",
    description: "Permite cadastrar contas, alterar status e anexar comprovantes.",
  },
  "reports:view": {
    module: "Financeiro",
    title: "Visualizar relatorios",
    description: "Permite consultar relatorios de venda, caixa, lucro e formas de pagamento.",
  },
  "fiscal:view": {
    module: "Fiscal",
    title: "Visualizar fiscal",
    description: "Permite consultar NFC-e, DANFE, XML e exportacoes fiscais.",
  },
  "service-fiscal:view": {
    module: "Fiscal",
    title: "Visualizar NFS-e servicos",
    description: "Permite consultar apuracao fiscal de servicos por periodo.",
  },
  "service-fiscal:manage": {
    module: "Fiscal",
    title: "Gerenciar NFS-e servicos",
    description: "Permite registrar declaracoes e numeros de NFS-e de servicos.",
  },
  "categories:view": {
    module: "Categorias",
    title: "Visualizar categorias",
    description: "Permite consultar categorias de produtos.",
  },
  "categories:manage": {
    module: "Categorias",
    title: "Gerenciar categorias",
    description: "Permite criar, editar e ativar/desativar categorias.",
  },
  "suppliers:view": {
    module: "Fornecedores",
    title: "Visualizar fornecedores",
    description: "Permite consultar cadastro e status de fornecedores.",
  },
  "suppliers:manage": {
    module: "Fornecedores",
    title: "Gerenciar fornecedores",
    description: "Permite criar e editar dados de fornecedores.",
  },
  "customers:view": {
    module: "Clientes",
    title: "Visualizar clientes",
    description: "Permite consultar cadastro de clientes para atendimentos e comandas.",
  },
  "customers:manage": {
    module: "Clientes",
    title: "Gerenciar clientes",
    description: "Permite cadastrar, editar e ativar/desativar clientes.",
  },
  "products:view": {
    module: "Produtos",
    title: "Visualizar produtos",
    description: "Permite consultar lista, preco e estoque dos produtos.",
  },
  "products:manage": {
    module: "Produtos",
    title: "Gerenciar produtos",
    description: "Permite criar produtos e alterar dados comerciais.",
  },
  "stock:view": {
    module: "Estoque",
    title: "Visualizar estoque",
    description: "Permite consultar movimentacoes e saldos de estoque.",
  },
  "stock:manage": {
    module: "Estoque",
    title: "Gerenciar estoque",
    description: "Permite registrar entrada, saida e ajuste de estoque.",
  },
  "cash:view": {
    module: "Caixa",
    title: "Visualizar caixa",
    description: "Permite consultar sessoes de caixa e valores registrados.",
  },
  "cash:manage": {
    module: "Caixa",
    title: "Gerenciar caixa",
    description: "Permite abrir/fechar caixa e registrar sangria e suprimento.",
  },
  "pdv:view": {
    module: "PDV",
    title: "Visualizar PDV",
    description: "Permite consultar vendas registradas no PDV.",
  },
  "pdv:manage": {
    module: "PDV",
    title: "Gerenciar PDV",
    description: "Permite registrar novas vendas no PDV.",
  },
  "pdv:cancel": {
    module: "PDV",
    title: "Cancelar vendas",
    description: "Permite cancelar vendas e retornar estoque automaticamente.",
  },
  "support:view": {
    module: "Sistema",
    title: "Visualizar suporte",
    description: "Permite consultar tickets de suporte.",
  },
  "support:manage": {
    module: "Sistema",
    title: "Gerenciar suporte",
    description: "Permite criar tickets e atualizar status de suporte.",
  },
  "goals:view": {
    module: "Sistema",
    title: "Visualizar metas",
    description: "Permite consultar metas diarias e mensais.",
  },
  "goals:manage": {
    module: "Sistema",
    title: "Gerenciar metas",
    description: "Permite cadastrar e editar metas comerciais.",
  },
  "customization:view": {
    module: "Sistema",
    title: "Visualizar configuracoes",
    description: "Permite acessar a tela de configuracoes e personalizacao.",
  },
  "customization:manage": {
    module: "Sistema",
    title: "Gerenciar configuracoes",
    description: "Permite alterar identidade visual e configuracoes do sistema.",
  },
  "tv-app:view": {
    module: "Sistema",
    title: "Visualizar app da TV",
    description: "Permite acessar a pagina do APK e manifesto de atualizacao.",
  },
};

function parsePermission(permission: AccessPermission): PermissionDisplay {
  const mapped = permissionDictionary[permission.key];
  if (mapped) {
    return {
      id: permission.id,
      key: permission.key,
      module: mapped.module,
      title: mapped.title,
      description: mapped.description,
    };
  }

  return {
    id: permission.id,
    key: permission.key,
    module: "Outros",
    title: permission.key,
    description: permission.description ?? "Permissao adicional de sistema.",
  };
}

function moduleSortIndex(moduleName: string) {
  const index = moduleOrder.indexOf(moduleName);
  return index >= 0 ? index : moduleOrder.length + 1;
}

export function UpdateUserAccessForm({
  users,
  roles,
  permissions,
  initialUserId,
  lockUser = false,
}: UpdateUserAccessFormProps) {
  const initialUser = users.find((user) => user.id === initialUserId) ?? users[0];
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(initialUser?.id ?? "");
  const [selectedRoleId, setSelectedRoleId] = useState(initialUser?.roleId ?? roles[0]?.id ?? "");
  const [searchPermission, setSearchPermission] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(initialUser?.directPermissionIds ?? []);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0],
    [selectedUserId, users],
  );

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? roles[0],
    [selectedRoleId, roles],
  );

  const rolePermissionIds = useMemo(() => new Set(selectedRole?.permissionIds ?? []), [selectedRole]);

  const filteredPermissions = useMemo(() => {
    const normalizedQuery = searchPermission.trim().toLowerCase();
    const normalizedList = permissions.map(parsePermission);
    if (!normalizedQuery) {
      return normalizedList;
    }

    return normalizedList.filter((permission) => {
      return (
        permission.module.toLowerCase().includes(normalizedQuery) ||
        permission.title.toLowerCase().includes(normalizedQuery) ||
        permission.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [permissions, searchPermission]);

  const groupedPermissions = useMemo(() => {
    const grouped = new Map<string, PermissionDisplay[]>();

    for (const permission of filteredPermissions) {
      const current = grouped.get(permission.module);
      if (current) {
        current.push(permission);
      } else {
        grouped.set(permission.module, [permission]);
      }
    }

    return Array.from(grouped.entries())
      .sort((a, b) => moduleSortIndex(a[0]) - moduleSortIndex(b[0]) || a[0].localeCompare(b[0]))
      .map(([moduleName, modulePermissions]) => ({
        moduleName,
        permissions: modulePermissions.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [filteredPermissions]);

  const selectedExtraPermissionIds = useMemo(
    () => selectedPermissionIds.filter((permissionId) => !rolePermissionIds.has(permissionId)),
    [selectedPermissionIds, rolePermissionIds],
  );

  function toggleDirectPermission(permissionId: string, checked: boolean) {
    setSelectedPermissionIds((current) => {
      if (checked) {
        if (current.includes(permissionId)) {
          return current;
        }

        return [...current, permissionId];
      }

      return current.filter((id) => id !== permissionId);
    });
  }

  function handleUserChange(userId: string) {
    setSelectedUserId(userId);
    const user = users.find((item) => item.id === userId);

    if (!user) {
      return;
    }

    setSelectedRoleId(user.roleId);
    setSelectedPermissionIds(user.directPermissionIds);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setState(initialActionState);

    try {
      const result = await updateUserAccessAction(initialActionState, new FormData(event.currentTarget));
      setState(result);

      if (result.status === "success") {
        window.location.reload();
        return;
      }
    } catch {
      setState({
        status: "error",
        message: "Nao foi possivel salvar o acesso. Se o problema persistir, contate o Mateus.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!selectedUser || !selectedRole) {
    return (
      <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
        Cadastre ao menos um usuario e um perfil para editar permissoes.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-border/80 bg-background/70 p-3">
        <p className="text-sm font-semibold text-foreground">Como funciona o controle de acesso</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>O perfil base aplica um pacote padrao de permissoes.</li>
          <li>As permissoes extras servem para excecoes pontuais de operacao.</li>
          <li>Permissoes ja incluidas no perfil aparecem travadas para evitar duplicidade.</li>
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="userId-access">Usuario</Label>
          {lockUser ? (
            <>
              <Input id="userId-access" value={`${selectedUser.name} (${selectedUser.email})`} readOnly />
              <input type="hidden" name="userId" value={selectedUser.id} />
            </>
          ) : (
            <select
              id="userId-access"
              name="userId"
              className="admin-native-select"
              value={selectedUser.id}
              onChange={(event) => handleUserChange(event.target.value)}
              required
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="roleId-access">Perfil base</Label>
          <select
            id="roleId-access"
            name="roleId"
            className="admin-native-select"
            value={selectedRoleId}
            onChange={(event) => setSelectedRoleId(event.target.value)}
            required
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/80 bg-background/70 p-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Perfil base</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{selectedRole.name}</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Permissoes do perfil</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{selectedRole.permissionIds.length}</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Excecoes selecionadas</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{selectedExtraPermissionIds.length}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="searchPermission">Buscar permissao</Label>
        <Input
          id="searchPermission"
          value={searchPermission}
          onChange={(event) => setSearchPermission(event.target.value)}
          placeholder="Digite modulo ou acao. Ex: estoque, caixa, visualizar"
        />
      </div>

      {selectedExtraPermissionIds.map((permissionId) => (
        <input key={permissionId} type="hidden" name="permissionIds" value={permissionId} />
      ))}

      <div className="space-y-3">
        {groupedPermissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            Nenhuma permissao encontrada para o filtro informado.
          </div>
        ) : (
          groupedPermissions.map((group) => (
            <section key={group.moduleName} className="rounded-xl border border-border/80 bg-background/70 p-3">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/70 pb-2">
                <p className="text-sm font-semibold text-foreground">{group.moduleName}</p>
                <p className="text-xs text-muted-foreground">{group.permissions.length} permissao(oes)</p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {group.permissions.map((permission) => {
                  const includedByRole = rolePermissionIds.has(permission.id);
                  const selectedAsExtra = selectedPermissionIds.includes(permission.id);

                  return (
                    <label
                      key={permission.id}
                      htmlFor={`permission-${permission.id}`}
                      className="flex items-start gap-3 rounded-lg border border-border/75 bg-card/65 px-3 py-2.5"
                    >
                      <input
                        id={`permission-${permission.id}`}
                        type="checkbox"
                        checked={includedByRole || selectedAsExtra}
                        disabled={includedByRole}
                        onChange={(event) => toggleDirectPermission(permission.id, event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
                      />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium text-foreground">{permission.title}</span>
                        <span className="block text-xs text-muted-foreground">{permission.description}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            includedByRole
                              ? "bg-primary/15 text-primary"
                              : selectedAsExtra
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-muted/70 text-muted-foreground"
                          }`}
                        >
                          {includedByRole ? "Incluida pelo perfil" : selectedAsExtra ? "Excecao ativa" : "Nao concedida"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "Salvando..." : "Salvar acesso"}
        </Button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
