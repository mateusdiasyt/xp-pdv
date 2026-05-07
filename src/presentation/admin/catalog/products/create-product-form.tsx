"use client";

import Image from "next/image";
import { RecordStatus } from "@prisma/client";
import { ImageIcon } from "lucide-react";
import type { ChangeEvent } from "react";
import { useActionState, useEffect, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";

type ProductOption = {
  id: string;
  name: string;
};

type SupplierOption = {
  id: string;
  tradeName: string;
};

type ProductFormInitialData = {
  productId?: string;
  name?: string;
  sku?: string;
  ncm?: string;
  description?: string | null;
  imageUrl?: string | null;
  categoryId?: string;
  supplierId?: string | null;
  costPrice?: string;
  salePrice?: string;
  minStock?: number;
  currentStock?: number;
  status?: RecordStatus;
};

type ProductFormAction = (
  prevState: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

type ProductFormProps = {
  action: ProductFormAction;
  categories: ProductOption[];
  suppliers: SupplierOption[];
  submitLabel: string;
  initialData?: ProductFormInitialData;
  onSuccess?: () => void;
};

function ProductImagePreview({
  imageUrl,
  name,
}: {
  imageUrl: string;
  name: string;
}) {
  if (!imageUrl) {
    return (
      <div className="flex h-30 items-center justify-center rounded-2xl border border-dashed border-border/75 bg-background/40 text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/65">
            <ImageIcon className="h-4 w-4" />
          </span>
          <p className="text-xs">Sem imagem</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-30 overflow-hidden rounded-2xl border border-border/75 bg-background/30">
      <Image src={imageUrl} alt={name || "Produto"} fill className="object-cover" unoptimized />
    </div>
  );
}

async function buildImagePreviewDataUrl(file: File) {
  const imageBitmapUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new window.Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Nao foi possivel carregar a imagem selecionada."));
      nextImage.src = imageBitmapUrl;
    });

    const maxWidth = 1200;
    const maxHeight = 1200;
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Nao foi possivel preparar a imagem selecionada.");
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    URL.revokeObjectURL(imageBitmapUrl);
  }
}

export function CreateProductForm({
  action,
  categories,
  suppliers,
  submitLabel,
  initialData,
  onSuccess,
}: ProductFormProps) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(initialData?.imageUrl ?? "");
  const [imageError, setImageError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const currentStockValue = initialData?.currentStock ?? 0;

  useEffect(() => {
    if (state.status === "success") {
      onSuccess?.();
    }
  }, [onSuccess, state.status]);

  async function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setImageError("Selecione um arquivo de imagem valido.");
      return;
    }

    try {
      setImageError(null);
      const previewUrl = await buildImagePreviewDataUrl(file);

      if (previewUrl.length > 900_000) {
        throw new Error("A imagem ficou muito grande. Use um arquivo menor para continuar.");
      }

      setImagePreviewUrl(previewUrl);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Nao foi possivel processar a imagem.");
    }
  }

  function handleClearImage() {
    setImagePreviewUrl("");
    setImageError(null);
    setFileInputKey((currentValue) => currentValue + 1);
  }

  return (
    <form action={formAction} className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="imageFile">Imagem do produto</Label>
          <input type="hidden" name="imageUrl" value={imagePreviewUrl} />
          <Input
            key={fileInputKey}
            id="imageFile"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            onChange={handleImageFileChange}
          />
          <p className="text-xs text-muted-foreground">
            Envie um arquivo de imagem. A imagem sera otimizada automaticamente.
          </p>
          {imageError ? <p className="text-xs text-destructive">{imageError}</p> : null}
          {imagePreviewUrl ? (
            <Button type="button" variant="outline" size="sm" onClick={handleClearImage}>
              Remover imagem
            </Button>
          ) : null}
        </div>

        <ProductImagePreview imageUrl={imagePreviewUrl} name={initialData?.name ?? "Produto"} />
      </aside>

      <div className="grid gap-4 md:grid-cols-2">
        {initialData?.productId ? <input type="hidden" name="productId" value={initialData.productId} /> : null}

        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" placeholder="Nome do produto" defaultValue={initialData?.name ?? ""} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" placeholder="SKU-0001" defaultValue={initialData?.sku ?? ""} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ncm">NCM</Label>
          <Input
            id="ncm"
            name="ncm"
            placeholder="22021000"
            defaultValue={initialData?.ncm ?? ""}
            inputMode="numeric"
            maxLength={8}
            required
          />
          <p className="text-xs text-muted-foreground">Informe o NCM fiscal com 8 digitos.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoryId">Categoria</Label>
          <select
            id="categoryId"
            name="categoryId"
            className="admin-native-select"
            required
            defaultValue={initialData?.categoryId ?? categories[0]?.id}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplierId">Fornecedor</Label>
          <select
            id="supplierId"
            name="supplierId"
            className="admin-native-select"
            defaultValue={initialData?.supplierId ?? ""}
          >
            <option value="">Sem fornecedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.tradeName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="costPrice">Custo (R$)</Label>
          <Input id="costPrice" name="costPrice" placeholder="10.00" defaultValue={initialData?.costPrice ?? ""} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="salePrice">Preco de venda (R$)</Label>
          <Input id="salePrice" name="salePrice" placeholder="15.00" defaultValue={initialData?.salePrice ?? ""} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minStock">Estoque minimo</Label>
          <Input
            id="minStock"
            name="minStock"
            type="number"
            min={0}
            defaultValue={initialData?.minStock ?? 0}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentStock">Estoque atual</Label>
          <input type="hidden" name="currentStock" value={String(currentStockValue)} />
          <Input
            id="currentStock"
            type="number"
            min={0}
            value={currentStockValue}
            readOnly
            disabled
          />
          <p className="text-xs text-muted-foreground">
            O saldo atual e somente informativo. Ajustes de estoque devem ser feitos na aba Estoque.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            className="admin-native-select"
            defaultValue={initialData?.status ?? RecordStatus.ACTIVE}
          >
            <option value={RecordStatus.ACTIVE}>Ativo</option>
            <option value={RecordStatus.INACTIVE}>Inativo</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descricao</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Detalhes tecnicos e comerciais"
            rows={4}
            defaultValue={initialData?.description ?? ""}
          />
        </div>

        <div className="md:col-span-2">
          <div className={cn("flex flex-col gap-3", state.status !== "idle" && "items-start")}>
            <FormSubmitButton>{submitLabel}</FormSubmitButton>
            <ActionFeedback state={state} />
          </div>
        </div>
      </div>
    </form>
  );
}
