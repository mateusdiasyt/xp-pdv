"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { addComandaItemAction } from "@/presentation/admin/pdv/actions";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
};

type AddComandaItemFormProps = {
  comandaId: string;
  products: ProductOption[];
};

export function AddComandaItemForm({ comandaId, products }: AddComandaItemFormProps) {
  const [state, formAction] = useActionState(addComandaItemAction, initialActionState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto]">
      <input type="hidden" name="comandaId" value={comandaId} />

      <div className="space-y-2">
        <Label htmlFor={`productId-${comandaId}`}>Produto</Label>
        <select id={`productId-${comandaId}`} name="productId" className="admin-native-select" required>
          <option value="">Selecione um produto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.sku})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`quantity-${comandaId}`}>Quantidade</Label>
        <Input id={`quantity-${comandaId}`} name="quantity" type="number" min={1} step={1} defaultValue={1} required />
      </div>

      <div className="self-end">
        <FormSubmitButton>Adicionar item</FormSubmitButton>
      </div>

      <div className="md:col-span-3">
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
