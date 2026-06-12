"use client";

import { PencilLine } from "lucide-react";
import type { ProductKind, RecordStatus, StockUnit } from "@prisma/client";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { updateProductAction } from "@/presentation/admin/catalog/products/actions";
import { CreateProductForm } from "@/presentation/admin/catalog/products/create-product-form";

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
  tracksStock: boolean;
  currentStock: number;
  stockUnit: StockUnit;
};

type EditProductDialogProps = {
  categories: ProductOption[];
  suppliers: SupplierOption[];
  stockIngredients: StockIngredientOption[];
  product: {
    id: string;
    name: string;
  };
};

type ProductEditPayload = {
  id: string;
  name: string;
  sku: string;
  ncm?: string | null;
  fiscalCfop?: string | null;
  fiscalCsosn?: string | null;
  fiscalIcmsOrigin?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  kind: ProductKind;
  serviceCnae?: string | null;
  serviceDescription?: string | null;
  gameplayPlanCode?: string | null;
  gameplayDurationMinutes?: number | null;
  tracksStock: boolean;
  categoryId: string;
  supplierId?: string | null;
  costPrice: string;
  salePrice: string;
  happyHourPrice?: string | null;
  minStock: number;
  currentStock: number;
  stockUnit: StockUnit;
  recipeIngredients?: Array<{
    ingredientProductId: string;
    quantity: number;
  }>;
  status: RecordStatus;
};

export function EditProductDialog({ categories, suppliers, stockIngredients, product }: EditProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [productPayload, setProductPayload] = useState<ProductEditPayload | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen || productPayload || isLoadingProduct) {
      return;
    }

    try {
      setIsLoadingProduct(true);
      setLoadError(null);
      const response = await fetch(`/api/admin/products/${product.id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel carregar os dados do produto.");
      }

      const payload = (await response.json()) as ProductEditPayload;
      setProductPayload(payload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Nao foi possivel carregar o produto.");
    } finally {
      setIsLoadingProduct(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" type="button" />}>
        <PencilLine className="h-4 w-4" />
        Editar
      </DialogTrigger>
      <DialogContent className="max-w-[min(1100px,95vw)] gap-0 border-border/80 bg-card p-0 sm:max-w-[min(1100px,95vw)]">
        <DialogHeader className="border-b border-border/70 px-5 py-4 pr-14">
          <DialogTitle>Editar produto</DialogTitle>
          <DialogDescription>Ajuste imagem, fiscal, venda, estoque, receita e combo do produto.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[78vh] overflow-y-auto p-5">
          {isLoadingProduct ? (
            <div className="rounded-2xl border border-border/70 bg-background/35 p-6 text-sm text-muted-foreground">
              Carregando dados completos do produto...
            </div>
          ) : null}

          {loadError ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
              {loadError} Contate o Mateus.
            </div>
          ) : null}

          {productPayload ? (
            <CreateProductForm
              action={updateProductAction}
              categories={categories}
              suppliers={suppliers}
              stockIngredients={stockIngredients}
              submitLabel="Salvar alteracoes"
              initialData={{
                productId: productPayload.id,
                name: productPayload.name,
                sku: productPayload.sku,
                ncm: productPayload.ncm ?? "",
                fiscalCfop: productPayload.fiscalCfop ?? "",
                fiscalCsosn: productPayload.fiscalCsosn ?? "",
                fiscalIcmsOrigin: productPayload.fiscalIcmsOrigin ?? "",
                description: productPayload.description,
                imageUrl: productPayload.imageUrl,
                kind: productPayload.kind,
                serviceCnae: productPayload.serviceCnae,
                serviceDescription: productPayload.serviceDescription,
                gameplayPlanCode: productPayload.gameplayPlanCode,
                gameplayDurationMinutes: productPayload.gameplayDurationMinutes,
                tracksStock: productPayload.tracksStock,
                categoryId: productPayload.categoryId,
                supplierId: productPayload.supplierId,
                costPrice: productPayload.costPrice,
                salePrice: productPayload.salePrice,
                happyHourPrice: productPayload.happyHourPrice,
                minStock: productPayload.minStock,
                currentStock: productPayload.currentStock,
                stockUnit: productPayload.stockUnit,
                recipeIngredients: productPayload.recipeIngredients,
                status: productPayload.status,
              }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
