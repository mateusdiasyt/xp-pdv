"use client";

import { CircleX } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PaymentMethod, RefundStatus } from "@prisma/client";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { cancelSaleAction } from "@/presentation/admin/pdv/actions";

type CancelSaleFormProps = {
  saleId: string;
  totalAmount: number;
};

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

export function CancelSaleForm({ saleId, totalAmount }: CancelSaleFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(cancelSaleAction, initialActionState);
  const handledSuccessRef = useRef(false);
  const suggestedRefundAmount = totalAmount.toFixed(2);

  useEffect(() => {
    if (state.status !== "success") {
      handledSuccessRef.current = false;
      return;
    }

    if (handledSuccessRef.current) {
      return;
    }

    handledSuccessRef.current = true;

    const closeTimeout = window.setTimeout(() => {
      setOpen(false);
    }, 0);
    const refreshTimeout = window.setTimeout(() => {
      router.refresh();
    }, 220);

    return () => {
      window.clearTimeout(closeTimeout);
      window.clearTimeout(refreshTimeout);
    };
  }, [router, state.status]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon-sm" className="text-destructive hover:text-destructive" />}>
        <CircleX className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="max-w-[min(560px,95vw)] gap-0 border-border/80 bg-card p-0 sm:max-w-[min(560px,95vw)]">
        <DialogHeader className="border-b border-border/70 px-5 py-4 pr-14">
          <DialogTitle>Cancelar venda</DialogTitle>
          <DialogDescription>
            Registre o motivo, o estorno e os dados de conferencia. A venda sera cancelada sem apagar o historico.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3 p-5">
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
                defaultValue={RefundStatus.PENDING}
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
                defaultValue=""
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

          <Button type="submit" variant="destructive" size="sm">
            Cancelar venda e registrar estorno
          </Button>
          <ActionFeedback state={state} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
