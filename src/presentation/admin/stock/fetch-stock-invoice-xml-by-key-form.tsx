"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, PackageCheck, Save, Search, X } from "lucide-react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWorkspaceSlugFromPathname, toTenantAdminHref } from "@/lib/tenant-routes";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import {
  fetchStockInvoiceXmlByAccessKeyAction,
  previewStockInvoiceXmlByAccessKeyAction,
} from "@/presentation/admin/stock/actions";

type StockXmlKeyPreview = {
  accessKey: string;
  documentModel?: string;
  documentLabel?: string;
  invoiceNumber?: string;
  invoiceSeries?: string;
  supplierName?: string;
  supplierDocument?: string;
  issuedAt?: string | null;
  totalAmount?: number | null;
  itemLines: number;
  shownItems: Array<{
    lineNumber: number;
    description: string;
    ncm?: string;
    cfop?: string;
    quantity: number;
    sourceQuantity?: number;
    requiresQuantityReview?: boolean;
    unitCost: number;
    totalCost: number;
  }>;
};

type PendingAction = "preview" | "store" | "review" | null;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function toPreviewPayload(data: unknown): StockXmlKeyPreview | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const preview = data as Partial<StockXmlKeyPreview>;
  if (!preview.accessKey || !preview.itemLines || !Array.isArray(preview.shownItems)) {
    return null;
  }

  return preview as StockXmlKeyPreview;
}

function previewTitle(preview: StockXmlKeyPreview) {
  const label = preview.documentLabel ?? "NF-e";
  if (preview.invoiceNumber) {
    return `${label} ${preview.invoiceNumber}`;
  }

  return `${label} encontrada`;
}

export function FetchStockInvoiceXmlByKeyForm() {
  const pathname = usePathname();
  const workspaceSlug = getWorkspaceSlugFromPathname(pathname);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ActionState>(initialActionState);
  const [preview, setPreview] = useState<StockXmlKeyPreview | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();
  const isBusy = isPending || pendingAction !== null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPendingAction("preview");
    startTransition(async () => {
      const result = await previewStockInvoiceXmlByAccessKeyAction(initialActionState, formData);
      setState(result);
      setPendingAction(null);

      if (result.status === "success") {
        setPreview(toPreviewPayload(result.data));
      }
    });
  }

  function handleStore(intent: "store" | "review") {
    if (!preview) {
      return;
    }

    const formData = new FormData();
    formData.set("accessKey", preview.accessKey);
    formData.set("intent", intent);

    setPendingAction(intent);
    startTransition(async () => {
      const result = await fetchStockInvoiceXmlByAccessKeyAction(initialActionState, formData);
      setState(result);
      setPendingAction(null);

      if (result.status !== "success") {
        return;
      }

      if (intent === "store") {
        formRef.current?.reset();
        setPreview(null);
        return;
      }

      const reviewUrl =
        result.data && typeof result.data === "object" && "reviewUrl" in result.data
          ? String((result.data as { reviewUrl?: unknown }).reviewUrl ?? "")
          : "";

      if (reviewUrl) {
        window.location.assign(toTenantAdminHref(reviewUrl, workspaceSlug));
      }
    });
  }

  function clearPreview() {
    setPreview(null);
    setState(initialActionState);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="accessKey">Chave de acesso da NF-e/NFC-e</Label>
          <span
            title="Modelo 55 pode ser consultado pela chave. Para modelo 65, envie o arquivo XML da NFC-e no painel ao lado."
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
        <Button type="submit" disabled={isBusy} className="gap-2">
          <Search className="h-4 w-4" />
          {pendingAction === "preview" ? "Consultando..." : "Consultar chave"}
        </Button>
        <ActionFeedback state={state} />
      </div>

      {preview ? (
        <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
          <div className="flex flex-col gap-3 border-b border-border/70 pb-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">XML ainda nao salvo</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">{previewTitle(preview)}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {preview.supplierName ?? "Fornecedor nao identificado"} - {preview.documentLabel ?? "NF-e"} -{" "}
                {preview.itemLines} item(ns)
              </p>
            </div>
            <div className="text-left text-xs text-muted-foreground md:text-right">
              <p>{preview.totalAmount != null ? currencyFormatter.format(preview.totalAmount) : "Total nao informado"}</p>
              <p className="mt-1 font-mono">{preview.accessKey.slice(-12)}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {preview.shownItems.map((item) => (
              <div
                key={item.lineNumber}
                className="grid gap-2 rounded-xl border border-border/60 bg-card/45 p-3 text-xs md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div>
                  <p className="font-semibold text-foreground">{item.description}</p>
                  <p className="mt-1 text-muted-foreground">
                    Qtd. {item.sourceQuantity ?? item.quantity}
                    {item.requiresQuantityReview ? " · conferir" : ""} · NCM {item.ncm ?? "-"}
                  </p>
                </div>
                <p className="font-semibold text-foreground">{currencyFormatter.format(item.totalCost)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
            <Button type="button" variant="outline" onClick={clearPreview} disabled={isBusy} className="gap-2">
              <X className="h-4 w-4" />
              Nao salvar
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleStore("store")} disabled={isBusy} className="gap-2">
              <Save className="h-4 w-4" />
              {pendingAction === "store" ? "Salvando..." : "So salvar XML"}
            </Button>
            <Button type="button" onClick={() => handleStore("review")} disabled={isBusy} className="gap-2">
              <PackageCheck className="h-4 w-4" />
              {pendingAction === "review" ? "Salvando..." : "Salvar e conferir entrada"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
