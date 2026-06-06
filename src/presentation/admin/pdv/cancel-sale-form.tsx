"use client";

import { CircleX, X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { PaymentMethod, RefundStatus } from "@prisma/client";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import { cancelSaleRequest } from "@/presentation/admin/pdv/actions";

type CancelSaleFormProps = {
  saleId: string;
  totalAmount: number;
  defaultRefundMethod?: PaymentMethod | null;
};

declare global {
  interface Window {
    __PDV_MODAL_OPEN__?: boolean;
  }
}

const refundStatusLabels: Record<RefundStatus, string> = {
  CONFIRMED: "Estorno confirmado",
  PENDING: "Estorno pendente",
  NOT_REQUIRED: "Sem devolucao",
  FAILED: "Falha no estorno",
};

const refundMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Cartao de credito",
  DEBIT_CARD: "Cartao de debito",
};

function setPdvModalOpen(isOpen: boolean) {
  window.__PDV_MODAL_OPEN__ = isOpen;
}

function reloadPage() {
  window.setTimeout(() => {
    window.location.reload();
  }, 100);
}

function CancelSaleModal({
  open,
  titleId,
  onClose,
  children,
}: {
  open: boolean;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      setPdvModalOpen(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    setPdvModalOpen(true);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      setPdvModalOpen(false);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center px-4 py-6">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-xs" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 grid max-h-[calc(100vh-3rem)] w-full max-w-[min(560px,95vw)] gap-0 overflow-hidden rounded-xl border border-border/80 bg-card text-sm ring-1 ring-foreground/10"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div className="space-y-1.5 pr-6">
            <h2 id={titleId} className="text-base font-medium leading-none text-foreground">
              Cancelar venda
            </h2>
            <p className="text-sm text-muted-foreground">
              Registre motivo e estorno. O historico da venda fica salvo.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>
        <div className="admin-scrollbar overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function CancelSaleForm({ saleId, totalAmount, defaultRefundMethod }: CancelSaleFormProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isPending, startTransition] = useTransition();
  const suggestedRefundAmount = totalAmount.toFixed(2);
  const titleId = `cancel-sale-title-${saleId}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setState(initialActionState);

    startTransition(async () => {
      const result = await cancelSaleRequest(formData);
      setState(result);

      if (result.status === "success") {
        setOpen(false);
        reloadPage();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <CircleX className="h-4 w-4" />
      </Button>
      <CancelSaleModal open={open} titleId={titleId} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <input type="hidden" name="saleId" value={saleId} />

          <div className="space-y-2">
            <Label htmlFor={`cancel-sale-reason-${saleId}`}>Motivo</Label>
            <Textarea
              id={`cancel-sale-reason-${saleId}`}
              name="cancelReason"
              rows={4}
              placeholder="Descreva o motivo do cancelamento"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`refund-status-${saleId}`}>Situacao do estorno</Label>
              <select
                id={`refund-status-${saleId}`}
                name="refundStatus"
                defaultValue={RefundStatus.CONFIRMED}
                className="h-10 w-full rounded-xl border border-input/80 bg-card/85 px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-4 focus:ring-ring/20"
              >
                {Object.values(RefundStatus).map((status) => (
                  <option key={status} value={status}>
                    {refundStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`refund-method-${saleId}`}>Forma do estorno</Label>
              <select
                id={`refund-method-${saleId}`}
                name="refundMethod"
                defaultValue={defaultRefundMethod ?? ""}
                className="h-10 w-full rounded-xl border border-input/80 bg-card/85 px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-4 focus:ring-ring/20"
              >
                <option value="">Nao informado</option>
                {Object.values(PaymentMethod).map((method) => (
                  <option key={method} value={method}>
                    {refundMethodLabels[method]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`refund-amount-${saleId}`}>Valor devolvido (R$)</Label>
              <Input id={`refund-amount-${saleId}`} name="refundAmount" inputMode="decimal" defaultValue={suggestedRefundAmount} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`refund-nsu-${saleId}`}>NSU / ID Pix</Label>
              <Input id={`refund-nsu-${saleId}`} name="refundNsu" placeholder="Ex.: 123456" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`refund-auth-${saleId}`}>Autorizacao</Label>
              <Input id={`refund-auth-${saleId}`} name="refundAuthorizationCode" placeholder="Codigo da maquininha" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`refund-terminal-${saleId}`}>Maquininha</Label>
              <Input id={`refund-terminal-${saleId}`} name="refundTerminalId" placeholder="Ex.: SICOOB-01" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`refund-external-${saleId}`}>ID unico da transacao</Label>
            <Input id={`refund-external-${saleId}`} name="refundExternalTransactionId" placeholder="ID do TEF, Pix ou comprovante" />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`refund-receipt-${saleId}`}>Comprovante / observacao</Label>
            <Textarea
              id={`refund-receipt-${saleId}`}
              name="refundReceiptText"
              rows={3}
              placeholder="Cole dados do comprovante, estorno ou observacao interna"
            />
          </div>

          <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
            {isPending ? "Cancelando..." : "Cancelar venda e registrar estorno"}
          </Button>
          <ActionFeedback state={state} />
        </form>
      </CancelSaleModal>
    </>
  );
}
