"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="accessKey">Chave de acesso da NF-e</Label>
        <Input
          id="accessKey"
          name="accessKey"
          inputMode="numeric"
          maxLength={60}
          placeholder="Escaneie ou digite os 44 numeros do DANFE"
          required
        />
        <p className="text-xs text-muted-foreground">
          O leitor de barras funciona como teclado: ao escanear o DANFE, a chave entra aqui e o sistema busca o XML na
          Focus.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-card/40 p-3">
        <label htmlFor="fetchApplyStockImport" className="flex items-start gap-3 text-sm">
          <input
            id="fetchApplyStockImport"
            name="applyStockImport"
            type="checkbox"
            defaultChecked
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
          />
          <span>
            <span className="block font-medium text-foreground">Importar itens no estoque agora</span>
            <span className="block text-xs text-muted-foreground">
              Se ativo, a entrada atualiza custo, NCM, fornecedor e saldo dos produtos encontrados.
            </span>
          </span>
        </label>

        <label htmlFor="fetchAllowCreateProducts" className="flex items-start gap-3 text-sm">
          <input
            id="fetchAllowCreateProducts"
            name="allowCreateProducts"
            type="checkbox"
            defaultChecked
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
          />
          <span>
            <span className="block font-medium text-foreground">Criar produto quando nao existir</span>
            <span className="block text-xs text-muted-foreground">
              Produtos novos entram com custo do XML e preco inicial igual ao custo para ajuste posterior.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-col items-start gap-3">
        <FormSubmitButton>Buscar NF-e na Focus</FormSubmitButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
