"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { importStockInvoiceXmlItemsAction } from "@/presentation/admin/stock/actions";

type ImportStockInvoiceXmlButtonProps = {
  stockInvoiceXmlId: string;
  compact?: boolean;
};

export function ImportStockInvoiceXmlButton({ stockInvoiceXmlId, compact = false }: ImportStockInvoiceXmlButtonProps) {
  const [state, formAction] = useActionState(importStockInvoiceXmlItemsAction, initialActionState);

  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-2"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Confirmar importacao deste XML? Esta acao pode criar produtos e registrar entradas no estoque.",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="stockInvoiceXmlId" value={stockInvoiceXmlId} />
      {compact ? (
        <div className="scale-90 origin-right">
          <FormSubmitButton>Confirmar importacao</FormSubmitButton>
        </div>
      ) : (
        <FormSubmitButton>Confirmar importacao</FormSubmitButton>
      )}
      {!compact || state.status === "error" ? <ActionFeedback state={state} /> : null}
    </form>
  );
}
