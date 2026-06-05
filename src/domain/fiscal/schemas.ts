import { z } from "zod";

export const fiscalEnvironmentSchema = z.enum(["homologacao", "producao"]);

const optionalTrimmedString = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}, z.string().optional());

const optionalDigitsSchema = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).replace(/\D/g, "");
  return normalized || undefined;
}, z.string().optional());

const optionalPositiveIntSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return value;
}, z.coerce.number().int().min(1).optional());

export const updateFiscalConfigurationSchema = z
  .object({
    environment: fiscalEnvironmentSchema,
    productionConfirmation: z.string().trim().optional(),
    cnpjEmitente: optionalDigitsSchema.refine((value) => !value || value.length === 14, {
      message: "CNPJ emitente deve ter 14 digitos.",
    }),
    defaultNcm: optionalDigitsSchema.refine((value) => !value || value.length === 8, {
      message: "NCM padrao deve ter 8 digitos.",
    }),
    tokenHomolog: optionalTrimmedString,
    tokenProduction: optionalTrimmedString,
    nfceHomologSeries: optionalTrimmedString,
    nfceHomologNextNumber: optionalPositiveIntSchema,
    nfceHomologIdToken: optionalTrimmedString,
    nfceHomologCsc: optionalTrimmedString,
    nfceProductionSeries: optionalTrimmedString,
    nfceProductionNextNumber: optionalPositiveIntSchema,
    nfceProductionIdToken: optionalTrimmedString,
    nfceProductionCsc: optionalTrimmedString,
  })
  .superRefine((input, context) => {
    if (input.environment === "producao" && input.productionConfirmation !== "PRODUCAO") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para ativar producao, confirme digitando PRODUCAO em letras maiusculas.",
        path: ["productionConfirmation"],
      });
    }
  });

export type FiscalEnvironment = z.infer<typeof fiscalEnvironmentSchema>;
