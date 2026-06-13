import { AccountPayableStatus, Prisma } from "@prisma/client";

import {
  createAccountPayableSchema,
  updateAccountPayableStatusSchema,
  uploadAccountPayableReceiptSchema,
} from "@/domain/accounts/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  createAccountPayable,
  createAccountPayables,
  getAccountPayableSummary,
  hasPendingRecurringAccount,
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

function clampDayForMonth(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

function createMonthlyDueDate(day: number, monthsAhead = 0) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + monthsAhead;

  while (month > 11) {
    year += 1;
    month -= 12;
  }

  const dueDate = new Date(Date.UTC(year, month, clampDayForMonth(year, month, day), 12, 0, 0));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (monthsAhead === 0 && dueDate.getTime() < today.getTime()) {
    return createMonthlyDueDate(day, 1);
  }

  return dueDate;
}

function nextMonthlyDueDate(currentDueDate: Date, day: number) {
  const year = currentDueDate.getUTCFullYear();
  const month = currentDueDate.getUTCMonth() + 1;
  const nextYear = month > 11 ? year + 1 : year;
  const nextMonth = month > 11 ? 0 : month;
  return new Date(Date.UTC(nextYear, nextMonth, clampDayForMonth(nextYear, nextMonth, day), 12, 0, 0));
}

function ensureAccountStorageAvailable(error: unknown): never {
  if (isMissingAccountPayableTableError(error)) {
    throw new Error("Area de contas aguardando sincronizacao do banco. Rode o db:push no ambiente atual.");
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
    accountMode: input.get("accountMode"),
    dueDate: input.get("dueDate"),
    dueDay: input.get("dueDay"),
    installmentTotal: input.get("installmentTotal"),
    notes: input.get("notes"),
  });

  const amount = new Prisma.Decimal(parsed.amount).toDecimalPlaces(2);
  const isRecurringMonthly = parsed.accountMode === "RECURRING";
  const firstDueDate = isRecurringMonthly ? createMonthlyDueDate(parsed.dueDay ?? 1) : parseDateOnly(parsed.dueDate ?? "");
  const installmentTotal = isRecurringMonthly ? 1 : parsed.installmentTotal;
  const installments = Array.from({ length: installmentTotal }, (_, index) => ({
    name: parsed.name,
    amount,
    dueDate: addMonths(firstDueDate, index),
    isRecurringMonthly,
    dueDay: isRecurringMonthly ? parsed.dueDay : undefined,
    installmentNumber: index + 1,
    installmentTotal,
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
      mode: parsed.accountMode,
      dueDay: parsed.dueDay,
      installmentTotal,
      count: created.count,
    },
  });
}

async function createNextRecurringAccountIfNeeded(
  account: Awaited<ReturnType<typeof updateAccountPayableStatus>>,
  actor: { id?: string },
) {
  if (!account.isRecurringMonthly || !account.dueDay || account.status !== AccountPayableStatus.PAID) {
    return;
  }

  const nextDueDate = nextMonthlyDueDate(account.dueDate, account.dueDay);
  const alreadyExists = await hasPendingRecurringAccount({
    name: account.name,
    dueDate: nextDueDate,
    dueDay: account.dueDay,
  });

  if (alreadyExists) {
    return;
  }

  await createAccountPayable({
    name: account.name,
    amount: account.amount,
    dueDate: nextDueDate,
    isRecurringMonthly: true,
    dueDay: account.dueDay,
    installmentNumber: 1,
    installmentTotal: 1,
    notes: account.notes ?? undefined,
    createdById: actor.id,
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
    await createNextRecurringAccountIfNeeded(updated, actor);
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
    await createNextRecurringAccountIfNeeded(updated, actor);
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
