"use client";

import Image from "next/image";
import { ProductKind, RecordStatus, StockUnit } from "@prisma/client";
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

type StockIngredientOption = {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  stockUnit: StockUnit;
};

type ProductFormInitialData = {
  productId?: string;
  name?: string;
  sku?: string;
  ncm?: string;
  description?: string | null;
  imageUrl?: string | null;
  kind?: ProductKind;
  serviceCnae?: string | null;
  serviceDescription?: string | null;
  gameplayPlanCode?: string | null;
  gameplayDurationMinutes?: number | null;
  tracksStock?: boolean;
  categoryId?: string;
  supplierId?: string | null;
  costPrice?: string;
  salePrice?: string;
  happyHourPrice?: string | null;
  minStock?: number;
  currentStock?: number;
  stockUnit?: StockUnit;
  recipeIngredientProductId?: string | null;
  recipeQuantity?: number | null;
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
  stockIngredients: StockIngredientOption[];
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

const serviceCnaeOptions = [
  {
    value: "9329804",
    label: "93.29-8-04 - Jogos eletronicos recreativos",
  },
  {
    value: "9329803",
    label: "93.29-8-03 - Sinuca, bilhar e similares",
  },
];

async function buildImagePreviewDataUrl(file: File) {
  const imageBitmapUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new window.Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Nao foi possivel carregar a imagem selecionada."));
      nextImage.src = imageBitmapUrl;
    });

    const maxWidth = 520;
    const maxHeight = 520;
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
    return canvas.toDataURL("image/webp", 0.74);
  } finally {
    URL.revokeObjectURL(imageBitmapUrl);
  }
}

export function CreateProductForm({
  action,
  categories,
  suppliers,
  stockIngredients,
  submitLabel,
  initialData,
  onSuccess,
}: ProductFormProps) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(initialData?.imageUrl ?? "");
  const [imageError, setImageError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [productKind, setProductKind] = useState(initialData?.kind ?? ProductKind.STANDARD);
  const [tracksStock, setTracksStock] = useState(initialData?.tracksStock ?? true);
  const [serviceCnae, setServiceCnae] = useState(
    initialData?.serviceCnae ?? (initialData?.kind === ProductKind.GAMEPLAY ? "9329804" : "9329803"),
  );
  const isGameplay = productKind === ProductKind.GAMEPLAY;
  const isServiceLike = productKind !== ProductKind.STANDARD;
  const usesStockControls = !isServiceLike && tracksStock;
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

      if (previewUrl.length > 350_000) {
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

  function handleProductKindChange(nextKind: ProductKind) {
    setProductKind(nextKind);

    if (nextKind === ProductKind.GAMEPLAY) {
      setServiceCnae("9329804");
    }

    if (nextKind === ProductKind.SERVICE) {
      setServiceCnae("9329803");
    }
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

        {!isServiceLike ? (
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
        ) : (
          <input type="hidden" name="ncm" value="" />
        )}

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
          <Label htmlFor="kind">Tipo de produto</Label>
          <select
            id="kind"
            name="kind"
            className="admin-native-select"
            value={productKind}
            onChange={(event) => handleProductKindChange(event.target.value as ProductKind)}
          >
            <option value={ProductKind.STANDARD}>Produto comum</option>
            <option value={ProductKind.GAMEPLAY}>Gameplay / TV</option>
            <option value={ProductKind.SERVICE}>Servico manual</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Produto comum gera NFC-e. Gameplay e servico manual entram na apuracao de NFS-e municipal.
          </p>
        </div>

        {isServiceLike ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="serviceCnae">CNAE do servico</Label>
              <select
                id="serviceCnae"
                name="serviceCnae"
                className="admin-native-select"
                value={serviceCnae}
                onChange={(event) => setServiceCnae(event.target.value)}
                required
              >
                {serviceCnaeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Esse CNAE sera usado na apuracao semanal para emitir NFS-e no Gestao ISS.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Descricao fiscal do servico</Label>
              <Input
                id="serviceDescription"
                name="serviceDescription"
                placeholder={isGameplay ? "Uso de jogos eletronicos recreativos" : "Uso de sinuca/bilhar"}
                defaultValue={initialData?.serviceDescription ?? ""}
              />
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="serviceCnae" value="" />
            <input type="hidden" name="serviceDescription" value="" />
          </>
        )}

        {isGameplay ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="gameplayPlanCode">Codigo do plano</Label>
              <Input
                id="gameplayPlanCode"
                name="gameplayPlanCode"
                placeholder="GAMEPLAY-60"
                defaultValue={initialData?.gameplayPlanCode ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gameplayDurationMinutes">Duracao (minutos)</Label>
              <Input
                id="gameplayDurationMinutes"
                name="gameplayDurationMinutes"
                type="number"
                min={1}
                step={1}
                placeholder="60"
                defaultValue={initialData?.gameplayDurationMinutes ?? ""}
                required
              />
            </div>

            <input type="hidden" name="supplierId" value="" />
            <input type="hidden" name="tracksStock" value="false" />
            <input type="hidden" name="costPrice" value="0.00" />
            <input type="hidden" name="minStock" value="0" />
            <input type="hidden" name="currentStock" value="0" />
            <input type="hidden" name="stockUnit" value={StockUnit.UNIT} />
            <input type="hidden" name="recipeIngredientProductId" value="" />
            <input type="hidden" name="recipeQuantity" value="" />

            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm text-muted-foreground md:col-span-2">
              <strong className="mb-1 block text-foreground">Gameplay e tratado como servico municipal.</strong>
              Ele nao usa estoque, custo, fornecedor ou NCM. O valor vai para apuracao de NFS-e e a TV continua sendo liberada pelo PDV.
            </div>
          </>
        ) : isServiceLike ? (
          <>
            <input type="hidden" name="supplierId" value="" />
            <input type="hidden" name="tracksStock" value="false" />
            <input type="hidden" name="costPrice" value="0.00" />
            <input type="hidden" name="minStock" value="0" />
            <input type="hidden" name="currentStock" value="0" />
            <input type="hidden" name="stockUnit" value={StockUnit.UNIT} />
            <input type="hidden" name="recipeIngredientProductId" value="" />
            <input type="hidden" name="recipeQuantity" value="" />
            <input type="hidden" name="gameplayPlanCode" value="" />
            <input type="hidden" name="gameplayDurationMinutes" value="" />

            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm text-muted-foreground md:col-span-2">
              <strong className="mb-1 block text-foreground">Servico manual nao entra na NFC-e de produtos.</strong>
              Use para sinuca, bilhar e servicos semelhantes. Ele vai para a apuracao semanal de NFS-e por CNAE.
            </div>
          </>
        ) : (
          <>
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

            <input type="hidden" name="gameplayPlanCode" value="" />
            <input type="hidden" name="gameplayDurationMinutes" value="" />

            <div className="space-y-2">
              <Label htmlFor="tracksStock">Controle de estoque</Label>
              <select
                id="tracksStock"
                name="tracksStock"
                className="admin-native-select"
                value={tracksStock ? "true" : "false"}
                onChange={(event) => setTracksStock(event.target.value === "true")}
              >
                <option value="true">Controlar saldo</option>
                <option value="false">Vender sem controlar estoque</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Use sem controle para drinks, chopp e itens preparados que continuam emitindo NFC-e.
              </p>
            </div>
          </>
        )}

        {!isServiceLike ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="costPrice">Custo (R$)</Label>
              <Input id="costPrice" name="costPrice" placeholder="10.00" defaultValue={initialData?.costPrice ?? ""} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salePrice">Preco de venda (R$)</Label>
              <Input id="salePrice" name="salePrice" placeholder="15.00" defaultValue={initialData?.salePrice ?? ""} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="happyHourPrice">Valor Happy Hour (R$)</Label>
              <Input
                id="happyHourPrice"
                name="happyHourPrice"
                placeholder="Opcional"
                defaultValue={initialData?.happyHourPrice ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Quando o Happy Hour estiver ativo no PDV, este valor substitui o preco principal.
              </p>
            </div>

            {usesStockControls ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="stockUnit">Unidade do estoque</Label>
                  <select
                    id="stockUnit"
                    name="stockUnit"
                    className="admin-native-select"
                    defaultValue={initialData?.stockUnit ?? StockUnit.UNIT}
                  >
                    <option value={StockUnit.UNIT}>Unidades</option>
                    <option value={StockUnit.MILLILITER}>Mililitros</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Use mililitros para barril, garrafa base ou outro insumo fracionado.
                  </p>
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
              </>
            ) : (
              <>
                <input type="hidden" name="minStock" value="0" />
                <input type="hidden" name="currentStock" value="0" />
                <input type="hidden" name="stockUnit" value={StockUnit.UNIT} />
                <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm text-muted-foreground md:col-span-2">
                  <strong className="mb-1 block text-foreground">Venda sem bloqueio por estoque.</strong>
                  O item continua como produto fiscal para NFC-e, mas nao bloqueia venda nem gera baixa automatica de estoque.
                </div>
              </>
            )}

            <div className="space-y-3 rounded-2xl border border-border/75 bg-background/35 p-4 md:col-span-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Consumo de insumo fracionado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Para um copo de chopp, selecione o barril e informe quanto sai do saldo a cada item vendido.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-2">
                  <Label htmlFor="recipeIngredientProductId">Insumo baixado na venda</Label>
                  <select
                    id="recipeIngredientProductId"
                    name="recipeIngredientProductId"
                    className="admin-native-select"
                    defaultValue={initialData?.recipeIngredientProductId ?? ""}
                  >
                    <option value="">Nao usar insumo</option>
                    {stockIngredients
                      .filter((ingredient) => ingredient.id !== initialData?.productId)
                      .map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name} | {ingredient.sku} | {ingredient.currentStock}{" "}
                          {ingredient.stockUnit === StockUnit.MILLILITER ? "ml" : "un"}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipeQuantity">Consumo por venda</Label>
                  <Input
                    id="recipeQuantity"
                    name="recipeQuantity"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Ex.: 500"
                    defaultValue={initialData?.recipeQuantity ?? ""}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="salePrice">{isGameplay ? "Valor do plano (R$)" : "Valor do servico (R$)"}</Label>
              <Input id="salePrice" name="salePrice" placeholder="15.00" defaultValue={initialData?.salePrice ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="happyHourPrice">Valor Happy Hour (R$)</Label>
              <Input
                id="happyHourPrice"
                name="happyHourPrice"
                placeholder="Opcional"
                defaultValue={initialData?.happyHourPrice ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Opcional para promocoes temporarias no PDV.
              </p>
            </div>
          </>
        )}

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
