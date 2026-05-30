import { requirePermission } from "@/application/auth/guards";
import { getOperators } from "@/application/users/user-service";
import { PageHeader } from "@/components/admin/page-header";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { OperatorsPanel } from "@/presentation/admin/operators/operators-panel";

export default async function OperatorsPage() {
  const session = await requirePermission(PERMISSIONS.USERS_VIEW);
  const operators = await getOperators();
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.USERS_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operacao" title="Operadores" description="Pessoas que podem assumir um caixa no PDV." />

      <OperatorsPanel
        canManage={canManage}
        operators={operators.map((operator) => ({
          id: operator.id,
          name: operator.name,
          email: operator.email,
          roleName: operator.role.name,
          status: operator.status,
        }))}
      />
    </div>
  );
}
