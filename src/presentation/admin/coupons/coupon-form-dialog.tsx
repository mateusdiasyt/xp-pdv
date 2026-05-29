"use client";

import { CouponDiscountType, RecordStatus } from "@prisma/client";
import { BadgePercent, Boxes, Globe2, HelpCircle, Package, Pencil, Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { saveCouponRequest } from "@/presentation/admin/coupons/actions";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  category: {
    name: string;
  };
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type CouponPayload = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: { toString(): string };
  maxDiscountAmount: { toString(): string } | null;
  minSubtotalAmount: { toString(): string } | null;
  usageLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  status: RecordStatus;
  products: Array<{
    productId: string;
  }>;
  categories: Array<{
    categoryId: string;
  }>;
};

type CouponFormDialogProps = {
  coupon?: CouponPayload;
  products: ProductOption[];
  categories: CategoryOption[];
};

type CouponScope = "all" | "categories" | "products";

function dateInputValue(value?: Date | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 16);
}

function moneyValue(value?: { toString(): string } | null) {
  return value ? Number(value.toString()).toFixed(2) : "";
}

function Help({ title }: { title: string }) {
  return (
    <span title={title} aria-label={title}>
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}

export function CouponFormDialog({ coupon, products, categories }: CouponFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(initialActionState);
  const [isPending, startTransition] = useTransition();
  const selectedProductIds = new Set(coupon?.products.map((product) => product.productId) ?? []);
  const selectedCategoryIds = new Set(coupon?.categories.map((category) => category.categoryId) ?? []);
  const initialScope: CouponScope =
    selectedCategoryIds.size > 0 ? "categories" : selectedProductIds.size > 0 ? "products" : "all";
  const [scope, setScope] = useState<CouponScope>(initialScope);

  useEffect(() => {
    if (state.status === "success") {
      const timeoutId = window.setTimeout(() => setOpen(false), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [state.status]);

  useEffect(() => {
    if (open) {
      const timeoutId = window.setTimeout(() => setScope(initialScope), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [initialScope, open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setState(initialActionState);
    startTransition(async () => {
      const result = await saveCouponRequest(formData);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size={coupon ? "icon-sm" : "sm"} variant={coupon ? "ghost" : "default"} />}>
        {coupon ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {coupon ? <span className="sr-only">Editar cupom</span> : "Novo cupom"}
      </DialogTrigger>
      <DialogContent className="max-w-[min(860px,95vw)] border-border/80 bg-card p-0 sm:max-w-[min(860px,95vw)]">
        <DialogHeader className="border-b border-border/70 px-5 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-primary" />
            {coupon ? "Editar cupom" : "Novo cupom"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="admin-scrollbar max-h-[78vh] space-y-4 overflow-y-auto p-5">
          <input type="hidden" name="couponId" value={coupon?.id ?? ""} />

          <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_150px]">
            <div className="space-y-2">
              <Label htmlFor="coupon-code" className="flex items-center gap-1.5">
                Codigo <Help title="Codigo digitado no PDV. Ex.: CHOPP10" />
              </Label>
              <Input id="coupon-code" name="code" defaultValue={coupon?.code ?? ""} placeholder="CHOPP10" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-name">Nome</Label>
              <Input id="coupon-name" name="name" defaultValue={coupon?.name ?? ""} placeholder="Promocao balcão" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-status">Status</Label>
              <select id="coupon-status" name="status" className="admin-native-select" defaultValue={coupon?.status ?? RecordStatus.ACTIVE}>
                <option value={RecordStatus.ACTIVE}>Ativo</option>
                <option value={RecordStatus.INACTIVE}>Inativo</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-type">Tipo</Label>
              <select id="coupon-type" name="discountType" className="admin-native-select" defaultValue={coupon?.discountType ?? CouponDiscountType.PERCENTAGE}>
                <option value={CouponDiscountType.PERCENTAGE}>%</option>
                <option value={CouponDiscountType.FIXED_AMOUNT}>R$</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-value">Valor</Label>
              <Input id="coupon-value" name="discountValue" defaultValue={moneyValue(coupon?.discountValue) || "10.00"} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-min" className="flex items-center gap-1.5">
                Minimo <Help title="Valor minimo da venda para aceitar o cupom." />
              </Label>
              <Input id="coupon-min" name="minSubtotalAmount" defaultValue={moneyValue(coupon?.minSubtotalAmount)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-cap" className="flex items-center gap-1.5">
                Teto <Help title="Limite maximo de desconto. Ideal para cupom em porcentagem." />
              </Label>
              <Input id="coupon-cap" name="maxDiscountAmount" defaultValue={moneyValue(coupon?.maxDiscountAmount)} placeholder="Opcional" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="coupon-limit">Usos</Label>
              <Input id="coupon-limit" name="usageLimit" type="number" min={1} step={1} defaultValue={coupon?.usageLimit ?? ""} placeholder="Sem limite" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-start">Inicio</Label>
              <Input id="coupon-start" name="startsAt" type="datetime-local" defaultValue={dateInputValue(coupon?.startsAt)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-end">Fim</Label>
              <Input id="coupon-end" name="endsAt" type="datetime-local" defaultValue={dateInputValue(coupon?.endsAt)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coupon-description">Nota interna</Label>
            <Input id="coupon-description" name="description" defaultValue={coupon?.description ?? ""} placeholder="Opcional" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Aplicacao <Help title="Escolha se o cupom vale para tudo, categorias ou produtos especificos." />
            </Label>
            <div className="grid gap-2 md:grid-cols-3">
              {[
                { value: "all" as const, label: "Tudo", icon: Globe2 },
                { value: "categories" as const, label: "Categorias", icon: Boxes },
                { value: "products" as const, label: "Produtos", icon: Package },
              ].map((option) => {
                const Icon = option.icon;
                const active = scope === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScope(option.value)}
                    className={`flex items-center gap-3 rounded-[1rem] border p-3 text-left transition-colors ${
                      active
                        ? "border-primary/55 bg-primary/12 text-foreground"
                        : "border-border/70 bg-background/24 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-semibold">{option.label}</span>
                  </button>
                );
              })}
            </div>
            {scope === "categories" ? (
              <div className="admin-scrollbar grid max-h-52 gap-2 overflow-y-auto rounded-[1rem] border border-border/70 bg-background/24 p-2 md:grid-cols-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-background/45">
                    <input name="categoryId" value={category.id} type="checkbox" defaultChecked={selectedCategoryIds.has(category.id)} className="h-4 w-4 accent-primary" />
                    <span className="truncate text-foreground">{category.name}</span>
                  </label>
                ))}
              </div>
            ) : null}
            {scope === "products" ? (
            <div className="admin-scrollbar grid max-h-52 gap-2 overflow-y-auto rounded-[1rem] border border-border/70 bg-background/24 p-2 md:grid-cols-2">
              {products.map((product) => (
                <label key={product.id} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-background/45">
                  <input name="productId" value={product.id} type="checkbox" defaultChecked={selectedProductIds.has(product.id)} className="h-4 w-4 accent-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{product.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{product.category.name} · {product.sku}</span>
                  </span>
                </label>
              ))}
            </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
            <ActionFeedback state={state} />
            <Button type="submit" disabled={isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
