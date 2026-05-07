import { z } from "zod";

export const fiscalEnvironmentSchema = z.enum(["homologacao", "producao"]);

export const updateFiscalConfigurationSchema = z
  .object({
    environment: fiscalEnvironmentSchema,
    productionConfirmation: z.string().trim().optional(),
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
