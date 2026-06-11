import { RecordStatus } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import { getCategories } from "@/application/catalog/category-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { CategoryFiscalRulesForm } from "@/presentation/admin/catalog/categories/category-fiscal-rules-form";
import { CreateCategoryForm } from "@/presentation/admin/catalog/categories/create-category-form";
import { toggleCategoryStatusAction } from "@/presentation/admin/catalog/categories/actions";

type CategoriesPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const session = await requirePermission(PERMISSIONS.CATEGORIES_VIEW);
  const { q } = await searchParams;
  const search = q?.trim() || undefined;

  const categories = await getCategories(search);
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.CATEGORIES_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modulo ERP"
        title="Categorias de Produto"
        description="Estrutura de classificacao para relatorios, organizacao de estoque e catalogo."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtro rapido</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET">
            <Input name="q" defaultValue={search ?? ""} placeholder="Buscar por nome ou slug" />
          </form>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Nova categoria</CardTitle>
            <CardDescription>Configure nome, slug e status para uso no cadastro de produtos.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateCategoryForm />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lista de categorias</CardTitle>
          <CardDescription>{categories.length} registro(s) encontrado(s).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Regra fiscal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-zinc-500">
                    Nenhuma categoria encontrada.
                  </TableCell>
                </TableRow>
              ) : null}
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium text-zinc-900">{category.name}</TableCell>
                  <TableCell>{category.slug}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <CategoryFiscalRulesForm
                        categoryId={category.id}
                        fiscalCfop={category.fiscalCfop}
                        fiscalCsosn={category.fiscalCsosn}
                        fiscalIcmsOrigin={category.fiscalIcmsOrigin}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {[category.fiscalCfop, category.fiscalCsosn, category.fiscalIcmsOrigin]
                          .filter(Boolean)
                          .join(" / ") || "Sem regra"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        category.status === RecordStatus.ACTIVE
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-100"
                      }
                    >
                      {category.status === RecordStatus.ACTIVE ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{category._count.products}</TableCell>
                  <TableCell className="text-right">
                    {canManage ? (
                      <form action={toggleCategoryStatusAction}>
                        <input type="hidden" name="categoryId" value={category.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={
                            category.status === RecordStatus.ACTIVE
                              ? RecordStatus.INACTIVE
                              : RecordStatus.ACTIVE
                          }
                        />
                        <Button type="submit" variant="outline" size="sm">
                          {category.status === RecordStatus.ACTIVE ? "Desativar" : "Reativar"}
                        </Button>
                      </form>
                    ) : (
                      <span className="text-xs text-zinc-500">Sem permissao</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
