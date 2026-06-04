"use client";

import { cn } from "@/lib/utils";
import { paymentCardBrandOptions, type PaymentCardBrandOption } from "@/presentation/admin/pdv/payment-card-brands";

type PaymentCardBrandPickerProps = {
  ariaLabelledBy: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
};

function BrandMark({ brand }: { brand: PaymentCardBrandOption }) {
  switch (brand.variant) {
    case "visa":
      return (
        <span className="text-[0.95rem] font-black italic leading-none tracking-[-0.06em] text-[#1a1f71]">
          VISA
        </span>
      );
    case "mastercard":
      return (
        <span className="relative block h-7 w-11">
          <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-[#eb001b]" />
          <span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-[#f79e1b] mix-blend-screen" />
        </span>
      );
    case "elo":
      return (
        <span className="relative grid h-7 w-11 place-items-center rounded-md bg-[#111] text-[0.86rem] font-black lowercase text-white">
          <span className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-[#fedb00]" />
          <span className="absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-[#00a4e4]" />
          <span className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#ef3340]" />
          <span className="leading-none">elo</span>
        </span>
      );
    case "hipercard":
      return (
        <span className="grid h-7 w-12 place-items-center rounded-md bg-[#b31317] text-[0.54rem] font-black uppercase tracking-[0.04em] text-white shadow-inner">
          Hiper
        </span>
      );
    case "amex":
      return (
        <span className="grid h-7 w-12 place-items-center rounded-md bg-[#2e77bb] text-[0.56rem] font-black uppercase leading-none text-white shadow-inner">
          Amex
        </span>
      );
    case "diners":
      return (
        <span className="relative grid h-7 w-12 place-items-center rounded-full border-2 border-[#0079be] bg-white">
          <span className="h-4 w-4 rounded-full border-4 border-[#0079be]" />
        </span>
      );
    case "cabal":
      return (
        <span className="grid h-7 w-12 place-items-center rounded-md bg-[#24478f] text-[0.54rem] font-black uppercase tracking-[0.05em] text-white">
          Cabal
        </span>
      );
    case "sorocred":
      return (
        <span className="grid h-7 w-12 place-items-center rounded-md bg-[#ec1c24] text-[0.95rem] font-black italic text-white">
          S
        </span>
      );
    case "banescard":
      return (
        <span className="grid h-7 w-12 place-items-center rounded-md bg-[#005eb8] text-[0.9rem] font-black text-white">
          B
        </span>
      );
    case "other":
      return (
        <span className="grid h-7 w-12 place-items-center rounded-md border border-white/20 bg-white/8">
          <span className="h-4 w-7 rounded border border-white/50 after:mt-1.5 after:block after:h-px after:bg-white/50" />
        </span>
      );
  }
}

export function PaymentCardBrandPicker({ ariaLabelledBy, name, value, onChange }: PaymentCardBrandPickerProps) {
  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      <div
        role="radiogroup"
        aria-labelledby={ariaLabelledBy}
        className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2"
      >
        {paymentCardBrandOptions.map((brand) => {
          const selected = value === brand.value;

          return (
            <button
              key={brand.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={brand.label}
              title={brand.label}
              className={cn(
                "grid h-12 min-w-0 place-items-center overflow-hidden rounded-xl border bg-background/45 px-2 transition-all hover:border-primary/45 hover:bg-primary/8",
                selected
                  ? "border-primary/70 bg-primary/12 shadow-[0_0_0_1px_rgba(255,0,96,0.24)]"
                  : "border-border/70",
              )}
              onClick={() => onChange(selected ? "" : brand.value)}
            >
              <BrandMark brand={brand} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
