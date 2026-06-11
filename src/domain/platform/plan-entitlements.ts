export const PLATFORM_PLAN_NAMES = ["Ouro", "Platina"] as const;

export type PlatformPlanName = (typeof PLATFORM_PLAN_NAMES)[number];

export const PLATFORM_MODULES = {
  "fiscal-focus": {
    label: "Fiscal / Focus NFe",
    requiredPlan: "Platina",
  },
  "tv-app": {
    label: "App TV",
    requiredPlan: "Platina",
  },
  "custom-link": {
    label: "Link personalizado",
    requiredPlan: "Platina",
  },
} as const;

export type PlatformModuleKey = keyof typeof PLATFORM_MODULES;

export type TenantModuleEntitlements = {
  planName: PlatformPlanName | null;
  planStatus: string;
  planExpiresAt: string | null;
  activePlan: PlatformPlanName | null;
  modules: Record<PlatformModuleKey, boolean>;
};

type TenantPlanInput = {
  planName?: string | null;
  planStatus?: string | null;
  planExpiresAt?: Date | string | null;
};

const planRank: Record<PlatformPlanName, number> = {
  Ouro: 1,
  Platina: 2,
};

function normalizePlanName(value: string | null | undefined): PlatformPlanName | null {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "ouro") {
    return "Ouro";
  }

  if (normalized === "platina") {
    return "Platina";
  }

  return null;
}

function normalizeExpiration(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasMinimumPlan(activePlan: PlatformPlanName | null, requiredPlan: PlatformPlanName) {
  if (!activePlan) {
    return false;
  }

  return planRank[activePlan] >= planRank[requiredPlan];
}

export function resolveActivePlatformPlan(input: TenantPlanInput, now = new Date()): PlatformPlanName | null {
  const planName = normalizePlanName(input.planName);
  const planStatus = input.planStatus?.trim().toLowerCase();

  if (!planName || planStatus !== "active") {
    return null;
  }

  const planExpiresAt = normalizeExpiration(input.planExpiresAt);
  if (planExpiresAt && planExpiresAt.getTime() < now.getTime()) {
    return null;
  }

  return planName;
}

export function buildTenantModuleEntitlements(input: TenantPlanInput): TenantModuleEntitlements {
  const planName = normalizePlanName(input.planName);
  const planExpiresAt = normalizeExpiration(input.planExpiresAt);
  const activePlan = resolveActivePlatformPlan(input);

  return {
    planName,
    planStatus: input.planStatus?.trim().toLowerCase() || "pending",
    planExpiresAt: planExpiresAt ? planExpiresAt.toISOString() : null,
    activePlan,
    modules: {
      "fiscal-focus": hasMinimumPlan(activePlan, PLATFORM_MODULES["fiscal-focus"].requiredPlan),
      "tv-app": hasMinimumPlan(activePlan, PLATFORM_MODULES["tv-app"].requiredPlan),
      "custom-link": hasMinimumPlan(activePlan, PLATFORM_MODULES["custom-link"].requiredPlan),
    },
  };
}

export function canUsePlatformModule(entitlements: TenantModuleEntitlements, moduleKey: PlatformModuleKey) {
  return entitlements.modules[moduleKey];
}

export function getPlatformModuleRequiredPlan(moduleKey: PlatformModuleKey) {
  return PLATFORM_MODULES[moduleKey].requiredPlan;
}
