"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWorkspaceSlugFromPathname, toTenantAdminHref } from "@/lib/tenant-routes";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import { uploadStockInvoiceXmlAction } from "@/presentation/admin/stock/actions";

export function UploadStockInvoiceXmlForm() {
  const pathname = usePathname();
  const workspaceSlug = getWorkspaceSlugFromPathname(pathname);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await uploadStockInvoiceXmlAction(initialActionState, formData);
      setState(result);

      if (result.status === "success") {
        formRef.current?.reset();
        const reviewUrl =
          result.data && typeof result.data === "object" && "reviewUrl" in result.data
            ? String((result.data as { reviewUrl?: unknown }).reviewUrl ?? "")
            : "";

        if (reviewUrl) {
          window.location.assign(toTenantAdminHref(reviewUrl, workspaceSlug));
        }
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="xmlFile">Arquivo XML da NF-e</Label>
          <span
            title="Envie o XML recebido. Ele fica guardado para auditoria e so movimenta estoque quando voce confirmar a conferencia."
            aria-label="Ajuda"
            className="inline-flex"
          >
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </div>
        <Input id="xmlFile" name="xmlFile" type="file" accept=".xml,text/xml,application/xml" required />
      </div>

      <div className="flex flex-col items-start gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar XML e gerar previa"}
        </Button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
