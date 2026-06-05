import { AccountPayableStatus, Prisma } from "@prisma/client";

import {
  createAccountPayableSchema,
  updateAccountPayableStatusSchema,
  uploadAccountPayableReceiptSchema,
} from "@/domain/accounts/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  createAccountPayables,
  getAccountPayableSummary,
  isMissingAccountPayableTableError,
  listAccountPayables,
  updateAccountPayableStatus,
  uploadAccountPayableReceipt,
} from "@/infrastructure/db/repositories/account-payable-repository";

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
  return nextDate;
}

function ensureAccountStorageAvailable(error: unknown): never {
  if (isMissingAccountPayableTableError(error)) {
    throw new Error("Modulo de contas aguardando sincronizacao do banco. Rode o db:push no ambiente atual.");
  }

  throw error instanceof Error ? error : new Error("Nao foi possivel carregar contas.");
}

export async function getAccountsData(filters?: {
  search?: string;
  status?: AccountPayableStatus;
  dueSoon?: boolean;
}) {
  try {
    const [accounts, summary] = await Promise.all([listAccountPayables(filters), getAccountPayableSummary()]);
    return {
      accounts,
      summary,
      setupPending: false,
    };
  } catch (error) {
    if (isMissingAccountPayableTableError(error)) {
      console.warn("[ACCOUNTS] Tabela AccountPayable ainda nao existe neste banco.");
      return {
        accounts: [],
        summary: null,
        setupPending: true,
      };
    }

    throw error;
  }
}

export async function getAccountNotificationData() {
  try {
    const summary = await getAccountPayableSummary();
    return {
      count: summary.overdue._count + summary.dueSoon._count,
      overdueCount: summary.overdue._count,
      dueSoonCount: summary.dueSoon._count,
      items: summary.upcomingItems,
      setupPending: false,
    };
  } catch (error) {
    if (isMissingAccountPayableTableError(error)) {
      return {
        count: 0,
        overdueCount: 0,
        dueSoonCount: 0,
        items: [],
        setupPending: true,
      };
    }

    throw error;
  }
}

export async function createAccountPayableRecord(input: FormData, actor: { id?: string }) {
  const parsed = createAccountPayableSchema.parse({
    name: input.get("name"),
    amount: input.get("amount"),
    dueDate: input.get("dueDate"),
    installmentTotal: input.get("installmentTotal"),
    notes: input.get("notes"),
  });

  const firstDueDate = parseDateOnly(parsed.dueDate);
  const installments = Array.from({ length: parsed.installmentTotal }, (_, index) => ({
    name: parsed.name,
    amount: new Prisma.Decimal(parsed.amount).toDecimalPlaces(2),
    dueDate: addMonths(firstDueDate, index),
    installmentNumber: index + 1,
    installmentTotal: parsed.installmentTotal,
    notes: emptyToUndefined(parsed.notes),
    createdById: actor.id,
  }));

  let created: Awaited<ReturnType<typeof createAccountPayables>>;

  try {
    created = await createAccountPayables(installments);
  } catch (error) {
    ensureAccountStorageAvailable(error);
  }

  await createAuditLog({
    userId: actor.id,
    action: "account_payable.create",
    entity: "AccountPayable",
    metadata: {
      name: parsed.name,
      amount: parsed.amount,
      installmentTotal: parsed.installmentTotal,
      count: created.count,
    },
  });
}

export async function updateAccountPayableStatusRecord(input: FormData, actor: { id?: string }) {
  const parsed = updateAccountPayableStatusSchema.parse({
    accountId: input.get("accountId"),
    status: input.get("status"),
  });

  let updated: Awaited<ReturnType<typeof updateAccountPayableStatus>>;

  try {
    updated = await updateAccountPayableStatus({
      accountId: parsed.accountId,
      status: parsed.status,
      updatedById: actor.id,
    });
  } catch (error) {
    ensureAccountStorageAvailable(error);
  }

  await createAuditLog({
    userId: actor.id,
    action: "account_payable.status.update",
    entity: "AccountPayable",
    entityId: updated.id,
    metadata: {
      status: updated.status,
      dueDate: updated.dueDate,
    },
  });
}

export async function uploadAccountPayableReceiptRecord(input: FormData, actor: { id?: string }) {
  const parsed = uploadAccountPayableReceiptSchema.parse({
    accountId: input.get("accountId"),
    receiptDataUrl: input.get("receiptDataUrl"),
    receiptFileName: input.get("receiptFileName"),
    receiptMimeType: input.get("receiptMimeType"),
  });

  let updated: Awaited<ReturnType<typeof uploadAccountPayableReceipt>>;

  try {
    updated = await uploadAccountPayableReceipt({
      accountId: parsed.accountId,
      receiptDataUrl: parsed.receiptDataUrl,
      receiptFileName: emptyToUndefined(parsed.receiptFileName),
      receiptMimeType: emptyToUndefined(parsed.receiptMimeType),
      updatedById: actor.id,
    });
  } catch (error) {
    ensureAccountStorageAvailable(error);
  }

  await createAuditLog({
    userId: actor.id,
    action: "account_payable.receipt.upload",
    entity: "AccountPayable",
    entityId: updated.id,
    metadata: {
      fileName: updated.receiptFileName,
      mimeType: updated.receiptMimeType,
    },
  });
}
