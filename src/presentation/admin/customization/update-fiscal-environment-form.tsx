"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { updateFiscalEnvironmentAction } from "@/presentation/admin/customization/actions";

type FiscalEnvironment = "homologacao" | "producao";

type UpdateFiscalEnvironmentFormProps = {
  initialEnvironment: FiscalEnvironment;
  persisted: boolean;
};

const environmentLabels: Record<FiscalEnvironment, string> = {
  homologacao: "Homologacao",
  producao: "Producao",
};

export function UpdateFiscalEnvironmentForm({
  initialEnvironment,
  persisted,
}: UpdateFiscalEnvironmentFormProps) {
  const [state, formAction] = useActionState(updateFiscalEnvironmentAction, initialActionState);
  const [environment, setEnvironment] = useState<FiscalEnvironment>(initialEnvironment);
  const [productionConfirmation, setProductionConfirmation] = useState("");

  const currentEnvironmentLabel = useMemo(() => environmentLabels[environment], [environment]);
  const requiresConfirmation = environment === "producao";

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="environment" value={environment} />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ambiente fiscal ativo:</span>
        <Badge
          className={
            environment === "producao"
              ? "bg-rose-100 text-rose-800 hover:bg-rose-100"
              : "bg-sky-100 text-sky-800 hover:bg-sky-100"
          }
        >
          {currentEnvironmentLabel}
        </Badge>
        {!persisted ? (
          <span className="text-xs text-muted-foreground">
            (fallback por variavel de ambiente)
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 md:max-w-xs">
        <Label htmlFor="fiscalEnvironment">Escolha o ambiente de emissao</Label>
        <Select value={environment} onValueChange={(value) => setEnvironment(value as FiscalEnvironment)}>
          <SelectTrigger id="fiscalEnvironment" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="homologacao">Homologacao (teste)</SelectItem>
            <SelectItem value="producao">Producao (valido fiscal)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {requiresConfirmation ? (
        <div className="space-y-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3">
          <div className="flex items-start gap-2 text-sm text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Atencao: em producao as NFC-e tem validade fiscal e podem gerar obrigacoes legais.
            </p>
          </div>
          <Label htmlFor="productionConfirmation">Digite PRODUCAO para confirmar</Label>
          <Input
            id="productionConfirmation"
            name="productionConfirmation"
            value={productionConfirmation}
            onChange={(event) => setProductionConfirmation(event.target.value.toUpperCase())}
            className="max-w-xs uppercase"
            placeholder="PRODUCAO"
            autoComplete="off"
          />
        </div>
      ) : (
        <input type="hidden" name="productionConfirmation" value="" />
      )}

      <div className="flex items-center gap-3">
        <FormSubmitButton>
          <ShieldCheck className="h-4 w-4" />
          Salvar ambiente fiscal
        </FormSubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
