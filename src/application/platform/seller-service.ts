import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ensurePlatformBillingTables } from "@/application/platform/mercado-pago-billing-service";
import { formatCentsToBRL } from "@/domain/platform/billing-plans";
import { getPlatformPrisma } from "@/lib/prisma";

const sellerSessionCookieName = "mendoza_seller_session";
const sellerSessionMaxAgeSeconds = 60 * 60 * 24 * 30;

const createSellerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do vendedor."),
  email: z.string().trim().email("Informe um email valido.").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
  commissionPercent: z
    .string()
    .trim()
    .default("10")
    .transform((value) => Number(value.replace(",", ".")))
    .refine((value) => Number.isFinite(value) && value >= 0 && value <= 80, {
      message: "Comissao deve ficar entre 0% e 80%.",
    }),
  status: z.enum(["active", "inactive"]).default("active"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Informe um email valido.").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Informe a senha."),
});

const activeSubscriptionStatuses = new Set(["authorized", "active"]);

type SellerSessionPayload = {
  sellerId: string;
  email: string;
  exp: number;
};

function getSellerSessionSecret() {
  return process.env.NEXTAUTH_SECRET || process.env.FISCAL_ENCRYPTION_KEY || "mendoza-pdv-seller-session";
}

function signSellerPayload(payload: SellerSessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSellerSessionSecret()).update(body).digest("base64url");

  return `${body}.${signature}`;
}

function verifySellerSessionToken(token: string | undefined): SellerSessionPayload | null {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getSellerSessionSecret()).update(body).digest("base64url");
  const providedSignature = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (providedSignature.length !== expected.length || !timingSafeEqual(providedSignature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SellerSessionPayload;

    if (!payload.sellerId || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function calculateCommissionCents(amountCents: number, commissionBps: number | null | undefined) {
  return Math.round((amountCents * (commissionBps ?? 0)) / 10000);
}

function formatPercentFromBps(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export async function createPlatformSellerFromForm(formData: FormData) {
  await ensurePlatformBillingTables();

  const parsed = createSellerSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    commissionPercent: formData.get("commissionPercent") ?? "10",
    status: formData.get("status") || "active",
  });

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  return getPlatformPrisma().platformSeller.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      commissionBps: Math.round(parsed.commissionPercent * 100),
      status: parsed.status,
    },
  });
}

export async function updatePlatformSellerStatusFromForm(formData: FormData) {
  await ensurePlatformBillingTables();

  const sellerId = String(formData.get("sellerId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!sellerId || !["active", "inactive"].includes(status)) {
    throw new Error("Vendedor invalido.");
  }

  await getPlatformPrisma().platformSeller.update({
    where: { id: sellerId },
    data: { status },
  });
}

export async function authenticatePlatformSeller(formData: FormData) {
  await ensurePlatformBillingTables();

  const parsed = loginSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const seller = await getPlatformPrisma().platformSeller.findUnique({
    where: { email: parsed.email },
  });

  if (!seller || seller.status !== "active") {
    throw new Error("Vendedor nao encontrado ou inativo.");
  }

  const isValid = await bcrypt.compare(parsed.password, seller.passwordHash);

  if (!isValid) {
    throw new Error("Credenciais invalidas.");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    sellerSessionCookieName,
    signSellerPayload({
      sellerId: seller.id,
      email: seller.email,
      exp: Math.floor(Date.now() / 1000) + sellerSessionMaxAgeSeconds,
    }),
    {
      httpOnly: true,
      maxAge: sellerSessionMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );

  return seller;
}

export async function clearPlatformSellerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sellerSessionCookieName);
}

export async function getCurrentPlatformSeller() {
  await ensurePlatformBillingTables();

  const cookieStore = await cookies();
  const payload = verifySellerSessionToken(cookieStore.get(sellerSessionCookieName)?.value);

  if (!payload) {
    return null;
  }

  const seller = await getPlatformPrisma().platformSeller.findUnique({
    where: { id: payload.sellerId },
  });

  if (!seller || seller.status !== "active") {
    return null;
  }

  return seller;
}

export async function requirePlatformSeller() {
  const seller = await getCurrentPlatformSeller();

  if (!seller) {
    redirect("/seller/login");
  }

  return seller;
}

export async function listPlatformSellersWithStats() {
  await ensurePlatformBillingTables();

  const sellers = await getPlatformPrisma().platformSeller.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      subscriptions: {
        orderBy: [{ createdAt: "desc" }],
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              ownerEmail: true,
            },
          },
        },
      },
    },
  });

  return sellers.map((seller) => {
    const confirmedSubscriptions = seller.subscriptions.filter((subscription) =>
      activeSubscriptionStatuses.has(subscription.status),
    );
    const pendingCommissions = confirmedSubscriptions.filter(
      (subscription) => subscription.sellerCommissionStatus !== "paid",
    );
    const pendingCommissionCents = pendingCommissions.reduce(
      (sum, subscription) =>
        sum +
        (subscription.sellerCommissionCents ??
          calculateCommissionCents(subscription.amountCents, subscription.sellerCommissionBps ?? seller.commissionBps)),
      0,
    );
    const grossCents = confirmedSubscriptions.reduce((sum, subscription) => sum + subscription.amountCents, 0);

    return {
      id: seller.id,
      name: seller.name,
      email: seller.email,
      status: seller.status,
      commissionBps: seller.commissionBps,
      commissionLabel: `${formatPercentFromBps(seller.commissionBps)}%`,
      generatedLinks: seller.subscriptions.length,
      confirmedSales: confirmedSubscriptions.length,
      grossLabel: formatCentsToBRL(grossCents),
      pendingCommissionLabel: formatCentsToBRL(pendingCommissionCents),
      recentSubscriptions: seller.subscriptions.slice(0, 5).map((subscription) => ({
        id: subscription.id,
        tenantName: subscription.tenant.name,
        tenantSlug: subscription.tenant.slug,
        planName: subscription.planName,
        billingCycleMonths: subscription.billingCycleMonths,
        amountLabel: formatCentsToBRL(subscription.amountCents),
        commissionLabel: formatCentsToBRL(
          subscription.sellerCommissionCents ??
            calculateCommissionCents(subscription.amountCents, subscription.sellerCommissionBps ?? seller.commissionBps),
        ),
        status: subscription.status,
        createdAt: subscription.createdAt,
      })),
    };
  });
}

export async function getPlatformSellerDashboard(sellerId: string) {
  await ensurePlatformBillingTables();

  const [seller, tenants] = await Promise.all([
    getPlatformPrisma().platformSeller.findUnique({
      where: { id: sellerId },
      include: {
        subscriptions: {
          orderBy: [{ createdAt: "desc" }],
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                ownerEmail: true,
              },
            },
          },
        },
      },
    }),
    getPlatformPrisma().platformTenant.findMany({
      where: {
        status: {
          not: "SUSPENDED",
        },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        ownerEmail: true,
        status: true,
      },
    }),
  ]);

  if (!seller) {
    throw new Error("Vendedor nao encontrado.");
  }

  const confirmedSubscriptions = seller.subscriptions.filter((subscription) =>
    activeSubscriptionStatuses.has(subscription.status),
  );
  const grossCents = confirmedSubscriptions.reduce((sum, subscription) => sum + subscription.amountCents, 0);
  const pendingCommissionCents = confirmedSubscriptions.reduce(
    (sum, subscription) =>
      sum +
      (subscription.sellerCommissionCents ??
        calculateCommissionCents(subscription.amountCents, subscription.sellerCommissionBps ?? seller.commissionBps)),
    0,
  );

  return {
    seller: {
      id: seller.id,
      name: seller.name,
      email: seller.email,
      commissionLabel: `${formatPercentFromBps(seller.commissionBps)}%`,
    },
    stats: {
      generatedLinks: seller.subscriptions.length,
      confirmedSales: confirmedSubscriptions.length,
      grossLabel: formatCentsToBRL(grossCents),
      pendingCommissionLabel: formatCentsToBRL(pendingCommissionCents),
    },
    tenants,
    recentSubscriptions: seller.subscriptions.slice(0, 12).map((subscription) => ({
      id: subscription.id,
      tenantName: subscription.tenant.name,
      tenantSlug: subscription.tenant.slug,
      planName: subscription.planName,
      billingCycleMonths: subscription.billingCycleMonths,
      amountLabel: formatCentsToBRL(subscription.amountCents),
      commissionLabel: formatCentsToBRL(
        subscription.sellerCommissionCents ??
          calculateCommissionCents(subscription.amountCents, subscription.sellerCommissionBps ?? seller.commissionBps),
      ),
      status: subscription.status,
      initPoint: subscription.mercadoPagoInitPoint,
      createdAt: subscription.createdAt,
    })),
  };
}
