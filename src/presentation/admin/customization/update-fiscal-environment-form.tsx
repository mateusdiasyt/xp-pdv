"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import { updateFiscalSettingsAction } from "@/presentation/admin/customization/actions";

type FiscalEnvironment = "homologacao" | "producao";
type SecretSource = "database" | "environment" | "missing";

type FiscalSettingsSnapshot = {
  environment: FiscalEnvironment;
  persisted: boolean;
  encryptionReady: boolean;
  cnpjEmitente: string;
  defaultNcm: string;
  tokenHomologConfigured: boolean;
  tokenProductionConfigured: boolean;
  tokenHomologSource: SecretSource;
  tokenProductionSource: SecretSource;
  nfceHomologSeries: string;
  nfceHomologNextNumber: string;
  nfceHomologIdToken: string;
  nfceHomologCscConfigured: boolean;
  nfceProductionSeries: string;
  nfceProductionNextNumber: string;
  nfceProductionIdToken: string;
  nfceProductionCscConfigured: boolean;
};

type UpdateFiscalEnvironmentFormProps = {
  settings: FiscalSettingsSnapshot;
};

const environmentLabels: Record<FiscalEnvironment, string> = {
  homologacao: "Homologacao",
  producao: "Producao",
};

const secretSourceLabels: Record<SecretSource, string> = {
  database: "Salvo no banco",
  environment: "Usando Vercel",
  missing: "Nao configurado",
};

function secretBadgeClass(source: SecretSource) {
  if (source === "database") {
    return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  }

  if (source === "environment") {
    return "bg-sky-100 text-sky-800 hover:bg-sky-100";
  }

  return "bg-rose-100 text-rose-800 hover:bg-rose-100";
}

export function UpdateFiscalEnvironmentForm({ settings }: UpdateFiscalEnvironmentFormProps) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [environment, setEnvironment] = useState<FiscalEnvironment>(settings.environment);
  const [productionConfirmation, setProductionConfirmation] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requiresConfirmation = environment === "producao";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setState(initialActionState);

    try {
      const result = await updateFiscalSettingsAction(new FormData(event.currentTarget));
      setState(result);

      if (result.status === "success") {
        window.location.reload();
      }
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao fiscal.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="environment" value={environment} />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ambiente ativo:</span>
        <Badge
          className={
            environment === "producao"
              ? "bg-rose-100 text-rose-800 hover:bg-rose-100"
              : "bg-sky-100 text-sky-800 hover:bg-sky-100"
          }
        >
          {environmentLabels[environment]}
        </Badge>
        {!settings.persisted ? <span className="text-xs text-muted-foreground">(fallback por variavel)</span> : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label htmlFor="fiscalEnvironment">Ambiente</Label>
          <Select value={environment} onValueChange={(value) => setEnvironment(value as FiscalEnvironment)}>
            <SelectTrigger id="fiscalEnvironment" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="homologacao">Homologacao</SelectItem>
              <SelectItem value="producao">Producao</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cnpjEmitente">CNPJ emitente</Label>
          <Input
            id="cnpjEmitente"
            name="cnpjEmitente"
            defaultValue={settings.cnpjEmitente}
            inputMode="numeric"
            placeholder="00000000000000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultNcm">NCM padrao</Label>
          <Input
            id="defaultNcm"
            name="defaultNcm"
            defaultValue={settings.defaultNcm}
            inputMode="numeric"
            placeholder="00000000"
          />
        </div>
      </div>

      {!settings.encryptionReady ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Configure FISCAL_ENCRYPTION_KEY no Vercel antes de salvar tokens ou CSC nesta tela.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              Token homologacao
            </div>
            <Badge className={secretBadgeClass(settings.tokenHomologSource)}>
              {secretSourceLabels[settings.tokenHomologSource]}
            </Badge>
          </div>
          <Input
            name="tokenHomolog"
            type="password"
            placeholder={settings.tokenHomologConfigured ? "Token ja configurado" : "Cole o token de homologacao"}
            autoComplete="off"
          />
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              Token producao
            </div>
            <Badge className={secretBadgeClass(settings.tokenProductionSource)}>
              {secretSourceLabels[settings.tokenProductionSource]}
            </Badge>
          </div>
          <Input
            name="tokenProduction"
            type="password"
            placeholder={settings.tokenProductionConfigured ? "Token ja configurado" : "Cole o token de producao"}
            autoComplete="off"
          />
        </div>
      </div>

      {requiresConfirmation ? (
        <div className="space-y-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3">
          <div className="flex items-start gap-2 text-sm text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Em producao, NFC-e tem validade fiscal. Confirme antes de salvar.</p>
          </div>
          <Label htmlFor="productionConfirmation">Digite PRODUCAO</Label>
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

      <div className="rounded-2xl border border-border/70 bg-background/25">
        <button
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-foreground">NFC-e avancado</span>
            <span className="block text-xs text-muted-foreground">Serie, proximo numero, ID token e CSC.</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen ? "rotate-180" : "")} />
        </button>

        {advancedOpen ? (
          <div className="grid gap-4 border-t border-border/65 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Homologacao</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nfceHomologSeries">Serie</Label>
                  <Input id="nfceHomologSeries" name="nfceHomologSeries" defaultValue={settings.nfceHomologSeries} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nfceHomologNextNumber">Proximo numero</Label>
                  <Input
                    id="nfceHomologNextNumber"
                    name="nfceHomologNextNumber"
                    type="number"
                    min={1}
                    defaultValue={settings.nfceHomologNextNumber}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nfceHomologIdToken">ID Token</Label>
                  <Input id="nfceHomologIdToken" name="nfceHomologIdToken" defaultValue={settings.nfceHomologIdToken} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nfceHomologCsc">CSC</Label>
                  <Input
                    id="nfceHomologCsc"
                    name="nfceHomologCsc"
                    type="password"
                    placeholder={settings.nfceHomologCscConfigured ? "CSC ja configurado" : "Cole o CSC"}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Producao</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nfceProductionSeries">Serie</Label>
                  <Input
                    id="nfceProductionSeries"
                    name="nfceProductionSeries"
                    defaultValue={settings.nfceProductionSeries}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nfceProductionNextNumber">Proximo numero</Label>
                  <Input
                    id="nfceProductionNextNumber"
                    name="nfceProductionNextNumber"
                    type="number"
                    min={1}
                    defaultValue={settings.nfceProductionNextNumber}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nfceProductionIdToken">ID Token</Label>
                  <Input
                    id="nfceProductionIdToken"
                    name="nfceProductionIdToken"
                    defaultValue={settings.nfceProductionIdToken}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nfceProductionCsc">CSC</Label>
                  <Input
                    id="nfceProductionCsc"
                    name="nfceProductionCsc"
                    type="password"
                    placeholder={settings.nfceProductionCscConfigured ? "CSC ja configurado" : "Cole o CSC"}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Salvar fiscal
        </Button>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          Tokens ficam criptografados no banco.
        </span>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
