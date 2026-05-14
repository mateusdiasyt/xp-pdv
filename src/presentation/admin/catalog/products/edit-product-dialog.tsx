"use client";

import { PencilLine } from "lucide-react";
import { ProductKind, RecordStatus } from "@prisma/client";
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

type EditProductDialogProps = {
  categories: ProductOption[];
  suppliers: SupplierOption[];
  product: {
    id: string;
    name: string;
    sku: string;
    ncm?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    kind: ProductKind;
    gameplayPlanCode?: string | null;
    gameplayDurationMinutes?: number | null;
    categoryId: string;
    supplierId?: string | null;
    costPrice: string;
    salePrice: string;
    minStock: number;
    currentStock: number;
    status: RecordStatus;
  };
};

export function EditProductDialog({ categories, suppliers, product }: EditProductDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" type="button" />}>
        <PencilLine className="h-4 w-4" />
        Editar
      </DialogTrigger>
      <DialogContent className="max-w-[min(1100px,95vw)] gap-0 border-border/80 bg-card p-0 sm:max-w-[min(1100px,95vw)]">
        <DialogHeader className="border-b border-border/70 px-5 py-4 pr-14">
          <DialogTitle>Editar produto</DialogTitle>
          <DialogDescription>Ajuste imagem, precificacao, estoque e dados de catalogo.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[78vh] overflow-y-auto p-5">
          <CreateProductForm
            action={updateProductAction}
            categories={categories}
            suppliers={suppliers}
            submitLabel="Salvar alteracoes"
            initialData={{
              productId: product.id,
              name: product.name,
              sku: product.sku,
              ncm: product.ncm ?? "",
              description: product.description,
              imageUrl: product.imageUrl,
              kind: product.kind,
              gameplayPlanCode: product.gameplayPlanCode,
              gameplayDurationMinutes: product.gameplayDurationMinutes,
              categoryId: product.categoryId,
              supplierId: product.supplierId,
              costPrice: product.costPrice,
              salePrice: product.salePrice,
              minStock: product.minStock,
              currentStock: product.currentStock,
              status: product.status,
            }}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
