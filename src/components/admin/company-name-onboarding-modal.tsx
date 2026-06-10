"use client";

import { Building2, Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmCompanyNameAction } from "@/presentation/admin/onboarding/actions";

type CompanyNameOnboardingModalProps = {
  initialCompanyName: string;
};

export function CompanyNameOnboardingModal({ initialCompanyName }: CompanyNameOnboardingModalProps) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const result = await confirmCompanyNameAction(formData);

    if (result.status === "success") {
      window.location.reload();
      return;
    }

    setErrorMessage(result.message ?? "Nao foi possivel salvar.");
    setIsSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-3xl border border-border/80 bg-background p-6 shadow-2xl shadow-black/45"
      >
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-primary/12 text-primary">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Vamos confirmar o nome da sua empresa?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Isso aparece no painel, relatórios e comprovantes.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboardingCompanyName">Nome da empresa</Label>
          <Input
            id="onboardingCompanyName"
            name="companyName"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Ex.: Bar do Joao"
            required
            autoFocus
          />
        </div>

        {errorMessage ? (
          <p className="mt-3 rounded-2xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <Button type="submit" className="mt-5 w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar e continuar
        </Button>
      </form>
    </div>
  );
}
