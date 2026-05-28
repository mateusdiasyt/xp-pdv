import { z } from "zod";

const hexColorRegex = /^#([0-9a-fA-F]{6})$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const updateBrandCustomizationSchema = z.object({
  browserTitle: z
    .string()
    .trim()
    .min(3, "Nome da aba obrigatorio.")
    .max(80, "Nome da aba muito longo."),
  primaryColor: z
    .string()
    .trim()
    .regex(hexColorRegex, "Cor primaria invalida."),
  accentColor: z
    .string()
    .trim()
    .regex(hexColorRegex, "Cor de destaque invalida."),
  backgroundColor: z
    .string()
    .trim()
    .regex(hexColorRegex, "Cor de fundo invalida."),
  foregroundColor: z
    .string()
    .trim()
    .regex(hexColorRegex, "Cor de texto invalida."),
  businessTimezone: z.literal("America/Sao_Paulo"),
  businessDayStartsAt: z
    .string()
    .trim()
    .regex(timeRegex, "Horario de abertura invalido."),
  businessDayEndsAt: z
    .string()
    .trim()
    .regex(timeRegex, "Horario de fechamento invalido."),
  logoDataUrl: z.string().trim().optional().or(z.literal("")),
  faviconDataUrl: z.string().trim().optional().or(z.literal("")),
});

export type UpdateBrandCustomizationInput = z.infer<typeof updateBrandCustomizationSchema>;
