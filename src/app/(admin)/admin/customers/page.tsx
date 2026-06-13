import { RecordStatus } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import { getCustomers } from "@/application/customers/customer-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { CreateCustomerDialog } from "@/presentation/admin/customers/create-customer-dialog";
import { EditCustomerDialog } from "@/presentation/admin/customers/edit-customer-dialog";
import { toggleCustomerStatusAction } from "@/presentation/admin/customers/actions";

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
  const { q } = await searchParams;
  const search = q?.trim() || undefined;

  const customers = await getCustomers(search);
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.CUSTOMERS_MANAGE);

  function formatBirthDate(date: Date | null) {
    if (!date) {
      return "-";
    }

    return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  function formatBirthDateInput(date: Date | null) {
    if (!date) {
      return "";
    }

    return date.toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ERP"
        title="Clientes"
        description="Cadastro de clientes para uso em comandas e historico de atendimento no PDV."
      />

      <Card>
        <CardHeader className="space-y-3 border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Filtro rapido</CardTitle>
              <CardDescription>Busque por nome, documento, telefone ou email.</CardDescription>
            </div>
            {canManage ? <CreateCustomerDialog /> : null}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form method="GET">
            <Input
              name="q"
              defaultValue={search ?? ""}
              placeholder="Buscar por nome, documento, telefone ou email"
            />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de clientes</CardTitle>
          <CardDescription>{customers.length} registro(s) encontrado(s).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Nascimento</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Comandas</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:text-foreground">
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-zinc-500">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : null}
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium text-foreground">{customer.fullName}</TableCell>
                  <TableCell>{formatBirthDate(customer.birthDate)}</TableCell>
                  <TableCell>
                    {customer.documentType}: {customer.documentNumber}
                  </TableCell>
                  <TableCell>
                    <p>{customer.phone || "-"}</p>
                    <p className="text-xs text-muted-foreground">{customer.email || "-"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        customer.status === RecordStatus.ACTIVE
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-100"
                      }
                    >
                      {customer.status === RecordStatus.ACTIVE ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{customer._count.comandas}</TableCell>
                  <TableCell className="text-right">
                    {canManage ? (
                      <div className="flex items-center justify-end gap-2">
                        <EditCustomerDialog
                          customer={{
                            id: customer.id,
                            fullName: customer.fullName,
                            birthDate: formatBirthDateInput(customer.birthDate),
                            documentType: customer.documentType,
                            documentNumber: customer.documentNumber,
                            phone: customer.phone,
                            email: customer.email,
                            status: customer.status,
                          }}
                        />
                        <form action={toggleCustomerStatusAction}>
                          <input type="hidden" name="customerId" value={customer.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={
                              customer.status === RecordStatus.ACTIVE
                                ? RecordStatus.INACTIVE
                                : RecordStatus.ACTIVE
                            }
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {customer.status === RecordStatus.ACTIVE ? "Desativar" : "Reativar"}
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem permissao</span>
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
