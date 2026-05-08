"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { importStockInvoiceXmlItemsAction } from "@/presentation/admin/stock/actions";

type ImportStockInvoiceXmlButtonProps = {
  stockInvoiceXmlId: string;
  compact?: boolean;
};

export function ImportStockInvoiceXmlButton({ stockInvoiceXmlId, compact = false }: ImportStockInvoiceXmlButtonProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(importStockInvoiceXmlItemsAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="stockInvoiceXmlId" value={stockInvoiceXmlId} />
      {compact ? (
        <div className="scale-90 origin-right">
          <FormSubmitButton>Importar itens</FormSubmitButton>
        </div>
      ) : (
        <FormSubmitButton>Importar itens</FormSubmitButton>
      )}
      {!compact || state.status === "error" ? <ActionFeedback state={state} /> : null}
    </form>
  );
}
