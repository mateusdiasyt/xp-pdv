export const paymentCardBrandOptions = [
  { value: "Visa", label: "Visa", variant: "visa" },
  { value: "Mastercard", label: "Mastercard", variant: "mastercard" },
  { value: "Elo", label: "Elo", variant: "elo" },
  { value: "Hipercard", label: "Hipercard", variant: "hipercard" },
  { value: "American Express", label: "American Express", variant: "amex" },
  { value: "Diners Club", label: "Diners Club", variant: "diners" },
  { value: "Cabal", label: "Cabal", variant: "cabal" },
  { value: "Sorocred", label: "Sorocred", variant: "sorocred" },
  { value: "Banescard", label: "Banescard", variant: "banescard" },
  { value: "Outro", label: "Outra bandeira", variant: "other" },
] as const;

export type PaymentCardBrandOption = (typeof paymentCardBrandOptions)[number];
