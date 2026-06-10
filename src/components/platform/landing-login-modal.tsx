"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LogIn, X } from "lucide-react";

import { LoginForm } from "@/components/admin/login-form";
import { MendozaLogo } from "@/components/platform/mendoza-logo";

type LandingLoginModalProps = {
  label?: string;
  className?: string;
  children?: ReactNode;
};

export function LandingLoginModal({ label = "Login", className, children }: LandingLoginModalProps) {
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
            <LogIn className="h-4 w-4" />
            {label}
          </>
        )}
      </button>

      {typeof document !== "undefined" && open
        ? createPortal(
            <div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-black/72 px-4 py-8 backdrop-blur-sm">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Fechar login"
                onClick={() => setOpen(false)}
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="landing-login-title"
                className="relative w-full max-w-[430px] rounded-3xl border border-white/12 bg-[#121012] p-6 text-white shadow-[0_44px_160px_-70px_rgba(0,0,0,0.95)]"
              >
                <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <MendozaLogo className="h-28 w-40" />
                    <h2 id="landing-login-title" className="mt-5 text-2xl font-black text-white">
                      Entrar no painel
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      Acesse seu ambiente com email, senha e cliente.
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

                <div className="[&_label]:text-white/72 [&_input]:border-white/12 [&_input]:bg-black/28 [&_input]:text-white [&_input]:placeholder:text-white/28 [&_p]:text-white/45">
                  <LoginForm />
                </div>
              </section>
            </div>,
          document.body,
        )
        : null}
    </>
  );
}
