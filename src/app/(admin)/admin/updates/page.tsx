import { requireSession } from "@/application/auth/guards";
import { getSystemUpdates } from "@/application/updates/system-update-service";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function UpdatesPage() {
  await requireSession();
  const { updates, setupPending } = await getSystemUpdates();

  return (
    <div className="space-y-6 text-white [&_.text-muted-foreground]:text-white/80">
      <PageHeader
        eyebrow="Modulo ERP"
        title="Atualizacoes do sistema"
        description="Registro interno das melhorias e mudancas publicadas no sistema via codigo."
      />

      <Card className="bg-card/78">
        <CardHeader>
          <CardTitle className="text-white">Historico de atualizacoes</CardTitle>
          <CardDescription className="text-white/80">Ultimas atualizacoes publicadas no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {setupPending ? (
            <p className="text-sm text-amber-200">
              O armazenamento em banco para atualizacoes nao esta ativo neste ambiente. Exibindo atualizacoes publicadas via codigo.
            </p>
          ) : (
            <Table className="text-white">
              <TableHeader className="[&_th]:text-white/85">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead>Responsavel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-white/75">
                      Nenhuma atualizacao foi registrada ainda.
                    </TableCell>
                  </TableRow>
                ) : null}
                {updates.map((updateEntry) => (
                  <TableRow key={updateEntry.id}>
                    <TableCell className="whitespace-nowrap text-white">{dateFormatter.format(updateEntry.createdAt)}</TableCell>
                    <TableCell className="font-medium text-white">{updateEntry.title}</TableCell>
                    <TableCell className="max-w-[38rem] whitespace-pre-wrap text-sm text-white/88">
                      {updateEntry.description}
                    </TableCell>
                    <TableCell className="text-white">{updateEntry.createdByName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
