import { AccountPayableStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type AccountPayableFilters = {
  search?: string;
  status?: AccountPayableStatus;
  dueSoon?: boolean;
};

export function isMissingAccountPayableTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" && String(error.meta?.table ?? "").includes("AccountPayable");
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("accountpayable") && message.includes("does not exist");
  }

  return false;
}

function dueSoonRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 5);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export async function listAccountPayables(filters?: AccountPayableFilters) {
  const range = filters?.dueSoon ? dueSoonRange() : null;

  return prisma.accountPayable.findMany({
    where: {
      status: filters?.status,
      ...(range
        ? {
            dueDate: {
              lte: range.end,
            },
          }
        : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { notes: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [
      {
        status: "asc",
      },
      {
        dueDate: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function getAccountPayableSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const soonEnd = new Date(today);
  soonEnd.setDate(soonEnd.getDate() + 5);
  soonEnd.setHours(23, 59, 59, 999);

  const [pending, paid, overdue, dueSoon, upcomingItems] = await Promise.all([
    prisma.accountPayable.aggregate({
      where: {
        status: AccountPayableStatus.PENDING,
      },
      _count: true,
      _sum: {
        amount: true,
      },
    }),
    prisma.accountPayable.aggregate({
      where: {
        status: AccountPayableStatus.PAID,
      },
      _count: true,
      _sum: {
        amount: true,
      },
    }),
    prisma.accountPayable.aggregate({
      where: {
        status: AccountPayableStatus.PENDING,
        dueDate: {
          lt: today,
        },
      },
      _count: true,
      _sum: {
        amount: true,
      },
    }),
    prisma.accountPayable.aggregate({
      where: {
        status: AccountPayableStatus.PENDING,
        dueDate: {
          gte: today,
          lte: soonEnd,
        },
      },
      _count: true,
      _sum: {
        amount: true,
      },
    }),
    prisma.accountPayable.findMany({
      where: {
        status: AccountPayableStatus.PENDING,
        dueDate: {
          lte: soonEnd,
        },
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 5,
    }),
  ]);

  return {
    pending,
    paid,
    overdue,
    dueSoon,
    upcomingItems,
  };
}

export async function createAccountPayables(
  data: Array<{
    name: string;
    amount: Prisma.Decimal;
    dueDate: Date;
    isRecurringMonthly?: boolean;
    dueDay?: number;
    installmentNumber: number;
    installmentTotal: number;
    notes?: string;
    createdById?: string;
  }>,
) {
  return prisma.accountPayable.createMany({
    data,
  });
}

export async function createAccountPayable(data: {
  name: string;
  amount: Prisma.Decimal;
  dueDate: Date;
  isRecurringMonthly?: boolean;
  dueDay?: number;
  installmentNumber?: number;
  installmentTotal?: number;
  notes?: string;
  createdById?: string;
}) {
  return prisma.accountPayable.create({
    data,
  });
}

export async function updateAccountPayableStatus(data: {
  accountId: string;
  status: AccountPayableStatus;
  updatedById?: string;
}) {
  return prisma.accountPayable.update({
    where: {
      id: data.accountId,
    },
    data: {
      status: data.status,
      updatedById: data.updatedById,
      paidAt: data.status === AccountPayableStatus.PAID ? new Date() : null,
    },
  });
}

export async function hasPendingRecurringAccount(data: { name: string; dueDate: Date; dueDay: number }) {
  const existing = await prisma.accountPayable.findFirst({
    where: {
      name: data.name,
      dueDate: data.dueDate,
      dueDay: data.dueDay,
      isRecurringMonthly: true,
      status: AccountPayableStatus.PENDING,
    },
    select: {
      id: true,
    },
  });

  return Boolean(existing);
}

export async function uploadAccountPayableReceipt(data: {
  accountId: string;
  receiptDataUrl: string;
  receiptFileName?: string;
  receiptMimeType?: string;
  updatedById?: string;
}) {
  return prisma.accountPayable.update({
    where: {
      id: data.accountId,
    },
    data: {
      receiptDataUrl: data.receiptDataUrl,
      receiptFileName: data.receiptFileName,
      receiptMimeType: data.receiptMimeType,
      status: AccountPayableStatus.PAID,
      paidAt: new Date(),
      updatedById: data.updatedById,
    },
  });
}
