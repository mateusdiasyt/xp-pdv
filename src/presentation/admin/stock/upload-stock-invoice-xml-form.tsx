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
          calcular quantidade/custo vendavel.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-card/40 p-3">
        <label htmlFor="applyStockImport" className="flex items-start gap-3 text-sm">
          <input
            id="applyStockImport"
            name="applyStockImport"
            type="checkbox"
            defaultChecked
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
          />
          <span>
            <span className="block font-medium text-foreground">Importar itens no estoque agora</span>
            <span className="block text-xs text-muted-foreground">
              Atualiza custo/NCM dos produtos encontrados e registra a entrada com base em qTrib/uTrib/vUnTrib.
            </span>
          </span>
        </label>

        <label htmlFor="allowCreateProducts" className="flex items-start gap-3 text-sm">
          <input
            id="allowCreateProducts"
            name="allowCreateProducts"
            type="checkbox"
            defaultChecked
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
          />
          <span>
            <span className="block font-medium text-foreground">Criar produto quando nao existir</span>
            <span className="block text-xs text-muted-foreground">
              Se desmarcar, itens sem correspondencia serao ignorados para voce cadastrar manualmente depois.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-col items-start gap-3">
        <FormSubmitButton>Salvar XML</FormSubmitButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
