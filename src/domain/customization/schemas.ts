import { z } from "zod";

const hexColorRegex = /^#([0-9a-fA-F]{6})$/;

export const updateBrandCustomizationSchema = z.object({
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
  logoDataUrl: z.string().trim().optional().or(z.literal("")),
  faviconDataUrl: z.string().trim().optional().or(z.literal("")),
});

export type UpdateBrandCustomizationInput = z.infer<typeof updateBrandCustomizationSchema>;
