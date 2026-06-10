"use client";

import { Clock, Palette, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useActionState, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { updateBrandCustomizationAction } from "@/presentation/admin/customization/actions";

const defaultBrandColors = {
  primaryColor: "#d4a62a",
  accentColor: "#b9882a",
  backgroundColor: "#0a0a0a",
  foregroundColor: "#f4efe4",
};

type UpdateBrandCustomizationFormProps = {
  initialValues: {
    browserTitle: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    foregroundColor: string;
    logoDataUrl?: string;
    businessTimezone: string;
    businessDayStartsAt: string;
    businessDayEndsAt: string;
  };
};

async function buildImagePreviewDataUrl(file: File, format: "image/png" | "image/webp") {
  const imageBitmapUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new window.Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Nao foi possivel carregar a imagem."));
      nextImage.src = imageBitmapUrl;
    });

    const maxWidth = format === "image/png" ? 512 : 1600;
    const maxHeight = format === "image/png" ? 512 : 512;
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Nao foi possivel processar a imagem.");
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    const quality = format === "image/png" ? undefined : 0.86;
    return canvas.toDataURL(format, quality);
  } finally {
    URL.revokeObjectURL(imageBitmapUrl);
  }
}

export function UpdateBrandCustomizationForm({ initialValues }: UpdateBrandCustomizationFormProps) {
  const [state, formAction] = useActionState(updateBrandCustomizationAction, initialActionState);

  const [browserTitle, setBrowserTitle] = useState(initialValues.browserTitle);
  const [primaryColor, setPrimaryColor] = useState(initialValues.primaryColor);
  const [accentColor, setAccentColor] = useState(initialValues.accentColor);
  const [backgroundColor, setBackgroundColor] = useState(initialValues.backgroundColor);
  const [foregroundColor, setForegroundColor] = useState(initialValues.foregroundColor);
  const [businessTimezone, setBusinessTimezone] = useState(initialValues.businessTimezone);
  const [businessDayStartsAt, setBusinessDayStartsAt] = useState(initialValues.businessDayStartsAt);
  const [businessDayEndsAt, setBusinessDayEndsAt] = useState(initialValues.businessDayEndsAt);

  const [logoDataUrl, setLogoDataUrl] = useState(initialValues.logoDataUrl ?? "");
  const [processingError, setProcessingError] = useState<string | null>(null);

  async function handleAssetChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setProcessingError("Selecione um arquivo de imagem valido.");
      return;
    }

    try {
      setProcessingError(null);
      const nextDataUrl = await buildImagePreviewDataUrl(selectedFile, "image/webp");

      if (nextDataUrl.length > 1_800_000) {
        throw new Error("Arquivo muito grande. Use uma imagem menor para continuar.");
      }

      setLogoDataUrl(nextDataUrl);
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : "Nao foi possivel processar a imagem.");
    }
  }

  function restoreDefaults() {
    setBrowserTitle("Mendoza PDV");
    setPrimaryColor(defaultBrandColors.primaryColor);
    setAccentColor(defaultBrandColors.accentColor);
    setBackgroundColor(defaultBrandColors.backgroundColor);
    setForegroundColor(defaultBrandColors.foregroundColor);
    setBusinessTimezone("America/Sao_Paulo");
    setBusinessDayStartsAt("19:00");
    setBusinessDayEndsAt("01:00");
    setLogoDataUrl("");
    setProcessingError(null);
  }

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="logoDataUrl" value={logoDataUrl} />

      <section className="grid gap-2">
        <Label htmlFor="browserTitle">Nome da aba do navegador</Label>
        <Input
          id="browserTitle"
          name="browserTitle"
          value={browserTitle}
          onChange={(event) => setBrowserTitle(event.target.value)}
          placeholder="Ex.: Mendoza PDV"
          maxLength={80}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="primaryColor">Cor primaria</Label>
          <div className="flex items-center gap-2">
            <Input id="primaryColor" name="primaryColor" type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} className="h-10 w-14 p-1" />
            <Input value={primaryColor.toUpperCase()} onChange={(event) => setPrimaryColor(event.target.value)} className="uppercase" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="accentColor">Cor de destaque</Label>
          <div className="flex items-center gap-2">
            <Input id="accentColor" name="accentColor" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} className="h-10 w-14 p-1" />
            <Input value={accentColor.toUpperCase()} onChange={(event) => setAccentColor(event.target.value)} className="uppercase" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="backgroundColor">Cor de fundo</Label>
          <div className="flex items-center gap-2">
            <Input id="backgroundColor" name="backgroundColor" type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} className="h-10 w-14 p-1" />
            <Input value={backgroundColor.toUpperCase()} onChange={(event) => setBackgroundColor(event.target.value)} className="uppercase" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="foregroundColor">Cor de texto</Label>
          <div className="flex items-center gap-2">
            <Input id="foregroundColor" name="foregroundColor" type="color" value={foregroundColor} onChange={(event) => setForegroundColor(event.target.value)} className="h-10 w-14 p-1" />
            <Input value={foregroundColor.toUpperCase()} onChange={(event) => setForegroundColor(event.target.value)} className="uppercase" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/75 bg-background/35 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="h-4 w-4 text-primary" />
          Horario operacional
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="businessDayStartsAt">Abertura</Label>
            <Input
              id="businessDayStartsAt"
              name="businessDayStartsAt"
              type="time"
              value={businessDayStartsAt}
              onChange={(event) => setBusinessDayStartsAt(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessDayEndsAt">Fechamento</Label>
            <Input
              id="businessDayEndsAt"
              name="businessDayEndsAt"
              type="time"
              value={businessDayEndsAt}
              onChange={(event) => setBusinessDayEndsAt(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessTimezone">Fuso</Label>
            <select
              id="businessTimezone"
              name="businessTimezone"
              value={businessTimezone}
              onChange={(event) => setBusinessTimezone(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="America/Sao_Paulo">Brasilia/Sao Paulo</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="rounded-2xl border border-border/75 bg-background/35 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Logo do painel</p>
            <p className="text-xs text-muted-foreground">Usada apenas dentro do ambiente do cliente.</p>
          </div>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            className="mt-3"
            onChange={(event) => void handleAssetChange(event)}
          />
          <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background/45 p-3">
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="Preview da logo" className="h-16 w-full object-contain" />
            ) : (
              <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">Usando logo padrao</div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setLogoDataUrl("")}>
              <X className="h-4 w-4" />
              Remover logo
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/75 bg-background/35 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Palette className="h-4 w-4 text-primary" />
          Preview rapido
        </div>
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor,
            color: foregroundColor,
            borderColor: accentColor,
          }}
        >
          <p className="text-sm font-semibold">Visual da marca</p>
          <p className="mt-1 text-xs opacity-90">Botao primario, destaque e fundo usando as cores selecionadas.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: primaryColor, color: "#111111" }}
            >
              Primaria
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: accentColor, color: foregroundColor }}
            >
              Destaque
            </button>
          </div>
        </div>
      </section>

      {processingError ? <p className="text-sm text-destructive">{processingError}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <FormSubmitButton>Salvar personalizacao</FormSubmitButton>
        <Button type="button" variant="outline" onClick={restoreDefaults}>
          Restaurar padrao
        </Button>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
