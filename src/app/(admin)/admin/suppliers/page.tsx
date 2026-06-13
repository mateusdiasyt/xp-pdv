import { RecordStatus } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import { getSuppliers } from "@/application/catalog/supplier-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { CreateSupplierForm } from "@/presentation/admin/catalog/suppliers/create-supplier-form";
import { toggleSupplierStatusAction } from "@/presentation/admin/catalog/suppliers/actions";

type SuppliersPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const session = await requirePermission(PERMISSIONS.SUPPLIERS_VIEW);
  const { q } = await searchParams;
  const search = q?.trim() || undefined;

  const suppliers = await getSuppliers(search);
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.SUPPLIERS_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ERP"
        title="Fornecedores"
        description="Base de parceiros para reposicao de estoque e controle de origem dos produtos."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtro rapido</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET">
            <Input name="q" defaultValue={search ?? ""} placeholder="Buscar por nome, documento ou razao social" />
          </form>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Novo fornecedor</CardTitle>
            <CardDescription>Cadastro de contato comercial e dados fiscais basicos.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateSupplierForm />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lista de fornecedores</CardTitle>
          <CardDescription>{suppliers.length} registro(s) encontrado(s).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome fantasia</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-zinc-500">
                    Nenhum fornecedor encontrado.
                  </TableCell>
                </TableRow>
              ) : null}
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium text-zinc-900">{supplier.tradeName}</TableCell>
                  <TableCell>{supplier.document || "-"}</TableCell>
                  <TableCell>{supplier.email || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        supplier.status === RecordStatus.ACTIVE
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-100"
                      }
                    >
                      {supplier.status === RecordStatus.ACTIVE ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{supplier._count.products}</TableCell>
                  <TableCell className="text-right">
                    {canManage ? (
                      <form action={toggleSupplierStatusAction}>
                        <input type="hidden" name="supplierId" value={supplier.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={
                            supplier.status === RecordStatus.ACTIVE
                              ? RecordStatus.INACTIVE
                              : RecordStatus.ACTIVE
                          }
                        />
                        <Button type="submit" variant="outline" size="sm">
                          {supplier.status === RecordStatus.ACTIVE ? "Desativar" : "Reativar"}
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
