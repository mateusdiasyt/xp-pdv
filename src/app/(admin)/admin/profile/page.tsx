import { requireSession } from "@/application/auth/guards";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { roleSlugToLabel } from "@/domain/auth/roles";

export default async function ProfilePage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conta"
        title="Perfil"
        description="Dados da conta em uso para auditoria e conferencias de acesso."
      />

      <Card>
        <CardHeader>
          <CardTitle>Informacoes da sessao</CardTitle>
          <CardDescription>Confira os dados da conta atualmente autenticada no painel.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Nome</p>
            <p className="text-sm font-medium text-foreground">{session.user.name ?? "-"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Email</p>
            <p className="text-sm font-medium text-foreground">{session.user.email ?? "-"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Perfil de acesso</p>
            <p className="text-sm font-medium text-foreground">{roleSlugToLabel(session.user.roleSlug)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Permissoes concedidas</p>
            <p className="text-sm font-medium text-foreground">{session.user.permissions.length}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
