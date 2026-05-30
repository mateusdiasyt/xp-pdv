import { CashMovementType, CashSessionStatus, PaymentStatus, Prisma, RecordStatus, SaleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function listCashRegisters() {
  return prisma.cashRegister.findMany({
    where: {
      status: RecordStatus.ACTIVE,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function listCashSessions() {
  return prisma.cashSession.findMany({
    include: {
      cashRegister: true,
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      movements: true,
      sales: {
        select: {
          id: true,
          totalAmount: true,
          payments: {
            where: {
              status: PaymentStatus.APPROVED,
            },
            select: {
              method: true,
              amount: true,
            },
          },
        },
      },
    },
    orderBy: {
      openedAt: "desc",
    },
    take: 50,
  });
}

export async function listOpenCashSessions() {
  return prisma.cashSession.findMany({
    where: {
      status: CashSessionStatus.OPEN,
    },
    include: {
      cashRegister: true,
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      movements: true,
      sales: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
          payments: {
            where: {
              status: PaymentStatus.APPROVED,
            },
            select: {
              method: true,
              amount: true,
            },
          },
        },
      },
    },
    orderBy: {
      openedAt: "desc",
    },
  });
}

export async function getCashSessionForClosing(cashSessionId: string) {
  return prisma.cashSession.findUnique({
    where: { id: cashSessionId },
    include: {
      cashRegister: true,
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      movements: true,
      sales: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
          payments: {
            where: {
              status: PaymentStatus.APPROVED,
            },
            select: {
              method: true,
              amount: true,
            },
          },
        },
      },
    },
  });
}

export async function getCashSessionSnapshot(cashSessionId: string) {
  return prisma.cashSession.findUnique({
    where: { id: cashSessionId },
    include: {
      cashRegister: true,
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      movements: true,
      sales: {
        where: {
          status: SaleStatus.COMPLETED,
        },
        include: {
          payments: {
            where: {
              status: PaymentStatus.APPROVED,
            },
          },
        },
      },
    },
  });
}

export async function openCashSession(data: {
  cashRegisterId: string;
  operatorId: string;
  openingAmount: Prisma.Decimal;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existingOpenSession = await tx.cashSession.findFirst({
      where: {
        cashRegisterId: data.cashRegisterId,
        status: CashSessionStatus.OPEN,
      },
      select: {
        id: true,
      },
    });

    if (existingOpenSession) {
      throw new Error("Este caixa ja possui uma sessao em aberto.");
    }

    return tx.cashSession.create({
      data: {
        cashRegisterId: data.cashRegisterId,
        operatorId: data.operatorId,
        openingAmount: data.openingAmount,
        note: data.note,
      },
      include: {
        cashRegister: true,
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        movements: true,
        sales: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            payments: {
              where: {
                status: PaymentStatus.APPROVED,
              },
              select: {
                method: true,
                amount: true,
              },
            },
          },
        },
      },
    });
  });
}

export async function closeCashSession(data: {
  cashSessionId: string;
  expectedAmount: Prisma.Decimal;
  closingAmount: Prisma.Decimal;
  differenceAmount: Prisma.Decimal;
  note?: string;
}) {
  return prisma.cashSession.update({
    where: { id: data.cashSessionId },
    data: {
      status: CashSessionStatus.CLOSED,
      expectedAmount: data.expectedAmount,
      closingAmount: data.closingAmount,
      differenceAmount: data.differenceAmount,
      note: data.note,
      closedAt: new Date(),
    },
  });
}

export async function registerCashMovement(data: {
  cashSessionId: string;
  operatorId?: string;
  type: CashMovementType;
  amount: Prisma.Decimal;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findUniqueOrThrow({
      where: { id: data.cashSessionId },
      select: {
        id: true,
        status: true,
      },
    });

    if (session.status !== CashSessionStatus.OPEN) {
      throw new Error("Nao e possivel movimentar sessao de caixa fechada.");
    }

    return tx.cashMovement.create({
      data: {
        cashSessionId: data.cashSessionId,
        operatorId: data.operatorId,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
      },
    });
  });
}

export async function registerCashWithdrawal(data: {
  cashSessionId: string;
  operatorId?: string;
  amount: Prisma.Decimal;
  reason: string;
}) {
  return registerCashMovement({
    ...data,
    type: CashMovementType.WITHDRAWAL,
  });
}
