import { updateFiscalConfigurationSchema, type FiscalEnvironment } from "@/domain/fiscal/schemas";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  getFiscalConfiguration,
  isMissingFiscalConfigurationTableError,
  upsertFiscalConfiguration,
} from "@/infrastructure/db/repositories/fiscal-configuration-repository";
import { decryptSecretValue, encryptSecretValue } from "@/lib/secret-crypto";

const fallbackEnvironment: FiscalEnvironment = "homologacao";

function normalizeEnvironment(rawValue: string | null | undefined): FiscalEnvironment {
  const normalized = String(rawValue ?? "").trim().toLowerCase();
  return normalized.startsWith("prod") ? "producao" : "homologacao";
}

function normalizeDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") || undefined;
}

function emptyToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function decryptConfiguredSecret(value: string | null | undefined, label: string) {
  if (!value) {
    return undefined;
  }

  try {
    return decryptSecretValue(value) ?? undefined;
  } catch (error) {
    console.error(`[FISCAL] Falha ao descriptografar ${label}. Usando fallback por variavel quando existir.`, error);
    return undefined;
  }
}

function getFocusBaseUrl(environment: FiscalEnvironment) {
  return environment === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

export function getFiscalEnvironmentFallbackFromEnv(): FiscalEnvironment {
  return normalizeEnvironment(process.env.FOCUS_NFE_ENV);
}

export async function resolveFiscalEnvironment(): Promise<FiscalEnvironment> {
  try {
    const configuration = await getFiscalConfiguration();
    if (!configuration) {
      return getFiscalEnvironmentFallbackFromEnv();
    }

    return normalizeEnvironment(configuration.environment);
  } catch (error) {
    if (isMissingFiscalConfigurationTableError(error)) {
      return getFiscalEnvironmentFallbackFromEnv();
    }

    console.error("[FISCAL] Falha ao resolver ambiente fiscal. Aplicando fallback:", error);
    return getFiscalEnvironmentFallbackFromEnv();
  }
}

export async function getFiscalEnvironmentSnapshot() {
  const fallbackEnvironment = getFiscalEnvironmentFallbackFromEnv();

  try {
    const configuration = await getFiscalConfiguration();
    return {
      environment: configuration ? normalizeEnvironment(configuration.environment) : fallbackEnvironment,
      persisted: Boolean(configuration),
      setupPending: false,
    };
  } catch (error) {
    if (isMissingFiscalConfigurationTableError(error)) {
      return {
        environment: getFiscalEnvironmentFallbackFromEnv(),
        persisted: false,
        setupPending: true,
      };
    }

    throw error;
  }
}

export async function getFiscalSettingsSnapshot() {
  const fallbackEnvironment = getFiscalEnvironmentFallbackFromEnv();
  const envTokenHomolog = process.env.FOCUS_NFE_TOKEN_HOMOLOG?.trim();
  const envTokenProduction = process.env.FOCUS_NFE_TOKEN_PROD?.trim();
  const encryptionReady = Boolean(process.env.FISCAL_ENCRYPTION_KEY?.trim());

  try {
    const configuration = await getFiscalConfiguration();
    const environment = configuration ? normalizeEnvironment(configuration.environment) : fallbackEnvironment;

    return {
      environment,
      persisted: Boolean(configuration),
      setupPending: false,
      encryptionReady,
      cnpjEmitente:
        configuration?.cnpjEmitente ??
        normalizeDigits(process.env.FOCUS_NFCE_CNPJ_EMITENTE ?? process.env.FOCUS_NFE_CNPJ_EMITENTE) ??
        "",
      defaultNcm:
        configuration?.defaultNcm ??
        normalizeDigits(process.env.FOCUS_NFCE_NCM_PADRAO ?? process.env.FOCUS_NFE_NCM_PADRAO) ??
        "",
      tokenHomologConfigured: Boolean(configuration?.tokenHomologEncrypted || envTokenHomolog),
      tokenProductionConfigured: Boolean(configuration?.tokenProductionEncrypted || envTokenProduction),
      tokenHomologSource: configuration?.tokenHomologEncrypted
        ? ("database" as const)
        : envTokenHomolog
          ? ("environment" as const)
          : ("missing" as const),
      tokenProductionSource: configuration?.tokenProductionEncrypted
        ? ("database" as const)
        : envTokenProduction
          ? ("environment" as const)
          : ("missing" as const),
      nfceHomologSeries: configuration?.nfceHomologSeries ?? "",
      nfceHomologNextNumber: configuration?.nfceHomologNextNumber?.toString() ?? "",
      nfceHomologIdToken: configuration?.nfceHomologIdToken ?? "",
      nfceHomologCscConfigured: Boolean(configuration?.nfceHomologCscEncrypted),
      nfceProductionSeries: configuration?.nfceProductionSeries ?? "",
      nfceProductionNextNumber: configuration?.nfceProductionNextNumber?.toString() ?? "",
      nfceProductionIdToken: configuration?.nfceProductionIdToken ?? "",
      nfceProductionCscConfigured: Boolean(configuration?.nfceProductionCscEncrypted),
    };
  } catch (error) {
    if (isMissingFiscalConfigurationTableError(error)) {
      return {
        environment: fallbackEnvironment,
        persisted: false,
        setupPending: true,
        encryptionReady,
        cnpjEmitente: normalizeDigits(process.env.FOCUS_NFCE_CNPJ_EMITENTE ?? process.env.FOCUS_NFE_CNPJ_EMITENTE) ?? "",
        defaultNcm: normalizeDigits(process.env.FOCUS_NFCE_NCM_PADRAO ?? process.env.FOCUS_NFE_NCM_PADRAO) ?? "",
        tokenHomologConfigured: Boolean(envTokenHomolog),
        tokenProductionConfigured: Boolean(envTokenProduction),
        tokenHomologSource: envTokenHomolog ? ("environment" as const) : ("missing" as const),
        tokenProductionSource: envTokenProduction ? ("environment" as const) : ("missing" as const),
        nfceHomologSeries: "",
        nfceHomologNextNumber: "",
        nfceHomologIdToken: "",
        nfceHomologCscConfigured: false,
        nfceProductionSeries: "",
        nfceProductionNextNumber: "",
        nfceProductionIdToken: "",
        nfceProductionCscConfigured: false,
      };
    }

    throw error;
  }
}

export async function resolveFocusFiscalSettings(preferredEnvironment?: string | null) {
  const requestedEnvironment = preferredEnvironment ? normalizeEnvironment(preferredEnvironment) : null;

  try {
    const configuration = await getFiscalConfiguration();
    const environment = requestedEnvironment ?? (configuration ? normalizeEnvironment(configuration.environment) : getFiscalEnvironmentFallbackFromEnv());
    const configuredToken =
      environment === "producao"
        ? decryptConfiguredSecret(configuration?.tokenProductionEncrypted, "token de producao")
        : decryptConfiguredSecret(configuration?.tokenHomologEncrypted, "token de homologacao");
    const envToken =
      environment === "producao"
        ? process.env.FOCUS_NFE_TOKEN_PROD?.trim()
        : process.env.FOCUS_NFE_TOKEN_HOMOLOG?.trim();

    return {
      environment,
      baseUrl: getFocusBaseUrl(environment),
      token: configuredToken || envToken || undefined,
      cnpjEmitente:
        configuration?.cnpjEmitente ??
        normalizeDigits(process.env.FOCUS_NFCE_CNPJ_EMITENTE ?? process.env.FOCUS_NFE_CNPJ_EMITENTE),
      defaultNcm:
        configuration?.defaultNcm ??
        normalizeDigits(process.env.FOCUS_NFCE_NCM_PADRAO ?? process.env.FOCUS_NFE_NCM_PADRAO),
      nfceSeries:
        environment === "producao" ? configuration?.nfceProductionSeries : configuration?.nfceHomologSeries,
      nfceNextNumber:
        environment === "producao"
          ? configuration?.nfceProductionNextNumber
          : configuration?.nfceHomologNextNumber,
      nfceIdToken:
        environment === "producao" ? configuration?.nfceProductionIdToken : configuration?.nfceHomologIdToken,
      nfceCsc:
        environment === "producao"
          ? decryptConfiguredSecret(configuration?.nfceProductionCscEncrypted, "CSC de producao")
          : decryptConfiguredSecret(configuration?.nfceHomologCscEncrypted, "CSC de homologacao"),
    };
  } catch (error) {
    if (!isMissingFiscalConfigurationTableError(error)) {
      console.error("[FISCAL] Falha ao resolver configuracao fiscal. Usando fallback por variaveis.", error);
    }

    const environment = requestedEnvironment ?? getFiscalEnvironmentFallbackFromEnv();
    return {
      environment,
      baseUrl: getFocusBaseUrl(environment),
      token:
        environment === "producao"
          ? process.env.FOCUS_NFE_TOKEN_PROD?.trim()
          : process.env.FOCUS_NFE_TOKEN_HOMOLOG?.trim(),
      cnpjEmitente: normalizeDigits(process.env.FOCUS_NFCE_CNPJ_EMITENTE ?? process.env.FOCUS_NFE_CNPJ_EMITENTE),
      defaultNcm: normalizeDigits(process.env.FOCUS_NFCE_NCM_PADRAO ?? process.env.FOCUS_NFE_NCM_PADRAO),
      nfceSeries: undefined,
      nfceNextNumber: undefined,
      nfceIdToken: undefined,
      nfceCsc: undefined,
    };
  }
}

export async function updateFiscalConfigurationRecord(
  input: FormData,
  actor: {
    id?: string;
    name: string;
  },
) {
  const parsed = updateFiscalConfigurationSchema.parse({
    environment: input.get("environment"),
    productionConfirmation: input.get("productionConfirmation"),
    cnpjEmitente: input.get("cnpjEmitente"),
    defaultNcm: input.get("defaultNcm"),
    tokenHomolog: input.get("tokenHomolog"),
    tokenProduction: input.get("tokenProduction"),
    nfceHomologSeries: input.get("nfceHomologSeries"),
    nfceHomologNextNumber: input.get("nfceHomologNextNumber"),
    nfceHomologIdToken: input.get("nfceHomologIdToken"),
    nfceHomologCsc: input.get("nfceHomologCsc"),
    nfceProductionSeries: input.get("nfceProductionSeries"),
    nfceProductionNextNumber: input.get("nfceProductionNextNumber"),
    nfceProductionIdToken: input.get("nfceProductionIdToken"),
    nfceProductionCsc: input.get("nfceProductionCsc"),
  });

  let updated: Awaited<ReturnType<typeof upsertFiscalConfiguration>>;
  try {
    const current = await getFiscalConfiguration();
    updated = await upsertFiscalConfiguration({
      environment: normalizeEnvironment(parsed.environment),
      cnpjEmitente: parsed.cnpjEmitente ?? null,
      defaultNcm: parsed.defaultNcm ?? null,
      tokenHomologEncrypted: parsed.tokenHomolog
        ? encryptSecretValue(parsed.tokenHomolog)
        : current?.tokenHomologEncrypted ?? null,
      tokenProductionEncrypted: parsed.tokenProduction
        ? encryptSecretValue(parsed.tokenProduction)
        : current?.tokenProductionEncrypted ?? null,
      nfceHomologSeries: emptyToNull(parsed.nfceHomologSeries),
      nfceHomologNextNumber: parsed.nfceHomologNextNumber ?? null,
      nfceHomologIdToken: emptyToNull(parsed.nfceHomologIdToken),
      nfceHomologCscEncrypted: parsed.nfceHomologCsc
        ? encryptSecretValue(parsed.nfceHomologCsc)
        : current?.nfceHomologCscEncrypted ?? null,
      nfceProductionSeries: emptyToNull(parsed.nfceProductionSeries),
      nfceProductionNextNumber: parsed.nfceProductionNextNumber ?? null,
      nfceProductionIdToken: emptyToNull(parsed.nfceProductionIdToken),
      nfceProductionCscEncrypted: parsed.nfceProductionCsc
        ? encryptSecretValue(parsed.nfceProductionCsc)
        : current?.nfceProductionCscEncrypted ?? null,
      updatedById: actor.id,
      updatedByName: actor.name,
    });
  } catch (error) {
    if (isMissingFiscalConfigurationTableError(error)) {
      throw new Error("Plugin fiscal aguardando sincronizacao do banco. Rode o db:push e tente novamente.");
    }

    throw error;
  }

  await createAuditLog({
    userId: actor.id,
    action: "fiscal.configuration.update",
    entity: "FiscalConfiguration",
    entityId: updated.id,
    metadata: {
      environment: updated.environment,
      hasTokenHomolog: Boolean(updated.tokenHomologEncrypted),
      hasTokenProduction: Boolean(updated.tokenProductionEncrypted),
      hasCnpjEmitente: Boolean(updated.cnpjEmitente),
      hasDefaultNcm: Boolean(updated.defaultNcm),
      updatedByName: actor.name,
    },
  });

  return {
    environment: normalizeEnvironment(updated.environment),
  };
}

export async function updateFiscalEnvironmentRecord(
  input: FormData,
  actor: {
    id?: string;
    name: string;
  },
) {
  return updateFiscalConfigurationRecord(input, actor);
}

export function getDefaultFiscalEnvironment() {
  return fallbackEnvironment;
}
