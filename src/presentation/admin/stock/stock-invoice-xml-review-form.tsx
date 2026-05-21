"use client";

import Image from "next/image";
import { ImageIcon, PackageCheck } from "lucide-react";
import type { ChangeEvent } from "react";
import { useActionState, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { importReviewedStockInvoiceXmlAction } from "@/presentation/admin/stock/actions";

type ReviewCategory = {
  id: string;
  name: string;
};

type ReviewProduct = {
  id: string;
  name: string;
  sku: string;
  ncm: string | null;
  imageUrl: string | null;
  salePrice: string;
  happyHourPrice: string;
  minStock: number;
  currentStock: number;
  categoryId: string;
};

type ReviewItem = {
  lineNumber: number;
  description: string;
  supplierProductCode?: string;
  supplierEan?: string;
  supplierCommercialEan?: string;
  ncm: string;
  cfop?: string;
  quantity: number;
  unitCost: string;
  totalCost: string;
  commercialUnit?: string;
  commercialQuantity?: number;
  taxableUnit?: string;
  taxableQuantity?: number;
  suggestedDecision: "existing" | "create";
  suggestedSku: string;
  matchedProductId?: string;
  initialProduct: {
    name: string;
    ncm: string;
    imageUrl: string;
    categoryId: string;
    salePrice: string;
    happyHourPrice: string;
    minStock: number;
  };
};

type ProductFields = ReviewItem["initialProduct"];

type StockInvoiceXmlReviewFormProps = {
  stockInvoiceXmlId: string;
  categories: ReviewCategory[];
  products: ReviewProduct[];
  items: ReviewItem[];
};

function moneyLabel(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
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

    const maxSide = 520;
    const ratio = Math.min(maxSide / image.width, maxSide / image.height, 1);
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
    return canvas.toDataURL("image/webp", 0.74);
  } finally {
    URL.revokeObjectURL(imageBitmapUrl);
  }
}

function ProductImageField({
  lineNumber,
  imageUrl,
  name,
  onChange,
}: {
  lineNumber: number;
  imageUrl: string;
  name: string;
  onChange: (nextImageUrl: string) => void;
}) {
  const [imageError, setImageError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
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
      if (previewUrl.length > 350_000) {
        throw new Error("A imagem ficou muito grande. Use um arquivo menor.");
      }

      onChange(previewUrl);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Nao foi possivel processar a imagem.");
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`image-${lineNumber}`}>Imagem</Label>
      <input type="hidden" name={`item.${lineNumber}.imageUrl`} value={imageUrl} />
      <Input
        key={fileInputKey}
        id={`image-${lineNumber}`}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleImageChange}
      />
      {imageError ? <p className="text-xs text-destructive">{imageError}</p> : null}
      <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border/75 bg-background/45">
        {imageUrl ? (
          <Image src={imageUrl} alt={name || "Produto"} fill className="object-contain" unoptimized />
        ) : (
          <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            Sem imagem
          </span>
        )}
      </div>
      {imageUrl ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange("");
            setFileInputKey((current) => current + 1);
          }}
        >
          Remover imagem
        </Button>
      ) : null}
    </div>
  );
}

function StockInvoiceXmlReviewItem({
  item,
  categories,
  products,
}: {
  item: ReviewItem;
  categories: ReviewCategory[];
  products: ReviewProduct[];
}) {
  const [decision, setDecision] = useState<"existing" | "create" | "skip">(item.suggestedDecision);
  const [selectedProductId, setSelectedProductId] = useState(item.matchedProductId ?? products[0]?.id ?? "");
  const [fields, setFields] = useState<ProductFields>(item.initialProduct);
  const selectedProduct = products.find((product) => product.id === selectedProductId);

  function updateFields(nextFields: Partial<ProductFields>) {
    setFields((current) => ({
      ...current,
      ...nextFields,
    }));
  }

  function loadExistingProduct(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) {
      return;
    }

    setFields({
      name: product.name,
      ncm: product.ncm ?? item.ncm,
      imageUrl: product.imageUrl ?? "",
      categoryId: product.categoryId,
      salePrice: product.salePrice,
      happyHourPrice: product.happyHourPrice,
      minStock: product.minStock,
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-border/80 bg-card/55 p-4 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Linha {item.lineNumber} do XML
          </p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">{item.description}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 px-2 py-1">Quantidade {item.quantity}</span>
            <span className="rounded-full border border-border/70 px-2 py-1">Custo {moneyLabel(item.unitCost)}</span>
            <span className="rounded-full border border-border/70 px-2 py-1">Total {moneyLabel(item.totalCost)}</span>
            <span className="rounded-full border border-border/70 px-2 py-1">NCM {item.ncm || "-"}</span>
            <span className="rounded-full border border-border/70 px-2 py-1">CFOP {item.cfop ?? "-"}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            {item.matchedProductId ? "Produto reconhecido" : "Novo produto sugerido"}
          </p>
          <p className="mt-1">
            {item.supplierEan ? `EAN ${item.supplierEan}` : item.supplierProductCode ? `Codigo ${item.supplierProductCode}` : "Sem codigo no XML"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`decision-${item.lineNumber}`}>Destino da linha</Label>
              <select
                id={`decision-${item.lineNumber}`}
                name={`item.${item.lineNumber}.decision`}
                className="admin-native-select"
                value={decision}
                onChange={(event) => {
                  const nextDecision = event.target.value as "existing" | "create" | "skip";
                  setDecision(nextDecision);

                  if (nextDecision === "existing" && selectedProductId) {
                    loadExistingProduct(selectedProductId);
                  }
                }}
              >
                <option value="existing" disabled={products.length === 0}>
                  Usar produto existente
                </option>
                <option value="create">Criar novo produto</option>
                <option value="skip">Ignorar esta linha</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`quantity-${item.lineNumber}`}>Quantidade de entrada</Label>
              <Input
                id={`quantity-${item.lineNumber}`}
                name={`item.${item.lineNumber}.quantity`}
                type="number"
                min={1}
                step={1}
                defaultValue={item.quantity}
                disabled={decision === "skip"}
                required={decision !== "skip"}
              />
            </div>
          </div>

          {decision === "skip" ? (
            <p className="rounded-2xl border border-border/70 bg-background/45 p-4 text-sm text-muted-foreground">
              Esta linha ficara guardada no XML, mas nao cria produto nem movimenta estoque nesta importacao.
            </p>
          ) : (
            <>
              {decision === "existing" ? (
                <div className="space-y-2">
                  <Label htmlFor={`product-${item.lineNumber}`}>Produto cadastrado</Label>
                  <select
                    id={`product-${item.lineNumber}`}
                    name={`item.${item.lineNumber}.productId`}
                    className="admin-native-select"
                    value={selectedProductId}
                    onChange={(event) => loadExistingProduct(event.target.value)}
                    required
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} | {product.sku} | estoque {product.currentStock}
                      </option>
                    ))}
                  </select>
                  {selectedProduct ? (
                    <p className="text-xs text-muted-foreground">
                      Os campos abaixo preservam o cadastro atual por padrao. Ajuste apenas se esta entrada exigir mudanca.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`sku-${item.lineNumber}`}>SKU do novo produto</Label>
                    <Input
                      id={`sku-${item.lineNumber}`}
                      name={`item.${item.lineNumber}.sku`}
                      defaultValue={item.suggestedSku}
                      placeholder="Codigo interno ou EAN"
                    />
                  </div>
                  <p className="self-end rounded-2xl border border-border/70 bg-background/45 p-3 text-xs text-muted-foreground">
                    Se este SKU ja existir, o sistema cria um codigo seguro sem misturar produtos.
                  </p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor={`name-${item.lineNumber}`}>Nome no catalogo</Label>
                  <Input
                    id={`name-${item.lineNumber}`}
                    name={`item.${item.lineNumber}.name`}
                    value={fields.name}
                    onChange={(event) => updateFields({ name: event.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`ncm-${item.lineNumber}`}>NCM</Label>
                  <Input
                    id={`ncm-${item.lineNumber}`}
                    name={`item.${item.lineNumber}.ncm`}
                    value={fields.ncm}
                    onChange={(event) => updateFields({ ncm: event.target.value.replace(/\D/g, "").slice(0, 8) })}
                    inputMode="numeric"
                    maxLength={8}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`category-${item.lineNumber}`}>Categoria</Label>
                  <select
                    id={`category-${item.lineNumber}`}
                    name={`item.${item.lineNumber}.categoryId`}
                    className="admin-native-select"
                    value={fields.categoryId}
                    onChange={(event) => updateFields({ categoryId: event.target.value })}
                    required
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`unit-cost-${item.lineNumber}`}>Custo unitario</Label>
                  <Input
                    id={`unit-cost-${item.lineNumber}`}
                    name={`item.${item.lineNumber}.unitCost`}
                    defaultValue={item.unitCost}
                    inputMode="decimal"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`sale-price-${item.lineNumber}`}>Preco de venda</Label>
                  <Input
                    id={`sale-price-${item.lineNumber}`}
                    name={`item.${item.lineNumber}.salePrice`}
                    value={fields.salePrice}
                    onChange={(event) => updateFields({ salePrice: event.target.value })}
                    inputMode="decimal"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`happy-hour-${item.lineNumber}`}>Preco Happy Hour</Label>
                  <Input
                    id={`happy-hour-${item.lineNumber}`}
                    name={`item.${item.lineNumber}.happyHourPrice`}
                    value={fields.happyHourPrice}
                    onChange={(event) => updateFields({ happyHourPrice: event.target.value })}
                    inputMode="decimal"
                    placeholder="Opcional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`min-stock-${item.lineNumber}`}>Estoque minimo</Label>
                  <Input
                    id={`min-stock-${item.lineNumber}`}
                    name={`item.${item.lineNumber}.minStock`}
                    type="number"
                    min={0}
                    step={1}
                    value={fields.minStock}
                    onChange={(event) => updateFields({ minStock: Number(event.target.value || 0) })}
                    required
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {decision === "skip" ? null : (
          <ProductImageField
            lineNumber={item.lineNumber}
            imageUrl={fields.imageUrl}
            name={fields.name}
            onChange={(imageUrl) => updateFields({ imageUrl })}
          />
        )}
      </div>
    </section>
  );
}

export function StockInvoiceXmlReviewForm({
  stockInvoiceXmlId,
  categories,
  products,
  items,
}: StockInvoiceXmlReviewFormProps) {
  const [state, formAction] = useActionState(importReviewedStockInvoiceXmlAction, initialActionState);

  return (
    <form
      action={formAction}
      className="space-y-5"
      onSubmit={(event) => {
        if (!window.confirm("Confirmar a entrada revisada deste XML no estoque?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="stockInvoiceXmlId" value={stockInvoiceXmlId} />

      <div className="rounded-[1.75rem] border border-primary/25 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <PackageCheck className="h-4 w-4 text-primary" />
              Conferencia obrigatoria
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha o destino de cada linha, ajuste precos e confirme. Nada entra no estoque antes deste passo.
            </p>
          </div>
          <FormSubmitButton>Confirmar entrada revisada</FormSubmitButton>
        </div>
        <div className="mt-3">
          <ActionFeedback state={state} />
        </div>
      </div>

      {items.map((item) => (
        <StockInvoiceXmlReviewItem key={item.lineNumber} item={item} categories={categories} products={products} />
      ))}

      <div className="flex flex-col items-start gap-3 rounded-[1.75rem] border border-border/80 bg-card/55 p-4">
        <FormSubmitButton>Confirmar entrada revisada</FormSubmitButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
