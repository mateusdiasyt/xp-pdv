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
import { fetchStockInvoiceXmlByAccessKeyAction } from "@/presentation/admin/stock/actions";

export function FetchStockInvoiceXmlByKeyForm() {
  const pathname = usePathname();
  const workspaceSlug = getWorkspaceSlugFromPathname(pathname);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await fetchStockInvoiceXmlByAccessKeyAction(initialActionState, formData);
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
        <Button type="submit" disabled={isPending}>
          {isPending ? "Buscando..." : "Buscar XML e gerar previa"}
        </Button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
