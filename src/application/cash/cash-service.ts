import { CashMovementType, PaymentMethod, Prisma } from "@prisma/client";

import {
  closeCashSessionSchema,
  openCashSessionSchema,
  registerCashMovementSchema,
  registerCashWithdrawalSchema,
} from "@/domain/cash/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { parseDecimalInput } from "@/lib/decimal";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  closeCashSession,
  getCashSessionSnapshot,
  getCashSessionForClosing,
  listCashRegisters,
  listCashSessions,
  listOpenCashSessions,
  openCashSession,
  registerCashMovement,
  registerCashWithdrawal,
} from "@/infrastructure/db/repositories/cash-repository";
import { listCashAuditLogs as listCashAuditLogsRepository } from "@/infrastructure/db/repositories/audit-log-repository";

type DecimalLike = {
  toString(): string;
};

type CashSummarySource = {
  id: string;
  status: string;
  openingAmount: DecimalLike;
  expectedAmount?: DecimalLike | null;
  closingAmount?: DecimalLike | null;
  differenceAmount?: DecimalLike | null;
  note?: string | null;
  openedAt: Date;
  closedAt?: Date | null;
  cashRegister: {
    id: string;
    name: string;
    code: string;
  };
  operator: {
    id: string;
    name: string;
    email?: string | null;
  };
  movements: Array<{
    id: string;
    type: CashMovementType;
    amount: DecimalLike;
    reason: string;
    createdAt: Date;
  }>;
  sales: Array<{
    id: string;
    status?: string;
    totalAmount: DecimalLike;
    payments: Array<{
      method: PaymentMethod;
      amount: DecimalLike;
    }>;
  }>;
};

function decimalToNumber(value?: DecimalLike | null) {
  return value ? Number(value.toString()) : 0;
}

export function buildCashSessionSummary(session: CashSummarySource) {
  const cashSalesAmount = session.sales.reduce((total, sale) => {
    const cashPayments = sale.payments
      .filter((payment) => payment.method === PaymentMethod.CASH)
      .reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0);

    return total + cashPayments;
  }, 0);
  const withdrawalAmount = session.movements
    .filter((movement) => movement.type === CashMovementType.WITHDRAWAL)
    .reduce((total, movement) => total + decimalToNumber(movement.amount), 0);
  const supplyAmount = session.movements
    .filter((movement) => movement.type === CashMovementType.SUPPLY)
    .reduce((total, movement) => total + decimalToNumber(movement.amount), 0);
  const openingAmount = decimalToNumber(session.openingAmount);
  const expectedAmount =
    session.expectedAmount !== null && session.expectedAmount !== undefined
      ? decimalToNumber(session.expectedAmount)
      : openingAmount + cashSalesAmount + supplyAmount - withdrawalAmount;
  const paymentTotals = Object.values(PaymentMethod).map((method) => ({
    method,
    amount: session.sales.reduce((total, sale) => {
      const methodTotal = sale.payments
        .filter((payment) => payment.method === method)
        .reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0);

      return total + methodTotal;
    }, 0),
  }));

  return {
    id: session.id,
    status: session.status,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    openingAmount,
    cashSalesAmount,
    supplyAmount,
    withdrawalAmount,
    expectedAmount,
    closingAmount: session.closingAmount ? decimalToNumber(session.closingAmount) : null,
    differenceAmount: session.differenceAmount ? decimalToNumber(session.differenceAmount) : null,
    note: session.note ?? "",
    salesCount: session.sales.length,
    salesTotalAmount: session.sales.reduce((total, sale) => total + decimalToNumber(sale.totalAmount), 0),
    paymentTotals,
    cashRegister: {
      id: session.cashRegister.id,
      name: session.cashRegister.name,
      code: session.cashRegister.code,
    },
    operator: {
      id: session.operator.id,
      name: session.operator.name,
      email: session.operator.email ?? "",
    },
    movements: session.movements
      .map((movement) => ({
        id: movement.id,
        type: movement.type,
        amount: decimalToNumber(movement.amount),
        reason: movement.reason,
        createdAt: movement.createdAt.toISOString(),
      }))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
  };
}

export async function getCashManagementData() {
  const [registers, sessions, openSessions] = await Promise.all([
    listCashRegisters(),
    listCashSessions(),
    listOpenCashSessions(),
  ]);

  return { registers, sessions, openSessions };
}

export async function getCashAuditLogs(search?: string) {
  const logs = await listCashAuditLogsRepository();
  const normalizedSearch = search?.trim().toLowerCase();

  if (!normalizedSearch) {
    return logs;
  }

  return logs.filter((log) => {
    const metadataText = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : "";
    return [
      log.action,
      log.entity,
      log.entityId ?? "",
      log.user?.name ?? "",
      log.user?.email ?? "",
      metadataText,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });
}

export async function openCashSessionRecord(input: FormData, actorId: string) {
  const parsed = openCashSessionSchema.parse({
    cashRegisterId: input.get("cashRegisterId"),
    operatorId: input.get("operatorId"),
    openingAmount: input.get("openingAmount"),
    note: input.get("note"),
  });

  const openingAmount = parseDecimalInput(parsed.openingAmount);
  if (openingAmount.lessThan(0)) {
    throw new Error("Valor de abertura nao pode ser negativo.");
  }

  const created = await openCashSession({
    cashRegisterId: parsed.cashRegisterId,
    operatorId: parsed.operatorId,
    openingAmount,
    note: emptyToUndefined(parsed.note),
  });

  await createAuditLog({
    userId: actorId,
    action: "cash.session.open",
    entity: "CashSession",
    entityId: created.id,
    metadata: {
      cashRegisterId: created.cashRegisterId,
      operatorId: parsed.operatorId,
      openingAmount: openingAmount.toString(),
    },
  });

  return buildCashSessionSummary(created);
}

export async function registerCashMovementRecord(input: FormData, actorId: string) {
  const parsed = registerCashMovementSchema.parse({
    cashSessionId: input.get("cashSessionId"),
    type: input.get("type"),
    amount: input.get("amount"),
    reason: input.get("reason"),
  });

  const amount = parseDecimalInput(parsed.amount);
  if (amount.lessThanOrEqualTo(0)) {
    throw new Error("Valor da movimentacao deve ser maior que zero.");
  }

  const movement = await registerCashMovement({
    cashSessionId: parsed.cashSessionId,
    operatorId: actorId,
    type: parsed.type as CashMovementType,
    amount,
    reason: parsed.reason.trim(),
  });

  await createAuditLog({
    userId: actorId,
    action: parsed.type === CashMovementType.SUPPLY ? "cash.supply.create" : "cash.withdrawal.create",
    entity: "CashMovement",
    entityId: movement.id,
    metadata: {
      cashSessionId: parsed.cashSessionId,
      type: parsed.type,
      amount: amount.toString(),
    },
  });

  const session = await getCashSessionSnapshot(parsed.cashSessionId);
  if (!session) {
    throw new Error("Sessao de caixa nao encontrada.");
  }

  return buildCashSessionSummary(session);
}

export async function registerCashWithdrawalRecord(input: FormData, actorId: string) {
  const parsed = registerCashWithdrawalSchema.parse({
    cashSessionId: input.get("cashSessionId"),
    type: "WITHDRAWAL",
    amount: input.get("amount"),
    reason: input.get("reason"),
  });

  const amount = parseDecimalInput(parsed.amount);
  if (amount.lessThanOrEqualTo(0)) {
    throw new Error("Valor de sangria deve ser maior que zero.");
  }

  const movement = await registerCashWithdrawal({
    cashSessionId: parsed.cashSessionId,
    operatorId: actorId,
    amount,
    reason: parsed.reason.trim(),
  });

  await createAuditLog({
    userId: actorId,
    action: "cash.withdrawal.create",
    entity: "CashMovement",
    entityId: movement.id,
    metadata: {
      cashSessionId: parsed.cashSessionId,
      type: CashMovementType.WITHDRAWAL,
      amount: amount.toString(),
    },
  });

  const session = await getCashSessionSnapshot(parsed.cashSessionId);
  if (!session) {
    throw new Error("Sessao de caixa nao encontrada.");
  }

  return buildCashSessionSummary(session);
}

export async function closeCashSessionRecord(input: FormData, actorId: string) {
  const parsed = closeCashSessionSchema.parse({
    cashSessionId: input.get("cashSessionId"),
    closingAmount: input.get("closingAmount"),
    note: input.get("note"),
  });

  const closingAmount = parseDecimalInput(parsed.closingAmount);
  if (closingAmount.lessThan(0)) {
    throw new Error("Valor de fechamento nao pode ser negativo.");
  }

  const session = await getCashSessionForClosing(parsed.cashSessionId);
  if (!session) {
    throw new Error("Sessao de caixa nao encontrada.");
  }

  if (session.status !== "OPEN") {
    throw new Error("A sessao selecionada ja esta fechada.");
  }

  const cashSalesTotal = session.sales.reduce((acc, sale) => {
    const cashPayments = sale.payments
      .filter((payment) => payment.method === PaymentMethod.CASH)
      .reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
    return acc.plus(cashPayments);
  }, new Prisma.Decimal(0));

  const withdrawalsTotal = session.movements
    .filter((movement) => movement.type === CashMovementType.WITHDRAWAL)
    .reduce((acc, movement) => acc.plus(movement.amount), new Prisma.Decimal(0));
  const suppliesTotal = session.movements
    .filter((movement) => movement.type === CashMovementType.SUPPLY)
    .reduce((acc, movement) => acc.plus(movement.amount), new Prisma.Decimal(0));

  const expectedAmount = session.openingAmount.plus(cashSalesTotal).plus(suppliesTotal).minus(withdrawalsTotal);
  const differenceAmount = closingAmount.minus(expectedAmount);

  const closed = await closeCashSession({
    cashSessionId: parsed.cashSessionId,
    expectedAmount,
    closingAmount,
    differenceAmount,
    note: emptyToUndefined(parsed.note),
  });

  await createAuditLog({
    userId: actorId,
    action: "cash.session.close",
    entity: "CashSession",
    entityId: closed.id,
    metadata: {
      expectedAmount: expectedAmount.toString(),
      closingAmount: closingAmount.toString(),
      differenceAmount: differenceAmount.toString(),
    },
  });

  const closedSnapshot = await getCashSessionSnapshot(parsed.cashSessionId);
  if (!closedSnapshot) {
    throw new Error("Sessao de caixa nao encontrada apos fechamento.");
  }

  return buildCashSessionSummary(closedSnapshot);
}
