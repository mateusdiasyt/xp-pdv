"use client";

import { useActionState, useEffect, useRef } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { fetchStockInvoiceXmlByAccessKeyAction } from "@/presentation/admin/stock/actions";

export function FetchStockInvoiceXmlByKeyForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(fetchStockInvoiceXmlByAccessKeyAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

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
          Focus sem movimentar o estoque automaticamente. Se a Focus ainda tiver so o resumo da nota, esta busca
          solicita a Ciencia da Operacao para liberar o XML completo.
        </p>
      </div>

      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-foreground">
        <p className="font-medium">Fluxo seguro de conferencia</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Primeiro o sistema baixa e guarda o XML. Depois voce confere a previa dos itens e confirma a importacao na
          lista de XMLs guardados.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3">
        <FormSubmitButton>Buscar XML e gerar previa</FormSubmitButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
