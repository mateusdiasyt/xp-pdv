"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { fetchStockInvoiceXmlByAccessKeyAction } from "@/presentation/admin/stock/actions";

export function FetchStockInvoiceXmlByKeyForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(fetchStockInvoiceXmlByAccessKeyAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();

      const reviewUrl =
        state.data && typeof state.data === "object" && "reviewUrl" in state.data
          ? String((state.data as { reviewUrl?: unknown }).reviewUrl ?? "")
          : "";

      if (reviewUrl) {
        router.push(reviewUrl);
      }
    }
  }, [router, state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="accessKey">Chave de acesso da NF-e</Label>
          <span
            title="Escaneie ou digite a chave do DANFE. O sistema baixa e guarda o XML, mas a entrada no estoque so acontece depois da conferencia."
            aria-label="Ajuda"
            className="inline-flex"
          >
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </div>
        <Input
          id="accessKey"
          name="accessKey"
          inputMode="numeric"
          maxLength={60}
          placeholder="Escaneie ou digite os 44 numeros do DANFE"
          required
        />
      </div>

      <div className="flex flex-col items-start gap-3">
        <FormSubmitButton>Buscar XML e gerar previa</FormSubmitButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
