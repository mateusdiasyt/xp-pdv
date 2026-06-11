"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";

import { RegisterTenantForm } from "@/components/platform/register-tenant-form";
import type { PlatformBillingCycleMonths } from "@/domain/platform/billing-plans";
import type { PlatformPlanName } from "@/domain/platform/plan-entitlements";
import { cn } from "@/lib/utils";

type LandingRegisterModalProps = {
  label?: string;
  className?: string;
  children?: ReactNode;
  defaultPlanName?: PlatformPlanName;
  defaultBillingCycleMonths?: PlatformBillingCycleMonths;
};

export function LandingRegisterModal({
  label = "Criar conta",
  className,
  children,
  defaultPlanName = "Ouro",
  defaultBillingCycleMonths = 1,
}: LandingRegisterModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children ?? (
          <>
            {label}
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>

      {typeof document !== "undefined" && open
        ? createPortal(
            <div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-black/72 px-4 py-8 backdrop-blur-sm">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Fechar cadastro"
                onClick={() => setOpen(false)}
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="landing-register-title"
                className="relative w-full max-w-2xl rounded-3xl border border-white/12 bg-[#121012] p-5 text-white shadow-[0_44px_160px_-70px_rgba(0,0,0,0.95)] sm:p-6"
              >
                <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                      Cadastro Mendoza PDV
                    </p>
                    <h2 id="landing-register-title" className="mt-2 text-2xl font-black text-white">
                      Crie sua conta
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/58">
                      Envie seus dados. Depois da aprovacao, seu ambiente fica isolado para configurar produtos, caixa e fiscal.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Fechar"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div
                  className={cn(
                    "[&_label]:text-white/72 [&_input]:border-white/12 [&_input]:bg-black/28 [&_input]:text-white [&_input]:placeholder:text-white/28 [&_p]:text-white/45"
                  )}
                >
                  <RegisterTenantForm
                    defaultPlanName={defaultPlanName}
                    defaultBillingCycleMonths={defaultBillingCycleMonths}
                  />
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
