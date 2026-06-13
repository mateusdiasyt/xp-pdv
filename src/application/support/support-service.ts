import { SupportTicketStatus } from "@prisma/client";

import { createSupportTicketSchema, updateSupportTicketStatusSchema } from "@/domain/support/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  createSupportTicket,
  isMissingSupportTicketTableError,
  listSupportTickets,
  updateSupportTicketStatus,
} from "@/infrastructure/db/repositories/support-ticket-repository";

function createTicketNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SUP-${datePart}-${randomPart}`;
}

function ensureSupportStorageAvailable(error: unknown): never {
  if (isMissingSupportTicketTableError(error)) {
    throw new Error("Area de suporte aguardando sincronizacao do banco. Rode o db:push no ambiente atual.");
  }

  throw error instanceof Error ? error : new Error("Nao foi possivel carregar a area de suporte.");
}

export async function getSupportTickets(filters?: {
  search?: string;
  status?: SupportTicketStatus;
}) {
  try {
    const tickets = await listSupportTickets(filters);
    return {
      tickets,
      setupPending: false,
    };
  } catch (error) {
    if (isMissingSupportTicketTableError(error)) {
      console.warn("[SUPPORT] Tabela SupportTicket ainda nao existe neste banco.");
      return {
        tickets: [],
        setupPending: true,
      };
    }

    throw error;
  }
}

export async function createSupportTicketRecord(input: FormData, actor: { id?: string; name: string }) {
  const parsed = createSupportTicketSchema.parse({
    title: input.get("title"),
    description: input.get("description"),
    attachmentImage: input.get("attachmentImage"),
    priority: input.get("priority"),
  });

  let created: Awaited<ReturnType<typeof createSupportTicket>>;

  try {
    created = await createSupportTicket({
      ticketNumber: createTicketNumber(),
      title: parsed.title.trim(),
      description: parsed.description.trim(),
      attachmentImage: emptyToUndefined(parsed.attachmentImage),
      priority: parsed.priority,
      createdById: actor.id,
      createdByName: actor.name,
    });
  } catch (error) {
    ensureSupportStorageAvailable(error);
  }

  await createAuditLog({
    userId: actor.id,
    action: "support.ticket.create",
    entity: "SupportTicket",
    entityId: created.id,
    metadata: {
      ticketNumber: created.ticketNumber,
      priority: created.priority,
      status: created.status,
      hasAttachment: Boolean(created.attachmentImage),
    },
  });
}

export async function updateSupportTicketStatusRecord(input: FormData, actor: { id?: string; name: string }) {
  const parsed = updateSupportTicketStatusSchema.parse({
    ticketId: input.get("ticketId"),
    status: input.get("status"),
  });

  let updated: Awaited<ReturnType<typeof updateSupportTicketStatus>>;

  try {
    updated = await updateSupportTicketStatus({
      ticketId: parsed.ticketId,
      status: parsed.status,
      updatedById: actor.id,
      updatedByName: actor.name,
    });
  } catch (error) {
    ensureSupportStorageAvailable(error);
  }

  await createAuditLog({
    userId: actor.id,
    action: "support.ticket.status.update",
    entity: "SupportTicket",
    entityId: updated.id,
    metadata: {
      ticketNumber: updated.ticketNumber,
      status: updated.status,
    },
  });
}
