"use client";

import Image from "next/image";
import Link from "next/link";

import { PaymentMethod, ProductKind } from "@prisma/client";
import {
  Beef,
  Candy,
  Check,
  Coffee,
  Gamepad2,
  GlassWater,
  Grid2x2,
  Package2,
  Pizza,
  Plus,
  Receipt,
  Sandwich,
  Search,
  Trash2,
  Tv,
  Wallet,
} from "lucide-react";
import { useActionState, useDeferredValue, useEffect, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  kind: ProductKind;
  gameplayPlanCode?: string | null;
  gameplayDurationMinutes?: number | null;
  tracksStock: boolean;
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
  approvedAmount?: string;
  cardBrand?: string;
  cardLast4?: string;
  nsu?: string;
  authorizationCode?: string;
  terminalId?: string;
  externalTransactionId?: string;
  receiptText?: string;
};

type PaymentLineField = Exclude<keyof PaymentLine, "id">;

type CartLine = {
  productId: string;
  quantity: number;
};

type QuickSaleStep = "items" | "payment";

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

function isCardPayment(method: PaymentMethod) {
  return method === PaymentMethod.CREDIT_CARD || method === PaymentMethod.DEBIT_CARD;
}

function isTraceablePayment(method: PaymentMethod) {
  return method === PaymentMethod.PIX || isCardPayment(method);
}

const gameplayStations = [
  { id: "tv-01", label: "TV 01 - PS5" },
  { id: "tv-02", label: "TV 02 - Simulador" },
];

const defaultGameplayStationId = gameplayStations[0].id;

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

function inferGameplayStationId(product?: ProductOption | null) {
  const source = `${product?.name ?? ""} ${product?.gameplayPlanCode ?? ""}`.toLowerCase();

  if (
    source.includes("tv 02") ||
    source.includes("tv-02") ||
    source.includes("simulador") ||
    source.includes("simulator") ||
    source.includes("corrida") ||
    source.includes("racing")
  ) {
    return "tv-02";
  }

  if (
    source.includes("tv 01") ||
    source.includes("tv-01") ||
    source.includes("ps5") ||
    source.includes("playstation") ||
    source.includes("play station")
  ) {
    return "tv-01";
  }

  return defaultGameplayStationId;
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
  const [paymentLineSeed, setPaymentLineSeed] = useState(1);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    { id: 1, method: PaymentMethod.PIX, amount: "0.00" },
  ]);
  const [stationByProduct, setStationByProduct] = useState<Record<string, string>>({});
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [quickSaleStep, setQuickSaleStep] = useState<QuickSaleStep>("items");

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
  const gameplayCartItems = cartItems.filter((item) => item.product.kind === ProductKind.GAMEPLAY);

  const subtotalInCents = cartItems.reduce((sum, item) => sum + Math.round(item.lineTotal * 100), 0);
  const discountInCents = Math.max(0, parseMoneyToCents(discountAmount));
  const totalInCents = Math.max(subtotalInCents - discountInCents, 0);
  const paymentsTotalInCents = paymentLines.reduce(
    (acc, paymentLine) => acc + Math.max(0, parseMoneyToCents(paymentLine.amount)),
    0,
  );
  const paymentDifferenceInCents = totalInCents - paymentsTotalInCents;
  const hasCashPayment = paymentLines.some((paymentLine) => paymentLine.method === PaymentMethod.CASH);
  const paymentExcessInCents = Math.max(paymentsTotalInCents - totalInCents, 0);
  const changeInCents = hasCashPayment ? paymentExcessInCents : 0;
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
  const canProceedToPayment = cartItems.length > 0;

  useEffect(() => {
    if (cartItems.length === 0 && quickSaleStep === "payment") {
      setQuickSaleStep("items");
    }
  }, [cartItems.length, quickSaleStep]);

  function addToCart(productId: string, quantityRaw: string) {
    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return;
    }

    const product = productMap.get(productId);
    if (product?.kind === ProductKind.GAMEPLAY) {
      setStationByProduct((currentMap) => ({
        ...currentMap,
        [productId]: currentMap[productId] ?? inferGameplayStationId(product),
      }));
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
    setStationByProduct((currentMap) => {
      const nextMap = { ...currentMap };
      delete nextMap[productId];
      return nextMap;
    });
  }

  function updatePaymentLine(id: number, field: PaymentLineField, value: string) {
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

  function goToPaymentStep() {
    if (!canProceedToPayment) {
      return;
    }

    setPaymentLines((currentLines) => {
      const shouldAutofillSingleLine =
        currentLines.length === 1 && parseMoneyToCents(currentLines[0]?.amount ?? "0") === 0;

      if (!shouldAutofillSingleLine) {
        return currentLines;
      }

      return [
        {
          ...currentLines[0],
          amount: (totalInCents / 100).toFixed(2),
        },
      ];
    });
    setQuickSaleStep("payment");
  }

  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-[1.4rem] border border-border/75 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_42%),rgba(18,17,17,0.72)] px-4 py-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">Venda rapida com ticket</p>
            <p className="text-xs text-muted-foreground">
              Monte o pedido primeiro. A finalizacao abre em uma etapa limpa logo depois.
            </p>
          </div>
          {canManage && hasOpenSessions ? (
            <div className="inline-flex w-fit rounded-full border border-border/70 bg-background/60 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setQuickSaleStep("items")}
                className={`rounded-full px-3 py-1.5 transition-all ${
                  quickSaleStep === "items"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                1. Pedido
              </button>
              <button
                type="button"
                onClick={goToPaymentStep}
                disabled={!canProceedToPayment}
                className={`rounded-full px-3 py-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                  quickSaleStep === "payment"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                2. Pagamento
              </button>
            </div>
          ) : null}
        </div>
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
        <form action={saleFormAction} className="space-y-4">
          <input type="hidden" name="customerName" value={customerNameValue} />
          <fieldset className="hidden" aria-hidden="true">
            {cartItems.map((item) => (
              <div key={`quick-item-${item.productId}`}>
                <input type="hidden" name="itemProductId" value={item.productId} />
                <input type="hidden" name="itemQuantity" value={String(item.quantity)} />
              </div>
            ))}
            {gameplayCartItems.map((item) => (
              <div key={`quick-gameplay-${item.productId}`}>
                <input type="hidden" name="gameplayProductId" value={item.productId} />
                <input
                  type="hidden"
                  name="gameplayStationId"
                  value={stationByProduct[item.productId] ?? inferGameplayStationId(item.product)}
                />
              </div>
            ))}
          </fieldset>

          {quickSaleStep === "items" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
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
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Produtos</p>
                  <span className="text-xs text-muted-foreground">{filteredProducts.length} item(ns)</span>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar produto ou categoria"
                    className="pl-9"
                  />
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
                    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
                      {filteredProducts.map((product) => {
                        const draftQuantity = quantityByProduct[product.id] ?? "1";

                        return (
                          <div
                            key={product.id}
                            className="group relative flex h-full flex-col gap-2.5 rounded-[1.3rem] border border-border/75 bg-background/30 p-3 transition-all duration-200 hover:border-primary/30 hover:bg-background/42"
                          >
                            <ProductCardMedia name={product.name} imageUrl={product.imageUrl} />

                            <div className="space-y-1">
                              <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">
                                {product.name}
                              </p>
                              <div className="space-y-0.5 text-xs text-muted-foreground">
                                <p className="font-medium text-foreground/88">{formatCurrency(product.salePrice)}</p>
                                {product.kind === ProductKind.GAMEPLAY ? (
                                  <p className="inline-flex items-center gap-1 text-sky-200">
                                    <Gamepad2 className="h-3.5 w-3.5" />
                                    {product.gameplayDurationMinutes ?? 0} min
                                  </p>
                                ) : product.kind === ProductKind.SERVICE ? (
                                  <p className="inline-flex items-center gap-1 text-sky-200">
                                    <Receipt className="h-3.5 w-3.5" />
                                    Servico / NFS-e
                                  </p>
                                ) : !product.tracksStock ? (
                                  <p className="inline-flex items-center gap-1 text-primary">
                                    <GlassWater className="h-3.5 w-3.5" />
                                    Sem controle de estoque
                                  </p>
                                ) : (
                                  <p>{product.currentStock} em estoque</p>
                                )}
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

            <aside className="space-y-4">
              <section className="admin-form-section space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Resumo do pedido</p>
                  <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground">
                    {cartItems.length}
                  </span>
                </div>

                {cartItems.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border/75 bg-background/32 px-4 py-6 text-sm text-muted-foreground">
                    Selecione os produtos para montar o ticket.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {cartItems.map((item) => (
                      <div key={`quick-cart-${item.productId}`} className="rounded-[1.35rem] border border-border/75 bg-background/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{item.product.name}</p>
                            {item.product.kind === ProductKind.GAMEPLAY ? (
                              <p className="mt-1 inline-flex items-center gap-1 text-xs text-sky-200">
                                <Gamepad2 className="h-3.5 w-3.5" />
                                {item.product.gameplayPlanCode} - {item.product.gameplayDurationMinutes ?? 0} min
                              </p>
                            ) : item.product.kind === ProductKind.SERVICE ? (
                              <p className="mt-1 inline-flex items-center gap-1 text-xs text-sky-200">
                                <Receipt className="h-3.5 w-3.5" />
                                Servico para apuracao de NFS-e
                              </p>
                            ) : null}
                          </div>
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
                          {item.product.kind === ProductKind.GAMEPLAY ? (
                            <div className="min-w-[150px] flex-1 space-y-1">
                              <Label htmlFor={`quick-gameplay-station-${item.productId}`}>TV/estacao</Label>
                              <div className="relative">
                                <Tv className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-200" />
                                <select
                                  id={`quick-gameplay-station-${item.productId}`}
                                  className="admin-native-select pl-9"
                                  value={stationByProduct[item.productId] ?? inferGameplayStationId(item.product)}
                                  onChange={(event) =>
                                    setStationByProduct((currentMap) => ({
                                      ...currentMap,
                                      [item.productId]: event.target.value,
                                    }))
                                  }
                                  required
                                >
                                  {gameplayStations.map((station) => (
                                    <option key={station.id} value={station.id}>
                                      {station.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    <div className="rounded-[1.35rem] border border-primary/20 bg-primary/8 p-3">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotalInCents / 100)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                        <span>Desconto</span>
                        <span>{formatCurrency(discountInCents / 100)}</span>
                      </div>
                      <div className="mt-3 border-t border-primary/20 pt-3">
                        <div className="flex items-center justify-between text-base font-semibold text-foreground">
                          <span>Total</span>
                          <span>{formatCurrency(totalInCents / 100)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full rounded-2xl"
                      onClick={goToPaymentStep}
                      disabled={!canProceedToPayment}
                    >
                      Ir para pagamento
                    </Button>
                  </div>
                )}
              </section>
            </aside>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
              <section className="admin-form-section space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Conferencia do pedido</p>
                  <p className="text-xs text-muted-foreground">
                    Revise os itens, estacao de gameplay e total antes de finalizar o pagamento.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setQuickSaleStep("items")}>
                  Voltar para produtos
                </Button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-2.5">
                  {cartItems.map((item) => (
                    <div
                      key={`quick-checkout-item-${item.productId}`}
                      className="rounded-[1.25rem] border border-border/75 bg-background/30 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{item.product.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.product.salePrice)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-foreground">
                          {formatCurrency(item.lineTotal)}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={`quick-checkout-quantity-${item.productId}`}>Qtd</Label>
                          <Input
                            id={`quick-checkout-quantity-${item.productId}`}
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

                        {item.product.kind === ProductKind.GAMEPLAY ? (
                          <div className="min-w-[180px] flex-1 space-y-1">
                            <Label htmlFor={`quick-checkout-gameplay-station-${item.productId}`}>TV/estacao</Label>
                            <div className="relative">
                              <Tv className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-200" />
                              <select
                                id={`quick-checkout-gameplay-station-${item.productId}`}
                                className="admin-native-select pl-9"
                                value={stationByProduct[item.productId] ?? inferGameplayStationId(item.product)}
                                onChange={(event) =>
                                  setStationByProduct((currentMap) => ({
                                    ...currentMap,
                                    [item.productId]: event.target.value,
                                  }))
                                }
                                required
                              >
                                {gameplayStations.map((station) => (
                                  <option key={station.id} value={station.id}>
                                    {station.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.35rem] border border-primary/25 bg-primary/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Resumo</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Itens</span>
                      <span>{cartItems.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotalInCents / 100)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Desconto</span>
                      <span>{formatCurrency(discountInCents / 100)}</span>
                    </div>
                    <div className="border-t border-primary/20 pt-3">
                      <div className="flex items-center justify-between text-lg font-semibold text-foreground">
                        <span>Total</span>
                        <span>{formatCurrency(totalInCents / 100)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                {paymentLines.map((paymentLine) => {
                  const traceablePayment = isTraceablePayment(paymentLine.method);
                  const cardPayment = isCardPayment(paymentLine.method);

                  return (
                    <div key={paymentLine.id} className="rounded-[1.15rem] border border-border/70 bg-background/30 p-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
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
                          <Label htmlFor={`quick-payment-amount-${paymentLine.id}`}>
                            {paymentLine.method === PaymentMethod.CASH ? "Valor recebido (R$)" : "Valor (R$)"}
                          </Label>
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

                      {traceablePayment ? (
                        <details className="mt-3 rounded-[1rem] border border-border/60 bg-background/24 p-3">
                          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground">
                            Auditoria da transacao
                          </summary>
                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-2">
                              <Label htmlFor={`quick-payment-approved-${paymentLine.id}`}>Valor aprovado (R$)</Label>
                              <Input
                                id={`quick-payment-approved-${paymentLine.id}`}
                                name="paymentApprovedAmount"
                                value={paymentLine.approvedAmount ?? ""}
                                onChange={(event) =>
                                  updatePaymentLine(paymentLine.id, "approvedAmount", event.target.value)
                                }
                                placeholder={paymentLine.amount || "0.00"}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`quick-payment-nsu-${paymentLine.id}`}>NSU / ID Pix</Label>
                              <Input
                                id={`quick-payment-nsu-${paymentLine.id}`}
                                name="paymentNsu"
                                value={paymentLine.nsu ?? ""}
                                onChange={(event) => updatePaymentLine(paymentLine.id, "nsu", event.target.value)}
                                placeholder="Ex.: 123456"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`quick-payment-auth-${paymentLine.id}`}>Autorizacao</Label>
                              <Input
                                id={`quick-payment-auth-${paymentLine.id}`}
                                name="paymentAuthorizationCode"
                                value={paymentLine.authorizationCode ?? ""}
                                onChange={(event) =>
                                  updatePaymentLine(paymentLine.id, "authorizationCode", event.target.value)
                                }
                                placeholder="Codigo da maquininha"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`quick-payment-terminal-${paymentLine.id}`}>Maquininha</Label>
                              <Input
                                id={`quick-payment-terminal-${paymentLine.id}`}
                                name="paymentTerminalId"
                                value={paymentLine.terminalId ?? ""}
                                onChange={(event) =>
                                  updatePaymentLine(paymentLine.id, "terminalId", event.target.value)
                                }
                                placeholder="Ex.: SICOOB-01"
                              />
                            </div>
                            {cardPayment ? (
                              <>
                                <div className="space-y-2">
                                  <Label htmlFor={`quick-payment-brand-${paymentLine.id}`}>Bandeira</Label>
                                  <Input
                                    id={`quick-payment-brand-${paymentLine.id}`}
                                    name="paymentCardBrand"
                                    value={paymentLine.cardBrand ?? ""}
                                    onChange={(event) =>
                                      updatePaymentLine(paymentLine.id, "cardBrand", event.target.value)
                                    }
                                    placeholder="Visa, Master..."
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`quick-payment-last4-${paymentLine.id}`}>Final do cartao</Label>
                                  <Input
                                    id={`quick-payment-last4-${paymentLine.id}`}
                                    name="paymentCardLast4"
                                    value={paymentLine.cardLast4 ?? ""}
                                    onChange={(event) =>
                                      updatePaymentLine(paymentLine.id, "cardLast4", event.target.value)
                                    }
                                    placeholder="0000"
                                    inputMode="numeric"
                                    maxLength={4}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <input type="hidden" name="paymentCardBrand" value="" />
                                <input type="hidden" name="paymentCardLast4" value="" />
                              </>
                            )}
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor={`quick-payment-external-${paymentLine.id}`}>ID unico da transacao</Label>
                              <Input
                                id={`quick-payment-external-${paymentLine.id}`}
                                name="paymentExternalTransactionId"
                                value={paymentLine.externalTransactionId ?? ""}
                                onChange={(event) =>
                                  updatePaymentLine(paymentLine.id, "externalTransactionId", event.target.value)
                                }
                                placeholder="ID do TEF, Pix ou comprovante"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor={`quick-payment-receipt-${paymentLine.id}`}>Comprovante / observacao</Label>
                              <Textarea
                                id={`quick-payment-receipt-${paymentLine.id}`}
                                name="paymentReceiptText"
                                value={paymentLine.receiptText ?? ""}
                                onChange={(event) =>
                                  updatePaymentLine(paymentLine.id, "receiptText", event.target.value)
                                }
                                rows={2}
                                placeholder="Opcional: cole dados do comprovante"
                              />
                            </div>
                          </div>
                        </details>
                      ) : (
                        <>
                          <input type="hidden" name="paymentApprovedAmount" value="" />
                          <input type="hidden" name="paymentCardBrand" value="" />
                          <input type="hidden" name="paymentCardLast4" value="" />
                          <input type="hidden" name="paymentNsu" value="" />
                          <input type="hidden" name="paymentAuthorizationCode" value="" />
                          <input type="hidden" name="paymentTerminalId" value="" />
                          <input type="hidden" name="paymentExternalTransactionId" value="" />
                          <input type="hidden" name="paymentReceiptText" value="" />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <input type="hidden" name="cashReceived" value="" />

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
                      : hasCashPayment
                        ? `Troco previsto de ${formatCurrency(changeInCents / 100)}.`
                        : `Pagamentos excedem em ${formatCurrency(Math.abs(paymentDifferenceInCents) / 100)}. Troco so pode ser calculado em pagamento com dinheiro.`}
                </p>
              </div>
            </div>

            <FormSubmitButton>
              {cartItems.length === 0 ? "Selecione itens para fechar" : "Finalizar e gerar ticket"}
            </FormSubmitButton>
            <ActionFeedback state={saleState} />
              </section>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
