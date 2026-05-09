import { updateBrandCustomizationSchema } from "@/domain/customization/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  ensureBrandCustomizationTable,
  getLatestBrandCustomization,
  isMissingBrandCustomizationTableError,
  upsertBrandCustomization,
} from "@/infrastructure/db/repositories/brand-customization-repository";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

const dataUrlImagePrefixRegex = /^data:image\/[a-z0-9.+-]+;base64,/i;

const MAX_LOGO_DATA_URL_LENGTH = 700_000;
const MAX_FAVICON_DATA_URL_LENGTH = 220_000;

export const defaultBrandCustomization = {
  browserTitle: "Painel Maia | Sistema Administrativo",
  primaryColor: "#D4A62A",
  accentColor: "#B9882A",
  backgroundColor: "#0A0A0A",
  foregroundColor: "#F4EFE4",
  logoDataUrl: undefined as string | undefined,
  faviconDataUrl: undefined as string | undefined,
};

export type BrandCustomizationSnapshot = typeof defaultBrandCustomization & {
  updatedAt?: Date;
};

function normalizeHex(hexColor: string) {
  return hexColor.trim().toUpperCase();
}

function hexToRgb(hexColor: string): Rgb {
  const normalized = normalizeHex(hexColor).replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return {
    r,
    g,
    b,
  };
}

function rgbToHex(rgb: Rgb) {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

function mixHex(baseColor: string, mixColor: string, mixRatio: number) {
  const base = hexToRgb(baseColor);
  const mix = hexToRgb(mixColor);
  const ratio = Math.max(0, Math.min(1, mixRatio));

  return rgbToHex({
    r: Math.round(base.r * (1 - ratio) + mix.r * ratio),
    g: Math.round(base.g * (1 - ratio) + mix.g * ratio),
    b: Math.round(base.b * (1 - ratio) + mix.b * ratio),
  });
}

function contrastTextColor(backgroundColor: string) {
  const { r, g, b } = hexToRgb(backgroundColor);
  const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  return luminance > 0.58 ? "#101010" : "#F8F4EA";
}

function ensureBrandCustomizationStorageAvailable(error: unknown): never {
  if (isMissingBrandCustomizationTableError(error)) {
    throw new Error("Modulo de personalizacao aguardando sincronizacao do banco. Rode o db:push no ambiente atual.");
  }

  throw error instanceof Error ? error : new Error("Nao foi possivel carregar as configuracoes de personalizacao.");
}

function normalizeDataUrlImage(value: unknown, type: "logo" | "favicon") {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = emptyToUndefined(value);
  if (!normalized) {
    return null;
  }

  if (!dataUrlImagePrefixRegex.test(normalized)) {
    throw new Error(`Imagem de ${type} invalida. Envie um arquivo de imagem valido.`);
  }

  const maxLength = type === "logo" ? MAX_LOGO_DATA_URL_LENGTH : MAX_FAVICON_DATA_URL_LENGTH;
  if (normalized.length > maxLength) {
    throw new Error(`Imagem de ${type} muito grande. Use um arquivo menor para continuar.`);
  }

  return normalized;
}

export async function getBrandCustomizationSnapshot() {
  try {
    await ensureBrandCustomizationTable();
    const customization = await getLatestBrandCustomization();

    if (!customization) {
      return {
        customization: defaultBrandCustomization,
        setupPending: false,
      };
    }

    return {
      customization: {
        primaryColor: normalizeHex(customization.primaryColor),
        browserTitle: customization.browserTitle,
        accentColor: normalizeHex(customization.accentColor),
        backgroundColor: normalizeHex(customization.backgroundColor),
        foregroundColor: normalizeHex(customization.foregroundColor),
        logoDataUrl: customization.logoDataUrl ?? undefined,
        faviconDataUrl: customization.faviconDataUrl ?? undefined,
        updatedAt: customization.updatedAt,
      } satisfies BrandCustomizationSnapshot,
      setupPending: false,
    };
  } catch (error) {
    if (isMissingBrandCustomizationTableError(error)) {
      console.warn("[CUSTOMIZATION] Tabela BrandCustomization ausente. Tentando auto-bootstrap.");

      try {
        await ensureBrandCustomizationTable();
        const retriedCustomization = await getLatestBrandCustomization();

        if (!retriedCustomization) {
          return {
            customization: defaultBrandCustomization,
            setupPending: false,
          };
        }

        return {
          customization: {
            browserTitle: retriedCustomization.browserTitle,
            primaryColor: normalizeHex(retriedCustomization.primaryColor),
            accentColor: normalizeHex(retriedCustomization.accentColor),
            backgroundColor: normalizeHex(retriedCustomization.backgroundColor),
            foregroundColor: normalizeHex(retriedCustomization.foregroundColor),
            logoDataUrl: retriedCustomization.logoDataUrl ?? undefined,
            faviconDataUrl: retriedCustomization.faviconDataUrl ?? undefined,
            updatedAt: retriedCustomization.updatedAt,
          } satisfies BrandCustomizationSnapshot,
          setupPending: false,
        };
      } catch (bootstrapError) {
        console.error("[CUSTOMIZATION] Falha no auto-bootstrap da tabela BrandCustomization:", bootstrapError);
        return {
          customization: defaultBrandCustomization,
          setupPending: true,
        };
      }
    }

    throw error;
  }
}

export async function updateBrandCustomizationRecord(input: FormData, actor: { id?: string; name: string }) {
  const parsed = updateBrandCustomizationSchema.parse({
    browserTitle: input.get("browserTitle"),
    primaryColor: input.get("primaryColor"),
    accentColor: input.get("accentColor"),
    backgroundColor: input.get("backgroundColor"),
    foregroundColor: input.get("foregroundColor"),
    logoDataUrl: input.get("logoDataUrl"),
    faviconDataUrl: input.get("faviconDataUrl"),
  });

  const logoDataUrl = normalizeDataUrlImage(parsed.logoDataUrl, "logo");
  const faviconDataUrl = normalizeDataUrlImage(parsed.faviconDataUrl, "favicon");

  let updated: Awaited<ReturnType<typeof upsertBrandCustomization>>;
  try {
    await ensureBrandCustomizationTable();
    updated = await upsertBrandCustomization({
      browserTitle: parsed.browserTitle,
      primaryColor: normalizeHex(parsed.primaryColor),
      accentColor: normalizeHex(parsed.accentColor),
      backgroundColor: normalizeHex(parsed.backgroundColor),
      foregroundColor: normalizeHex(parsed.foregroundColor),
      logoDataUrl,
      faviconDataUrl,
      updatedById: actor.id,
      updatedByName: actor.name,
    });
  } catch (error) {
    ensureBrandCustomizationStorageAvailable(error);
  }

  await createAuditLog({
    userId: actor.id,
    action: "customization.brand.update",
    entity: "BrandCustomization",
    entityId: updated.id,
    metadata: {
      primaryColor: updated.primaryColor,
      browserTitle: updated.browserTitle,
      accentColor: updated.accentColor,
      backgroundColor: updated.backgroundColor,
      foregroundColor: updated.foregroundColor,
      hasLogo: Boolean(updated.logoDataUrl),
      hasFavicon: Boolean(updated.faviconDataUrl),
    },
  });
}

export function buildBrandThemeVariables(snapshot: Pick<
  BrandCustomizationSnapshot,
  "primaryColor" | "accentColor" | "backgroundColor" | "foregroundColor"
>) {
  const primaryColor = normalizeHex(snapshot.primaryColor);
  const accentColor = normalizeHex(snapshot.accentColor);
  const backgroundColor = normalizeHex(snapshot.backgroundColor);
  const foregroundColor = normalizeHex(snapshot.foregroundColor);

  return {
    "--background": backgroundColor,
    "--foreground": foregroundColor,
    "--card": mixHex(backgroundColor, "#FFFFFF", 0.045),
    "--card-foreground": foregroundColor,
    "--popover": mixHex(backgroundColor, "#FFFFFF", 0.065),
    "--popover-foreground": foregroundColor,
    "--primary": primaryColor,
    "--primary-foreground": contrastTextColor(primaryColor),
    "--secondary": mixHex(backgroundColor, "#FFFFFF", 0.085),
    "--secondary-foreground": mixHex(foregroundColor, backgroundColor, 0.12),
    "--muted": mixHex(backgroundColor, "#FFFFFF", 0.062),
    "--muted-foreground": mixHex(foregroundColor, backgroundColor, 0.48),
    "--accent": accentColor,
    "--accent-foreground": contrastTextColor(accentColor),
    "--border": mixHex(backgroundColor, foregroundColor, 0.16),
    "--input": mixHex(backgroundColor, foregroundColor, 0.17),
    "--ring": primaryColor,
    "--chart-1": primaryColor,
    "--chart-2": accentColor,
    "--chart-3": mixHex(accentColor, "#111111", 0.26),
    "--chart-4": mixHex(backgroundColor, "#111111", 0.25),
    "--chart-5": mixHex(primaryColor, "#FFFFFF", 0.28),
    "--sidebar": mixHex(backgroundColor, "#000000", 0.12),
    "--sidebar-foreground": foregroundColor,
    "--sidebar-primary": primaryColor,
    "--sidebar-primary-foreground": contrastTextColor(primaryColor),
    "--sidebar-accent": mixHex(backgroundColor, "#FFFFFF", 0.05),
    "--sidebar-accent-foreground": mixHex(foregroundColor, backgroundColor, 0.12),
    "--sidebar-border": mixHex(backgroundColor, foregroundColor, 0.14),
    "--sidebar-ring": primaryColor,
  } as Record<`--${string}`, string>;
}
