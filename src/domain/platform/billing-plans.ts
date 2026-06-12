import { PLATFORM_PLAN_NAMES, type PlatformPlanName } from "@/domain/platform/plan-entitlements";

export const PLATFORM_BILLING_CYCLES = [1, 3, 6, 12] as const;

export type PlatformBillingCycleMonths = (typeof PLATFORM_BILLING_CYCLES)[number];

type PlatformPlanPrice = {
  planName: PlatformPlanName;
  billingCycleMonths: PlatformBillingCycleMonths;
  label: string;
  amountCents: number;
  discountLabel?: string;
};

export const PLATFORM_PLAN_PRICES: PlatformPlanPrice[] = [
  { planName: "Ouro", billingCycleMonths: 1, label: "1 mês", amountCents: 9990 },
  { planName: "Ouro", billingCycleMonths: 3, label: "3 meses", amountCents: 26990, discountLabel: "-10%" },
  { planName: "Ouro", billingCycleMonths: 6, label: "6 meses", amountCents: 49990, discountLabel: "-17%" },
  { planName: "Ouro", billingCycleMonths: 12, label: "12 meses", amountCents: 89990, discountLabel: "-25%" },
  { planName: "Platina", billingCycleMonths: 1, label: "1 mês", amountCents: 14990 },
  { planName: "Platina", billingCycleMonths: 3, label: "3 meses", amountCents: 39990, discountLabel: "-11%" },
  { planName: "Platina", billingCycleMonths: 6, label: "6 meses", amountCents: 74990, discountLabel: "-17%" },
  { planName: "Platina", billingCycleMonths: 12, label: "12 meses", amountCents: 134990, discountLabel: "-25%" },
];

export function normalizePlatformPlanName(value: FormDataEntryValue | string | null | undefined): PlatformPlanName {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "platina") {
    return "Platina";
  }

  if (normalized === "ouro") {
    return "Ouro";
  }

  throw new Error(`Plano inválido. Use ${PLATFORM_PLAN_NAMES.join(" ou ")}.`);
}

export function normalizePlatformBillingCycle(value: FormDataEntryValue | string | number | null | undefined) {
  const parsed = Number(String(value ?? "").trim());

  if (PLATFORM_BILLING_CYCLES.includes(parsed as PlatformBillingCycleMonths)) {
    return parsed as PlatformBillingCycleMonths;
  }

  throw new Error("Duração do plano inválida.");
}

export function getPlatformPlanPrice(planName: PlatformPlanName, billingCycleMonths: PlatformBillingCycleMonths) {
  const price = PLATFORM_PLAN_PRICES.find(
    (item) => item.planName === planName && item.billingCycleMonths === billingCycleMonths,
  );

  if (!price) {
    throw new Error("Preço do plano não configurado.");
  }

  return price;
}

export function formatCentsToBRL(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
}

export function buildPlanExpirationFromCycle(billingCycleMonths: PlatformBillingCycleMonths, baseDate = new Date()) {
  const expiration = new Date(baseDate);
  expiration.setMonth(expiration.getMonth() + billingCycleMonths);
  expiration.setHours(23, 59, 59, 999);

  return expiration;
}
