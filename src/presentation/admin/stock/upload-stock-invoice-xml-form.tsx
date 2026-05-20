"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { uploadStockInvoiceXmlAction } from "@/presentation/admin/stock/actions";

export function UploadStockInvoiceXmlForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(uploadStockInvoiceXmlAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="xmlFile">Arquivo XML da NF-e</Label>
        <Input id="xmlFile" name="xmlFile" type="file" accept=".xml,text/xml,application/xml" required />
        <p className="text-xs text-muted-foreground">
          O sistema valida o CNPJ destinatario, guarda o XML para auditoria e usa a unidade tributavel do XML para
          montar uma previa de quantidade/custo vendavel.
        </p>
      </div>

      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-foreground">
        <p className="font-medium">Nada entra no estoque automaticamente</p>
        <p className="mt-1 text-xs text-muted-foreground">
          O arquivo fica guardado para auditoria e a entrada so acontece quando voce confirmar na lista de XMLs.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3">
        <FormSubmitButton>Salvar XML e gerar previa</FormSubmitButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
