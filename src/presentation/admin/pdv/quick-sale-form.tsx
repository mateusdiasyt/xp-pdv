"use client";

import Image from "next/image";
import Link from "next/link";

import { PaymentMethod } from "@prisma/client";
import {
  Beef,
  Candy,
  Check,
  Coffee,
  GlassWater,
  Grid2x2,
  Package2,
  Pizza,
  Plus,
  Receipt,
  Sandwich,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { useActionState, useDeferredValue, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { closeQuickSaleAction } from "@/presentation/admin/pdv/actions";

type CustomerOption = {
  id: string;
  fullName: string;
  documentType: "CPF" | "RG";
  documentNumber: string;
};

type OpenSessionOption = {
  id: string;
  cashRegister: {
    name: string;
    code: string;
  };
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  imageUrl?: string | null;
  salePrice: number;
  currentStock: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
};

type QuickSaleFormProps = {
  customers: CustomerOption[];
  openSessions: OpenSessionOption[];
  products: ProductOption[];
  canManage: boolean;
};

type PaymentLine = {
  id: number;
  method: PaymentMethod;
  amount: string;
};

type CartLine = {
  productId: string;
  quantity: number;
};

type CategoryFilterOption = {
  id: string;
  name: string;
  slug: string;
};

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Cartao de credito",
  DEBIT_CARD: "Cartao de debito",
};

const quantityInputClassName =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function parseMoneyToCents(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  let normalized = trimmed.replace(/\s/g, "");
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function productAvatarLabel(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getCategoryIcon(slug: string, name: string) {
  const normalized = `${slug} ${name}`.toLowerCase();

  if (
    normalized.includes("bebida") ||
    normalized.includes("drink") ||
    normalized.includes("refrigerante") ||
    normalized.includes("suco") ||
    normalized.includes("agua") ||
    normalized.includes("water")
  ) {
    return GlassWater;
  }

  if (normalized.includes("cafe") || normalized.includes("coffee")) {
    return Coffee;
  }

  if (
    normalized.includes("doce") ||
    normalized.includes("sobremesa") ||
    normalized.includes("candy") ||
    normalized.includes("chocolate")
  ) {
    return Candy;
  }

  if (
    normalized.includes("lanche") ||
    normalized.includes("burger") ||
    normalized.includes("hamburg") ||
    normalized.includes("sandu") ||
    normalized.includes("sandwich")
  ) {
    return Sandwich;
  }

  if (normalized.includes("pizza")) {
    return Pizza;
  }

  if (normalized.includes("carne") || normalized.includes("beef") || normalized.includes("churrasco")) {
    return Beef;
  }

  return Package2;
}

function ProductCardMedia({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string | null;
}) {
  if (!imageUrl) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-[1.4rem] border border-dashed border-border/75 bg-background/38 text-xl font-semibold tracking-[-0.04em] text-muted-foreground">
        {productAvatarLabel(name)}
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[1.4rem] border border-border/75 bg-background/30">
      <Image src={imageUrl} alt={name} fill className="object-cover" unoptimized />
    </div>
  );
}

export function QuickSaleForm({ customers, openSessions, products, canManage }: QuickSaleFormProps) {
  const [saleState, saleFormAction] = useActionState(closeQuickSaleAction, initialActionState);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const deferredProductSearch = useDeferredValue(productSearch);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [quantityByProduct, setQuantityByProduct] = useState<Record<string, string>>({});
  const [discountAmount, setDiscountAmount] = useState("0.00");
  const [cashReceived, setCashReceived] = useState("");
  const [paymentLineSeed, setPaymentLineSeed] = useState(1);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    { id: 1, method: PaymentMethod.PIX, amount: "0.00" },
  ]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);

  const hasOpenSessions = openSessions.length > 0;
  const hasProducts = products.length > 0;
  const normalizedSearch = deferredProductSearch.trim().toLowerCase();
  const categoryFilters = products.reduce<CategoryFilterOption[]>((categories, product) => {
    if (categories.some((category) => category.id === product.category.id)) {
      return categories;
    }

    categories.push({
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    });

    return categories;
  }, []);
  categoryFilters.sort((firstCategory, secondCategory) => firstCategory.name.localeCompare(secondCategory.name));

  const filteredProducts = products.filter((product) => {
    if (selectedCategoryId !== "all" && product.category.id !== selectedCategoryId) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [product.name, product.category.name].join(" ").toLowerCase().includes(normalizedSearch);
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const cartItems = cartLines
    .map((line) => {
      const product = productMap.get(line.productId);
      if (!product) {
        return null;
      }

      return {
        ...line,
        product,
        lineTotal: product.salePrice * line.quantity,
      };
    })
    .filter(Boolean) as Array<{ productId: string; quantity: number; product: ProductOption; lineTotal: number }>;

  const subtotalInCents = cartItems.reduce((sum, item) => sum + Math.round(item.lineTotal * 100), 0);
  const discountInCents = Math.max(0, parseMoneyToCents(discountAmount));
  const totalInCents = Math.max(subtotalInCents - discountInCents, 0);
  const paymentsTotalInCents = paymentLines.reduce(
    (acc, paymentLine) => acc + Math.max(0, parseMoneyToCents(paymentLine.amount)),
    0,
  );
  const paymentDifferenceInCents = totalInCents - paymentsTotalInCents;
  const hasCashPayment = paymentLines.some((paymentLine) => paymentLine.method === PaymentMethod.CASH);
  const cashPaymentTotalInCents = paymentLines.reduce((acc, paymentLine) => {
    if (paymentLine.method !== PaymentMethod.CASH) {
      return acc;
    }

    return acc + Math.max(0, parseMoneyToCents(paymentLine.amount));
  }, 0);
  const cashReceivedInCents = Math.max(0, parseMoneyToCents(cashReceived));
  const changeInCents = Math.max(cashReceivedInCents - cashPaymentTotalInCents, 0);
  const normalizedCustomerQuery = customerQuery.trim().toLowerCase();
  const normalizedCustomerQueryDigits = normalizeDigits(customerQuery);
  const filteredCustomers = customers
    .filter((customer) => {
      if (!normalizedCustomerQuery) {
        return true;
      }

      const matchesName = customer.fullName.toLowerCase().includes(normalizedCustomerQuery);
      const matchesDocument = normalizeDigits(customer.documentNumber).includes(normalizedCustomerQueryDigits);
      return matchesName || (normalizedCustomerQueryDigits.length > 0 && matchesDocument);
    })
    .slice(0, 8);
  const customerNameValue = selectedCustomer?.fullName ?? customerQuery.trim();

  function addToCart(productId: string, quantityRaw: string) {
    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return;
    }

    setCartLines((currentLines) => {
      const existingLine = currentLines.find((line) => line.productId === productId);
      if (!existingLine) {
        return [...currentLines, { productId, quantity }];
      }

      return currentLines.map((line) =>
        line.productId === productId
          ? {
              ...line,
              quantity: line.quantity + quantity,
            }
          : line,
      );
    });
  }

  function updateCartQuantity(productId: string, quantityRaw: string) {
    const quantity = Math.max(1, Number(quantityRaw) || 1);
    setCartLines((currentLines) =>
      currentLines.map((line) =>
        line.productId === productId
          ? {
              ...line,
              quantity,
            }
          : line,
      ),
    );
  }

  function removeFromCart(productId: string) {
    setCartLines((currentLines) => currentLines.filter((line) => line.productId !== productId));
  }

  function updatePaymentLine(id: number, field: "method" | "amount", value: string) {
    setPaymentLines((currentLines) =>
      currentLines.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]: field === "method" ? (value as PaymentMethod) : value,
            }
          : line,
      ),
    );
  }

  function addPaymentLine() {
    const nextSeed = paymentLineSeed + 1;
    setPaymentLineSeed(nextSeed);
    setPaymentLines((currentLines) => [
      ...currentLines,
      {
        id: nextSeed,
        method: PaymentMethod.CASH,
        amount: "0.00",
      },
    ]);
  }

  function removePaymentLine(id: number) {
    setPaymentLines((currentLines) => {
      if (currentLines.length === 1) {
        return currentLines;
      }
      return currentLines.filter((line) => line.id !== id);
    });
  }

  function handleCustomerSelected(customer: CustomerOption | null) {
    setSelectedCustomer(customer);
    setCustomerQuery(customer?.fullName ?? "");
    setIsCustomerSearchOpen(false);
  }

  return (
    <div className="space-y-4">
      <header className="rounded-[1.4rem] border border-border/75 bg-background/38 px-4 py-3.5">
        <p className="text-base font-semibold text-foreground">Venda rapida com ticket</p>
        <p className="text-xs text-muted-foreground">
          Pedido agil de balcao com impressao do ticket do cliente e via interna.
        </p>
      </header>

      {!canManage ? (
        <section className="rounded-[1.35rem] border border-dashed border-border/75 bg-background/32 px-4 py-5 text-sm text-muted-foreground">
          Modo leitura.
        </section>
      ) : !hasOpenSessions ? (
        <section className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/8 px-4 py-4">
          <p className="text-sm text-amber-100">Abra um caixa para iniciar a venda rapida.</p>
          <Link
            href="/admin/cash"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25"
          >
            Abrir caixa
          </Link>
        </section>
      ) : (
        <form action={saleFormAction} className="grid gap-4 2xl:grid-cols-[minmax(0,1.16fr)_minmax(350px,390px)]">
          <input type="hidden" name="customerName" value={customerNameValue} />
          {cartItems.map((item) => (
            <div key={`quick-item-${item.productId}`}>
              <input type="hidden" name="itemProductId" value={item.productId} />
              <input type="hidden" name="itemQuantity" value={String(item.quantity)} />
            </div>
          ))}

          <div className="space-y-4">
            <section className="admin-form-section space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quick-sale-customer">Cliente (opcional)</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <Input
                    id="quick-sale-customer"
                    value={customerQuery}
                    onChange={(event) => {
                      setCustomerQuery(event.target.value);
                      setSelectedCustomer(null);
                      setIsCustomerSearchOpen(true);
                    }}
                    onFocus={() => setIsCustomerSearchOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setIsCustomerSearchOpen(false);
                      }, 120);
                    }}
                    placeholder="Buscar por nome ou CPF"
                    className="h-10 rounded-full border-border/70 bg-background/68 pl-9 pr-3 text-sm"
                    autoComplete="off"
                  />

                  {isCustomerSearchOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.55rem)] z-20 w-full overflow-hidden rounded-[1.25rem] border border-border/80 bg-popover/96 shadow-2xl shadow-black/30 backdrop-blur">
                      <div className="admin-scrollbar max-h-72 overflow-y-auto p-2">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-background/55"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleCustomerSelected(null)}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">Sem cliente vinculado</p>
                            <p className="text-xs text-muted-foreground">Manter venda avulsa</p>
                          </div>
                          {!selectedCustomer ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>

                        {filteredCustomers.length === 0 ? (
                          <div className="px-3 py-4 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                        ) : (
                          filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-background/55"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleCustomerSelected(customer)}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{customer.fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {customer.documentType}: {customer.documentNumber}
                                </p>
                              </div>
                              {selectedCustomer?.id === customer.id ? <Check className="h-4 w-4 text-primary" /> : null}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_168px]">
                <div className="space-y-2">
                  <Label htmlFor="quick-sale-session">Caixa</Label>
                  <select
                    id="quick-sale-session"
                    name="cashSessionId"
                    className="admin-native-select"
                    defaultValue={openSessions[0]?.id}
                    required
                  >
                    {openSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.cashRegister.name} ({session.cashRegister.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quick-sale-discount">Desconto (R$)</Label>
                  <Input
                    id="quick-sale-discount"
                    name="discountAmount"
                    value={discountAmount}
                    onChange={(event) => setDiscountAmount(event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
            </section>

            <section className="admin-form-section space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Produtos</p>
                <span className="text-xs text-muted-foreground">{filteredProducts.length} item(ns)</span>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar produto ou categoria"
                    className="pl-9"
                  />
                </div>
                <span className="text-xs text-muted-foreground">{cartItems.length} no pedido</span>
              </div>

              <div className="admin-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId("all")}
                  className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 text-sm font-medium transition-all duration-200 ${
                    selectedCategoryId === "all"
                      ? "border-primary/60 bg-primary/12 text-foreground shadow-[0_10px_20px_-18px_color-mix(in_oklab,var(--primary)_80%,transparent)]"
                      : "border-border/75 bg-background/26 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <Grid2x2 className="h-4 w-4" />
                  <span className="uppercase tracking-[0.12em]">Todos</span>
                </button>

                {categoryFilters.map((category) => {
                  const CategoryIcon = getCategoryIcon(category.slug, category.name);

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 text-sm font-medium transition-all duration-200 ${
                        selectedCategoryId === category.id
                          ? "border-primary/60 bg-primary/12 text-foreground shadow-[0_10px_20px_-18px_color-mix(in_oklab,var(--primary)_80%,transparent)]"
                          : "border-border/75 bg-background/26 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      <CategoryIcon className="h-4 w-4" />
                      <span className="uppercase tracking-[0.12em]">{category.name}</span>
                    </button>
                  );
                })}
              </div>

              {!hasProducts ? (
                <p className="rounded-2xl border border-dashed border-border/75 bg-background/32 px-4 py-6 text-sm text-muted-foreground">
                  Nenhum produto ativo encontrado.
                </p>
              ) : filteredProducts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/75 bg-background/32 px-4 py-6 text-sm text-muted-foreground">
                  Nenhum produto encontrado com este filtro.
                </p>
              ) : (
                <div className="admin-scrollbar max-h-[42rem] overflow-y-auto pr-1">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {filteredProducts.map((product) => {
                      const currentCartLine = cartItems.find((item) => item.productId === product.id);
                      const draftQuantity = quantityByProduct[product.id] ?? "1";

                      return (
                        <div
                          key={product.id}
                          className="group relative flex h-full flex-col gap-2.5 rounded-[1.3rem] border border-border/75 bg-background/30 p-3 transition-all duration-200 hover:border-primary/30 hover:bg-background/42"
                        >
                          {currentCartLine ? (
                            <div className="absolute right-3 top-3 z-10 rounded-full border border-primary/30 bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary">
                              {currentCartLine.quantity} no ticket
                            </div>
                          ) : null}

                          <ProductCardMedia name={product.name} imageUrl={product.imageUrl} />

                          <div className="space-y-1">
                            <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">
                              {product.name}
                            </p>
                            <div className="space-y-0.5 text-xs text-muted-foreground">
                              <p className="font-medium text-foreground/88">{formatCurrency(product.salePrice)}</p>
                              <p>{product.currentStock} em estoque</p>
                            </div>
                          </div>

                          <div className="mt-auto flex items-end gap-2">
                            <div className="min-w-0 flex-1 space-y-1">
                              <Label htmlFor={`quick-product-quantity-${product.id}`}>Qtd</Label>
                              <Input
                                id={`quick-product-quantity-${product.id}`}
                                value={draftQuantity}
                                onChange={(event) =>
                                  setQuantityByProduct((currentMap) => ({
                                    ...currentMap,
                                    [product.id]: event.target.value,
                                  }))
                                }
                                type="number"
                                min={1}
                                step={1}
                                inputMode="numeric"
                                className={quantityInputClassName}
                                required
                              />
                            </div>
                            <Button
                              type="button"
                              size="icon-sm"
                              className="shrink-0 rounded-2xl"
                              onClick={() => addToCart(product.id, draftQuantity)}
                            >
                              <Plus className="h-4 w-4" />
                              <span className="sr-only">Adicionar produto no pedido rapido</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-4">
            <section className="admin-form-section space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Itens do ticket</p>
                <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground">
                  {cartItems.length}
                </span>
              </div>

              {cartItems.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/75 bg-background/32 px-4 py-6 text-sm text-muted-foreground">
                  Selecione os produtos no painel ao lado.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {cartItems.map((item) => (
                    <div key={`quick-cart-${item.productId}`} className="rounded-[1.35rem] border border-border/75 bg-background/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium text-foreground">{item.product.name}</p>
                        <p className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(item.lineTotal)}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={`quick-cart-quantity-${item.productId}`}>Qtd</Label>
                          <Input
                            id={`quick-cart-quantity-${item.productId}`}
                            value={String(item.quantity)}
                            onChange={(event) => updateCartQuantity(item.productId, event.target.value)}
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            className={`w-24 ${quantityInputClassName}`}
                            required
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-2xl"
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remover item do ticket</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-form-section space-y-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-primary" />
                Fechamento rapido
              </p>

              <div className="space-y-3 rounded-[1.35rem] border border-border/75 bg-background/32 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Receipt className="h-4 w-4 text-primary" />
                    Formas de pagamento
                  </p>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addPaymentLine}>
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>

                <div className="space-y-3">
                  {paymentLines.map((paymentLine) => (
                    <div key={paymentLine.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
                      <div className="space-y-2">
                        <Label htmlFor={`quick-payment-method-${paymentLine.id}`}>Metodo</Label>
                        <select
                          id={`quick-payment-method-${paymentLine.id}`}
                          name="paymentMethod"
                          className="admin-native-select"
                          value={paymentLine.method}
                          onChange={(event) => updatePaymentLine(paymentLine.id, "method", event.target.value)}
                          required
                        >
                          {Object.values(PaymentMethod).map((method) => (
                            <option key={method} value={method}>
                              {paymentLabels[method]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`quick-payment-amount-${paymentLine.id}`}>Valor (R$)</Label>
                        <Input
                          id={`quick-payment-amount-${paymentLine.id}`}
                          name="paymentAmount"
                          value={paymentLine.amount}
                          onChange={(event) => updatePaymentLine(paymentLine.id, "amount", event.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full border border-border/70"
                        onClick={() => removePaymentLine(paymentLine.id)}
                        disabled={paymentLines.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remover forma de pagamento</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {hasCashPayment ? (
                <div className="space-y-2">
                  <Label htmlFor="quick-cash-received">Valor recebido em dinheiro (R$)</Label>
                  <Input
                    id="quick-cash-received"
                    name="cashReceived"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Ajuda no calculo automatico do troco.</p>
                </div>
              ) : (
                <input type="hidden" name="cashReceived" value="" />
              )}

              <div className="space-y-3 rounded-[1.35rem] border border-border/75 bg-background/32 p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotalInCents / 100)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Desconto</span>
                  <span>{formatCurrency(discountInCents / 100)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Pagamentos</span>
                  <span>{formatCurrency(paymentsTotalInCents / 100)}</span>
                </div>
                {hasCashPayment ? (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Troco</span>
                    <span>{formatCurrency(changeInCents / 100)}</span>
                  </div>
                ) : null}
                <div className="border-t border-border/70 pt-3">
                  <div className="flex items-center justify-between text-base font-semibold text-foreground">
                    <span>Total</span>
                    <span>{formatCurrency(totalInCents / 100)}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {paymentDifferenceInCents === 0
                      ? "Pagamentos conferem com o total da venda."
                      : paymentDifferenceInCents > 0
                        ? `Falta ${formatCurrency(paymentDifferenceInCents / 100)} para fechar a venda.`
                        : `Pagamentos excedem em ${formatCurrency(Math.abs(paymentDifferenceInCents) / 100)}.`}
                  </p>
                </div>
              </div>

              <FormSubmitButton>
                {cartItems.length === 0 ? "Selecione itens para fechar" : "Finalizar e gerar ticket"}
              </FormSubmitButton>
              <ActionFeedback state={saleState} />
            </section>
          </div>
        </form>
      )}
    </div>
  );
}

