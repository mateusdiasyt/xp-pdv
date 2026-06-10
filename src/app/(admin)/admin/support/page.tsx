import Link from "next/link";

import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client";
import { Search } from "lucide-react";

import { requirePermission } from "@/application/auth/guards";
import { getSupportTickets } from "@/application/support/support-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { CreateSupportTicketForm } from "@/presentation/admin/support/create-support-ticket-form";
import { UpdateSupportTicketStatusForm } from "@/presentation/admin/support/update-support-ticket-status-form";

type SupportPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const statusLabels: Record<SupportTicketStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
};

const priorityLabels: Record<SupportTicketPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

function statusBadgeClass(status: SupportTicketStatus) {
  switch (status) {
    case SupportTicketStatus.IN_PROGRESS:
      return "bg-sky-100 text-sky-700 hover:bg-sky-100";
    case SupportTicketStatus.RESOLVED:
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    default:
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  }
}

function priorityBadgeClass(priority: SupportTicketPriority) {
  switch (priority) {
    case SupportTicketPriority.URGENT:
      return "bg-rose-100 text-rose-700 hover:bg-rose-100";
    case SupportTicketPriority.HIGH:
      return "bg-orange-100 text-orange-700 hover:bg-orange-100";
    case SupportTicketPriority.LOW:
      return "bg-zinc-100 text-zinc-700 hover:bg-zinc-100";
    default:
      return "bg-violet-100 text-violet-700 hover:bg-violet-100";
  }
}

function parseStatusFilter(value?: string) {
  if (!value) {
    return undefined;
  }

  return Object.values(SupportTicketStatus).includes(value as SupportTicketStatus)
    ? (value as SupportTicketStatus)
    : undefined;
}

export default async function SupportPage({ searchParams }: SupportPageProps) {
  await requirePermission(PERMISSIONS.SUPPORT_VIEW);
  const { q, status } = await searchParams;
  const search = q?.trim() || undefined;
  const statusFilter = parseStatusFilter(status);
  const { tickets, setupPending } = await getSupportTickets({
    search,
    status: statusFilter,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modulo ERP"
        title="Suporte"
        description="Espaco para o responsavel abrir tickets com pedidos, correcoes e ajustes para acompanhamento posterior."
      />

      <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Novo ticket</CardTitle>
            <CardDescription>
              Deixe o contexto do problema ou pedido para eu revisar depois com mais velocidade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {setupPending ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/8 px-4 py-4 text-sm text-amber-100">
                O modulo de suporte ja esta no painel, mas o banco deste ambiente ainda nao recebeu a tabela
                `SupportTicket`. Depois do `db:push`, os tickets passam a funcionar aqui normalmente.
              </div>
            ) : (
              <CreateSupportTicketForm />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tickets registrados</CardTitle>
            <CardDescription>{tickets.length} ticket(s) encontrado(s).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {setupPending ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/8 px-4 py-4 text-sm text-amber-100">
                Os tickets ainda nao podem ser consultados neste ambiente porque a tabela nao existe no banco atual.
              </div>
            ) : null}

            <form method="GET" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={search ?? ""}
                  placeholder="Buscar por ticket, titulo, descricao ou responsavel"
                  className="pl-9"
                />
              </div>

              <select name="status" className="admin-native-select" defaultValue={statusFilter ?? "all"}>
                <option value="all">Todos os status</option>
                {Object.values(SupportTicketStatus).map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusLabels[statusOption]}
                  </option>
                ))}
              </select>

              <Button type="submit" variant="secondary">
                Filtrar
              </Button>

              <Link
                href="/admin/support"
                className="inline-flex h-9 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
              >
                Limpar
              </Link>
            </form>

            {!setupPending && tickets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/75 bg-background/32 px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum ticket registrado com este filtro.
              </div>
            ) : !setupPending ? (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-[1.4rem] border border-border/75 bg-background/30 p-4 shadow-[0_16px_36px_-28px_color-mix(in_oklab,var(--foreground)_34%,transparent)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {ticket.ticketNumber}
                          </p>
                          <Badge className={statusBadgeClass(ticket.status)}>{statusLabels[ticket.status]}</Badge>
                          <Badge className={priorityBadgeClass(ticket.priority)}>
                            {priorityLabels[ticket.priority]}
                          </Badge>
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">{ticket.title}</h2>
                      </div>

                      <div className="text-right text-xs text-muted-foreground">
                        <p>{dateFormatter.format(ticket.createdAt)}</p>
                        <p>{ticket.createdByName}</p>
                      </div>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {ticket.description}
                    </p>

                    {ticket.attachmentImage ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-border/70 bg-background/45 p-2">
                        <a
                          href={ticket.attachmentImage}
                          target="_blank"
                          rel="noreferrer"
                          className="group block overflow-hidden rounded-xl border border-border/70 bg-background/40 transition-colors hover:border-primary/55"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ticket.attachmentImage}
                            alt={`Anexo do ticket ${ticket.ticketNumber}`}
                            className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                          />
                        </a>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 rounded-2xl border border-border/70 bg-background/50 p-3 lg:grid-cols-[minmax(0,1fr)_156px] lg:items-start">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          Atualizado em {dateFormatter.format(ticket.updatedAt)}
                          {ticket.updatedByName ? ` por ${ticket.updatedByName}` : ""}
                        </p>
                        {ticket.resolvedAt ? <p>Resolvido em {dateFormatter.format(ticket.resolvedAt)}</p> : null}
                      </div>

                      <UpdateSupportTicketStatusForm ticketId={ticket.id} status={ticket.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
