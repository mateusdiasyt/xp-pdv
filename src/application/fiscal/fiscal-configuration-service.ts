import { updateFiscalConfigurationSchema, type FiscalEnvironment } from "@/domain/fiscal/schemas";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  getFiscalConfiguration,
  isMissingFiscalConfigurationTableError,
  upsertFiscalConfiguration,
} from "@/infrastructure/db/repositories/fiscal-configuration-repository";

const fallbackEnvironment: FiscalEnvironment = "homologacao";

function normalizeEnvironment(rawValue: string | null | undefined): FiscalEnvironment {
  const normalized = String(rawValue ?? "").trim().toLowerCase();
  return normalized.startsWith("prod") ? "producao" : "homologacao";
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
  try {
    const configuration = await getFiscalConfiguration();
    return {
      environment: configuration ? normalizeEnvironment(configuration.environment) : getFiscalEnvironmentFallbackFromEnv(),
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

export async function updateFiscalEnvironmentRecord(
  input: FormData,
  actor: {
    id?: string;
    name: string;
  },
) {
  const parsed = updateFiscalConfigurationSchema.parse({
    environment: input.get("environment"),
    productionConfirmation: input.get("productionConfirmation"),
  });

  let updated: Awaited<ReturnType<typeof upsertFiscalConfiguration>>;
  try {
    updated = await upsertFiscalConfiguration({
      environment: normalizeEnvironment(parsed.environment),
      updatedById: actor.id,
      updatedByName: actor.name,
    });
  } catch (error) {
    if (isMissingFiscalConfigurationTableError(error)) {
      throw new Error("Modulo fiscal aguardando sincronizacao do banco. Rode o db:push e tente novamente.");
    }

    throw error;
  }

  await createAuditLog({
    userId: actor.id,
    action: "fiscal.environment.update",
    entity: "FiscalConfiguration",
    entityId: updated.id,
    metadata: {
      environment: updated.environment,
      updatedByName: actor.name,
    },
  });

  return {
    environment: normalizeEnvironment(updated.environment),
  };
}

export function getDefaultFiscalEnvironment() {
  return fallbackEnvironment;
}
