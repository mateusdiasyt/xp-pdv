"use client";

import Image from "next/image";

import { CouponDiscountType, PaymentMethod } from "@prisma/client";
import {
  Beef,
  Candy,
  Check,
  Loader2,
  Package2,
  Plus,
  Pizza,
  Receipt,
  Search,
  Sandwich,
  TicketPercent,
  Trash2,
  UserRound,
  Wallet,
  X,
  Coffee,
  GlassWater,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import {
  addComandaItemRequest,
  cancelComandaRequest,
  closeComandaRequest,
  removeComandaItemRequest,
  updateComandaCustomerRequest,
  updateComandaItemRequest,
} from "@/presentation/admin/pdv/actions";
import {
  calculateCouponDiscountInCents,
  normalizeCouponCode,
  type PdvCouponOption,
} from "@/presentation/admin/pdv/coupon-utils";
import { PaymentCardBrandPicker } from "@/presentation/admin/pdv/payment-card-brand-picker";

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
  happyHourPrice?: number | null;
  tracksStock: boolean;
  currentStock: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
};

type SelectedComanda = {
  id: string;
  number: number;
  isWalkIn: boolean;
  customerId: string | null;
  customerName: string;
  subtotalAmount: number;
  itemCount: number;
  openedAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    lineTotal: number;
    product: {
      name: string;
      sku: string;
      imageUrl?: string | null;
      tracksStock: boolean;
      currentStock: number;
      category: {
        id: string;
        name: string;
        slug: string;
      };
    };
  }>;
};

type CreateSaleFormProps = {
  customers: CustomerOption[];
  openSessions: OpenSessionOption[];
  products: ProductOption[];
  coupons: PdvCouponOption[];
  selectedComanda: SelectedComanda;
  canManage: boolean;
  happyHourActive: boolean;
  onClose: () => void;
  onComandaCancelled?: (comandaId: string) => void;
  onComandaCustomerLabelChange?: (
    comandaId: string,
    customerName: string,
    customerId: string | null,
    isWalkIn: boolean,
  ) => void;
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

type CategoryFilterOption = {
  id: string;
  name: string;
  slug: string;
};

type ComandaPanel = "items" | "checkout" | "danger";

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Cartao de credito",
  DEBIT_CARD: "Cartao de debito",
};

function formatCouponValue(coupon: PdvCouponOption) {
  if (coupon.discountType === CouponDiscountType.PERCENTAGE) {
    return `${Number(coupon.discountValue.toFixed(2))}%`;
  }

  return formatCurrency(coupon.discountValue);
}

function isCardPayment(method: PaymentMethod) {
  return method === PaymentMethod.CREDIT_CARD || method === PaymentMethod.DEBIT_CARD;
}

function isTraceablePayment(method: PaymentMethod) {
  return method === PaymentMethod.PIX || isCardPayment(method);
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

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

function formatMoneyInput(valueInCents: number) {
  return (valueInCents / 100).toFixed(2);
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

function hasHappyHourPrice(product: ProductOption) {
  return Boolean(product.happyHourPrice && product.happyHourPrice > 0);
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

function ComandaConfirmModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center px-4 py-6">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-xs" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="comanda-close-confirm-title"
        className="relative z-10 grid max-h-[calc(100vh-3rem)] w-full max-w-[min(460px,calc(100vw-2rem))] overflow-hidden rounded-[1.5rem] border border-primary/20 bg-card text-sm ring-1 ring-primary/15"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <h2 id="comanda-close-confirm-title" className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>
        <div className="admin-scrollbar overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function comandaReceiptUrl(data: unknown) {
  const sale = data as { saleId?: unknown; cashReceived?: unknown } | null;
  const saleId = typeof sale?.saleId === "string" ? sale.saleId : "";

  if (!saleId) {
    return null;
  }

  const params = new URLSearchParams({ receipt: saleId });

  if (typeof sale?.cashReceived === "string" && sale.cashReceived) {
    params.set("cashReceived", sale.cashReceived);
  }

  return `/admin/pdv?${params.toString()}`;
}

export function CreateSaleForm({
  customers,
  openSessions,
  products,
  coupons,
  selectedComanda,
  canManage,
  happyHourActive,
  onClose,
  onComandaCancelled,
  onComandaCustomerLabelChange,
}: CreateSaleFormProps) {
  const selectedCustomerInputValue = selectedComanda.customerId ? (selectedComanda.customerName ?? "") : "";
  const currentCustomerLabel =
    selectedComanda.customerName || (selectedComanda.isWalkIn ? "Comanda avulsa" : "Sem cliente");
  const [addState, setAddState] = useState(initialActionState);
  const [updateItemState, setUpdateItemState] = useState(initialActionState);
  const [removeItemState, setRemoveItemState] = useState(initialActionState);
  const [customerState, setCustomerState] = useState(initialActionState);
  const [cancelState, setCancelState] = useState(initialActionState);
  const [saleState, setSaleState] = useState<ActionState>(initialActionState);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isMutatingItem, startItemMutationTransition] = useTransition();
  const [isUpdatingCustomer, startCustomerTransition] = useTransition();
  const [isCancellingComanda, startCancelTransition] = useTransition();
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [activePanel, setActivePanel] = useState<ComandaPanel>("items");
  const deferredProductSearch = useDeferredValue(productSearch);
  const [discountAmount, setDiscountAmount] = useState("0.00");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [couponPanelOpen, setCouponPanelOpen] = useState(false);
  const [paymentAutofillEnabled, setPaymentAutofillEnabled] = useState(true);
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false);
  const [isClosingSale, setIsClosingSale] = useState(false);
  const [paymentLineSeed, setPaymentLineSeed] = useState(1);
  const [optimisticItems, setOptimisticItems] = useState(selectedComanda.items);
  const [quantityByItem, setQuantityByItem] = useState<Record<string, string>>(
    Object.fromEntries(selectedComanda.items.map((item) => [item.productId, String(item.quantity)])),
  );
  const [customerQuery, setCustomerQuery] = useState(selectedCustomerInputValue);
  const [walkInName, setWalkInName] = useState(selectedComanda.customerId ? "" : selectedComanda.customerName);
  const [optimisticCustomerLabel, setOptimisticCustomerLabel] = useState(currentCustomerLabel);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    {
      id: 1,
      method: PaymentMethod.PIX,
      amount: formatMoneyInput(Math.round(selectedComanda.subtotalAmount * 100)),
    },
  ]);

  const optimisticSubtotalAmount = optimisticItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const subtotalInCents = Math.round(optimisticSubtotalAmount * 100);
  const manualDiscountInCents = Math.max(0, parseMoneyToCents(discountAmount));
  const appliedCoupon = appliedCouponCode
    ? coupons.find((coupon) => coupon.code === appliedCouponCode)
    : null;
  const couponPreview = appliedCoupon
    ? calculateCouponDiscountInCents({
        coupon: appliedCoupon,
        subtotalInCents,
        lines: optimisticItems.map((item) => ({
          productId: item.productId,
          categoryId: item.product.category.id,
          lineTotalInCents: Math.round(item.lineTotal * 100),
        })),
      })
    : null;
  const couponDiscountInCents = couponPreview?.discountInCents ?? 0;
  const discountInCents = manualDiscountInCents + couponDiscountInCents;
  const discountExceedsSubtotal = discountInCents > subtotalInCents;
  const totalInCents = Math.max(subtotalInCents - discountInCents, 0);
  const paymentsTotalInCents = paymentLines.reduce(
    (acc, paymentLine) => acc + Math.max(0, parseMoneyToCents(paymentLine.amount)),
    0,
  );
  const hasOpenSessions = openSessions.length > 0;
  const cashPaymentTotalInCents = paymentLines.reduce(
    (acc, paymentLine) =>
      paymentLine.method === PaymentMethod.CASH
        ? acc + Math.max(0, parseMoneyToCents(paymentLine.amount))
        : acc,
    0,
  );
  const nonCashPaymentTotalInCents = paymentsTotalInCents - cashPaymentTotalInCents;
  const hasCashPayment = cashPaymentTotalInCents > 0;
  const nonCashExcessInCents = Math.max(nonCashPaymentTotalInCents - totalInCents, 0);
  const amountDueAfterNonCashInCents = Math.max(totalInCents - nonCashPaymentTotalInCents, 0);
  const changeInCents = Math.max(cashPaymentTotalInCents - amountDueAfterNonCashInCents, 0);
  const coveredTotalInCents =
    nonCashPaymentTotalInCents + Math.min(cashPaymentTotalInCents, amountDueAfterNonCashInCents);
  const paymentShortfallInCents = Math.max(totalInCents - coveredTotalInCents, 0);
  const normalizedCustomerQuery = customerQuery.trim().toLowerCase();
  const normalizedCustomerQueryDigits = normalizeDigits(customerQuery);
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
  const firstCategoryId = categoryFilters[0]?.id ?? "";
  const selectedCategoryIsAvailable = categoryFilters.some((category) => category.id === selectedCategoryId);
  const selectedCategoryName =
    categoryFilters.find((category) => category.id === selectedCategoryId)?.name ?? "Categoria";

  useEffect(() => {
    if (!firstCategoryId) {
      return;
    }

    if (!selectedCategoryId || !selectedCategoryIsAvailable) {
      const timeoutId = window.setTimeout(() => setSelectedCategoryId(firstCategoryId), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [firstCategoryId, selectedCategoryId, selectedCategoryIsAvailable]);

  useEffect(() => {
    if (saleState.status === "error") {
      const timeoutId = window.setTimeout(() => setIsFinalizeDialogOpen(false), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [saleState.status]);

  useEffect(() => {
    if (activePanel !== "checkout" || !paymentAutofillEnabled || paymentLines.length !== 1) {
      return;
    }

    const nextAmount = formatMoneyInput(totalInCents);
    if (paymentLines[0]?.amount === nextAmount) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPaymentLines((currentLines) =>
        currentLines.length === 1
          ? [
              {
                ...currentLines[0],
                amount: nextAmount,
              },
            ]
          : currentLines,
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activePanel, paymentAutofillEnabled, paymentLines, totalInCents]);

  const normalizedSearch = deferredProductSearch.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    if (!selectedCategoryId || product.category.id !== selectedCategoryId) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [product.name, product.category.name]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });
  const comandaItemMap = new Map(
    optimisticItems.map((item) => [
      item.productId,
      {
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      },
    ]),
  );
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
  const normalizedAppliedCouponCode = appliedCoupon && couponDiscountInCents > 0 ? appliedCoupon.code : "";
  const canSubmitComandaSale =
    optimisticItems.length > 0 &&
    !discountExceedsSubtotal &&
    nonCashExcessInCents === 0 &&
    paymentShortfallInCents === 0;

  function updatePaymentLine(id: number, field: PaymentLineField, value: string) {
    if (field === "amount") {
      setPaymentAutofillEnabled(false);
    }

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
    setPaymentAutofillEnabled(false);
    setPaymentLines((currentLines) => [
      ...currentLines,
      {
        id: nextSeed,
        method: PaymentMethod.CASH,
        amount: "0.00",
      },
    ]);
  }

  async function handleAddItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("_stableReload", "1");
    const quantity = Number(formData.get("quantity") ?? 0);

    if (!Number.isFinite(quantity) || quantity < 1) {
      setAddState({
        status: "error",
        message: "Informe uma quantidade valida.",
      });
      return;
    }

    setAddState(initialActionState);
    setIsAddingItem(true);

    try {
      const result = await addComandaItemRequest(formData);

      if (result.status === "success") {
        form.reset();
        setAddState(result);
        window.setTimeout(() => window.location.reload(), 80);
        return;
      }

      setAddState(result);
    } catch (error) {
      setAddState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel adicionar o item.",
      });
    } finally {
      setIsAddingItem(false);
    }
  }

  function handleUpdateItem(item: SelectedComanda["items"][number]) {
    const quantity = Number(quantityByItem[item.productId] ?? item.quantity);

    if (!Number.isFinite(quantity) || quantity < 1) {
      setUpdateItemState({
        status: "error",
        message: "Informe uma quantidade valida.",
      });
      return;
    }

    const previousItems = optimisticItems;
    const unitPrice = item.quantity > 0 ? item.lineTotal / item.quantity : item.lineTotal;
    const formData = new FormData();
    formData.set("comandaId", selectedComanda.id);
    formData.set("productId", item.productId);
    formData.set("quantity", String(quantity));
    formData.set("_stableReload", "1");

    setUpdateItemState(initialActionState);
    setOptimisticItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.productId === item.productId
          ? {
              ...currentItem,
              quantity,
              lineTotal: unitPrice * quantity,
            }
          : currentItem,
      ),
    );

    startItemMutationTransition(async () => {
      const result = await updateComandaItemRequest(formData);

      if (result.status === "error") {
        setOptimisticItems(previousItems);
        setUpdateItemState(result);
        return;
      }

      setUpdateItemState(result);
      window.setTimeout(() => window.location.reload(), 80);
    });
  }

  function handleRemoveItem(item: SelectedComanda["items"][number]) {
    const formData = new FormData();
    formData.set("comandaId", selectedComanda.id);
    formData.set("productId", item.productId);
    formData.set("_stableReload", "1");
    const previousItems = optimisticItems;

    setRemoveItemState(initialActionState);
    setOptimisticItems((currentItems) => currentItems.filter((currentItem) => currentItem.productId !== item.productId));

    startItemMutationTransition(async () => {
      const result = await removeComandaItemRequest(formData);

      if (result.status === "error") {
        setOptimisticItems(previousItems);
        setRemoveItemState(result);
        return;
      }

      setRemoveItemState(result);
      window.setTimeout(() => window.location.reload(), 80);
    });
  }

  function removePaymentLine(id: number) {
    setPaymentAutofillEnabled(false);
    setPaymentLines((currentLines) => {
      if (currentLines.length === 1) {
        return currentLines;
      }

      return currentLines.filter((line) => line.id !== id);
    });
  }

  function selectCoupon(code: string) {
    setAppliedCouponCode(normalizeCouponCode(code));
  }

  function syncSinglePaymentWithTotal() {
    setPaymentAutofillEnabled(true);
    setPaymentLines((currentLines) => {
      if (currentLines.length !== 1) {
        return currentLines;
      }

      return [
        {
          ...currentLines[0],
          amount: formatMoneyInput(totalInCents),
        },
      ];
    });
  }

  async function handleCloseComandaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isClosingSale) {
      return;
    }

    setIsClosingSale(true);
    setSaleState(initialActionState);

    try {
      const result = await closeComandaRequest(new FormData(event.currentTarget));
      setSaleState(result);

      if (result.status !== "success") {
        return;
      }

      const nextUrl = comandaReceiptUrl(result.data);
      if (!nextUrl) {
        setSaleState({
          status: "error",
          message: "Comanda fechada, mas nao foi possivel abrir o recibo automaticamente.",
        });
        return;
      }

      setIsFinalizeDialogOpen(false);
      window.location.assign(nextUrl);
    } catch (error) {
      setSaleState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel fechar a comanda.",
      });
    } finally {
      setIsClosingSale(false);
    }
  }

  function updateComandaCustomerLocal(customerId: string | null, label: string) {
    const nextWalkInName = customerId ? "" : label.trim();
    const nextLabel = customerId ? label : (nextWalkInName || "Comanda avulsa");

    setCustomerQuery(customerId ? label : "");
    setOptimisticCustomerLabel(nextLabel);
    setWalkInName(customerId ? "" : nextWalkInName);
    setIsCustomerSearchOpen(false);
    setCustomerState(initialActionState);
    onComandaCustomerLabelChange?.(selectedComanda.id, nextLabel, customerId, !customerId);

    const formData = new FormData();
    formData.set("comandaId", selectedComanda.id);
    formData.set("customerId", customerId ?? "");
    formData.set("customerName", customerId ? "" : nextWalkInName);

    startCustomerTransition(async () => {
      const result = await updateComandaCustomerRequest(formData);
      setCustomerState(result);
    });
  }

  function submitCustomerSelection(customerId: string | null, label: string) {
    updateComandaCustomerLocal(customerId, label === "Comanda avulsa" ? "" : label);
  }

  function submitWalkInName() {
    updateComandaCustomerLocal(null, walkInName);
  }

  function handleCancelComandaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setCancelState(initialActionState);

    startCancelTransition(async () => {
      const result = await cancelComandaRequest(formData);
      setCancelState(result);

      if (result.status !== "success") {
        return;
      }

      onComandaCancelled?.(selectedComanda.id);
      onClose();
    });
  }

  function resetCustomerSearch() {
    setCustomerQuery(selectedCustomerInputValue);
    setIsCustomerSearchOpen(false);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-[1.4rem] border border-border/75 bg-background/38 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex h-12 min-w-12 items-center justify-center rounded-2xl border border-primary/28 bg-primary/10 px-3 font-mono text-lg font-semibold tracking-[-0.04em] text-foreground">
            #{selectedComanda.number}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{optimisticCustomerLabel}</p>
            <p className="text-xs text-muted-foreground">
              {optimisticItems.length} item(ns) - aberta em {dateFormatter.format(new Date(selectedComanda.openedAt))}
            </p>
          </div>
        </div>

        <div className="flex w-full items-start justify-end gap-2 sm:w-auto">
          {canManage ? (
            <div className="relative w-full max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={customerQuery}
                  onChange={(event) => {
                    setCustomerQuery(event.target.value);
                    setIsCustomerSearchOpen(true);
                  }}
                  onFocus={() => setIsCustomerSearchOpen(true)}
                  onBlur={() => {
                    window.setTimeout(resetCustomerSearch, 120);
                  }}
                  placeholder={
                    !selectedComanda.customerId && !isCustomerSearchOpen
                      ? "Comanda avulsa"
                      : "Buscar cliente ou CPF"
                  }
                  className="h-10 rounded-full border-border/70 bg-background/68 pl-9 pr-10 text-sm"
                  disabled={isUpdatingCustomer}
                  autoComplete="off"
                />
                {isUpdatingCustomer ? (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </div>
              {!selectedComanda.customerId ? (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={walkInName}
                    onChange={(event) => setWalkInName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitWalkInName();
                      }
                    }}
                    placeholder="Nome da comanda"
                    className="h-9 rounded-full border-border/70 bg-background/68 text-sm"
                    maxLength={120}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 rounded-full"
                    onClick={submitWalkInName}
                    disabled={isUpdatingCustomer}
                  >
                    Renomear
                  </Button>
                </div>
              ) : null}

              {isCustomerSearchOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.55rem)] z-20 w-full overflow-hidden rounded-[1.25rem] border border-border/80 bg-popover/96 shadow-2xl shadow-black/30 backdrop-blur">
                  <div className="admin-scrollbar max-h-72 overflow-y-auto p-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-background/55"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => submitCustomerSelection(null, "Comanda avulsa")}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">Comanda avulsa</p>
                        <p className="text-xs text-muted-foreground">Sem cliente vinculado</p>
                      </div>
                      {!selectedComanda.customerId ? <Check className="h-4 w-4 text-primary" /> : null}
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
                          onClick={() => submitCustomerSelection(customer.id, customer.fullName)}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{customer.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {customer.documentType}: {customer.documentNumber}
                            </p>
                          </div>
                          {selectedComanda.customerId === customer.id ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-background/68 px-3 text-sm font-medium text-foreground">
              <UserRound className="h-4 w-4 text-primary" />
              <span>{currentCustomerLabel}</span>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full border border-border/70 bg-background/55"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar painel da comanda</span>
          </Button>
        </div>
      </header>

      <ActionFeedback state={customerState} />

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { id: "items" as const, label: "Itens", icon: Package2 },
          { id: "checkout" as const, label: "Fechamento", icon: Wallet },
          { id: "danger" as const, label: "Cancelar", icon: Trash2 },
        ]
          .filter((panel) => canManage || panel.id !== "danger")
          .map((panel) => {
            const Icon = panel.icon;
            const active = activePanel === panel.id;

            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => setActivePanel(panel.id)}
                className={`flex h-12 items-center justify-center gap-2 rounded-[1rem] border text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary/55 bg-primary/12 text-foreground"
                    : "border-border/70 bg-background/24 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {panel.label}
              </button>
            );
          })}
      </div>

      <div className={activePanel === "items" ? "grid gap-4 2xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,368px)]" : "grid gap-4"}>
        <div className={activePanel === "items" ? "space-y-4" : "hidden"}>
          <section className="admin-form-section space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Produtos</p>
                <p className="text-xs text-muted-foreground">Filtre por categoria e lance o item direto na comanda.</p>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Buscar produto"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="admin-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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

            {filteredProducts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/75 bg-background/32 px-4 py-6 text-sm text-muted-foreground">
                Nenhum produto encontrado com este filtro.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {selectedCategoryName}
                  </p>
                  <span className="text-xs text-muted-foreground">{filteredProducts.length} item(ns)</span>
                </div>

                <div className="admin-scrollbar max-h-[43rem] overflow-y-auto pr-1">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {filteredProducts.map((product) => {
                      const currentItem = comandaItemMap.get(product.id);

                      return (
                        <form
                          key={product.id}
                          onSubmit={handleAddItemSubmit}
                          className="group relative flex h-full flex-col gap-2.5 rounded-[1.3rem] border border-border/75 bg-background/30 p-3 transition-all duration-200 hover:border-primary/30 hover:bg-background/42"
                        >
                          <input type="hidden" name="comandaId" value={selectedComanda.id} />
                          <input type="hidden" name="productId" value={product.id} />

                          {currentItem ? (
                            <div className="absolute right-3 top-3 z-10 rounded-full border border-primary/30 bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary">
                              {currentItem.quantity} na comanda
                            </div>
                          ) : null}

                          <ProductCardMedia name={product.name} imageUrl={product.imageUrl} />

                          <div className="space-y-1">
                            <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">
                              {product.name}
                            </p>
                            <div className="space-y-0.5 text-xs text-muted-foreground">
                              <p className="font-medium text-foreground/88">
                                {happyHourActive && hasHappyHourPrice(product) ? (
                                  <>
                                    <span className="text-primary">{formatCurrency(product.happyHourPrice ?? product.salePrice)}</span>
                                    <span className="ml-1 text-[0.68rem] text-muted-foreground line-through">
                                      {formatCurrency(product.salePrice)}
                                    </span>
                                  </>
                                ) : (
                                  formatCurrency(product.salePrice)
                                )}
                              </p>
                              {happyHourActive && hasHappyHourPrice(product) ? (
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-orange-300">
                                  Happy Hour
                                </p>
                              ) : null}
                              <p>{product.tracksStock ? `${product.currentStock} em estoque` : "Sem controle de estoque"}</p>
                            </div>
                          </div>

                          <div className="mt-auto flex items-end gap-2">
                            <div className="min-w-0 flex-1 space-y-1">
                              <Label htmlFor={`add-quantity-${selectedComanda.id}-${product.id}`}>Qtd</Label>
                              <Input
                                id={`add-quantity-${selectedComanda.id}-${product.id}`}
                                name="quantity"
                                type="number"
                                min={1}
                                step={1}
                                defaultValue={1}
                                inputMode="numeric"
                                className={quantityInputClassName}
                                required
                              />
                            </div>
                            {canManage ? (
                              <Button type="submit" size="icon-sm" className="shrink-0 rounded-2xl" disabled={isAddingItem}>
                                {isAddingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                <span className="sr-only">Adicionar produto na comanda</span>
                              </Button>
                            ) : (
                              <Button type="button" variant="outline" size="icon-sm" className="shrink-0 rounded-2xl" disabled>
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </form>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <ActionFeedback state={addState} />
          </section>
        </div>

        <div className={activePanel === "items" || activePanel === "checkout" || activePanel === "danger" ? "space-y-4" : "hidden"}>
          <section className={activePanel === "items" ? "admin-form-section space-y-4" : "hidden"}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Itens da comanda</p>
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground">
                {optimisticItems.length}
              </span>
            </div>

            {optimisticItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/75 bg-background/32 px-4 py-6 text-sm text-muted-foreground">
                Adicione produtos para montar esta comanda.
              </p>
            ) : (
              <div className="space-y-2.5">
                {optimisticItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.35rem] border border-border/75 bg-background/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">{item.product.name}</p>
                      <p className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(item.lineTotal)}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      {canManage ? (
                        <>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="space-y-1">
                              <Label htmlFor={`item-quantity-${selectedComanda.id}-${item.productId}`}>Qtd</Label>
                              <Input
                                id={`item-quantity-${selectedComanda.id}-${item.productId}`}
                                type="number"
                                min={1}
                                step={1}
                                value={quantityByItem[item.productId] ?? String(item.quantity)}
                                onChange={(event) =>
                                  setQuantityByItem((currentMap) => ({
                                    ...currentMap,
                                    [item.productId]: event.target.value,
                                  }))
                                }
                                inputMode="numeric"
                                className={`w-24 ${quantityInputClassName}`}
                                required
                              />
                            </div>
                            <Button type="button" size="icon-sm" className="rounded-2xl" disabled={isMutatingItem} onClick={() => handleUpdateItem(item)}>
                              {isMutatingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              <span className="sr-only">Atualizar quantidade do item</span>
                            </Button>
                          </div>

                          <div>
                            <Button type="button" variant="outline" size="icon-sm" className="rounded-2xl" disabled={isMutatingItem} onClick={() => handleRemoveItem(item)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remover item da comanda</span>
                            </Button>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">{item.quantity} unidade(s)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <ActionFeedback state={updateItemState} />
              <ActionFeedback state={removeItemState} />
            </div>
          </section>

          <section className={activePanel === "checkout" ? "admin-form-section space-y-4" : "hidden"}>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              Fechamento
            </p>

            {!canManage ? (
              <p className="rounded-2xl border border-dashed border-border/75 bg-background/32 px-4 py-4 text-sm text-muted-foreground">
                Modo leitura.
              </p>
            ) : !hasOpenSessions ? (
              <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/8 px-4 py-4">
                <p className="text-sm text-amber-100">Abra o caixa acima para finalizar esta comanda.</p>
              </div>
            ) : (
              <form id={`close-comanda-form-${selectedComanda.id}`} onSubmit={handleCloseComandaSubmit} className="space-y-4">
                <input type="hidden" name="comandaId" value={selectedComanda.id} />
                <input type="hidden" name="couponCode" value={normalizedAppliedCouponCode} />
                <input type="hidden" name="cashReceived" value="" />

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                  <div className="space-y-2">
                    <Label htmlFor={`cashSessionId-${selectedComanda.id}`}>Caixa</Label>
                    <select
                      id={`cashSessionId-${selectedComanda.id}`}
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
                    <Label htmlFor={`discountAmount-${selectedComanda.id}`}>Desconto</Label>
                    <Input
                      id={`discountAmount-${selectedComanda.id}`}
                      name="discountAmount"
                      value={discountAmount}
                      onChange={(event) => setDiscountAmount(event.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <section className="rounded-[1.35rem] border border-border/75 bg-background/32 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <TicketPercent className="h-4 w-4 text-primary" />
                      Cupom
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCouponPanelOpen((current) => !current)}
                    >
                      {couponPanelOpen || appliedCouponCode ? "Ocultar" : "Aplicar cupom"}
                    </Button>
                  </div>

                  {couponPanelOpen || appliedCouponCode ? (
                    <div className="mt-3 space-y-2">
                      <select
                        id={`couponCode-${selectedComanda.id}`}
                        value={appliedCouponCode}
                        onChange={(event) => selectCoupon(event.target.value)}
                        className="admin-native-select"
                      >
                        <option value="">Selecionar cupom</option>
                        {coupons.map((coupon) => (
                          <option key={coupon.id} value={coupon.code}>
                            {coupon.name} - {formatCouponValue(coupon)}
                          </option>
                        ))}
                      </select>
                      {appliedCouponCode ? (
                        <div className="rounded-xl border border-primary/25 bg-primary/8 px-3 py-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-foreground">{appliedCoupon?.code}</span>
                            <span className="font-semibold text-primary">
                              {appliedCoupon ? formatCouponValue(appliedCoupon) : null}
                            </span>
                          </div>
                          <p className="mt-1">
                            {couponPreview?.message ?? `Desconto: ${formatCurrency(couponDiscountInCents / 100)}`}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>

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
                              <Label htmlFor={`payment-method-${paymentLine.id}`}>Metodo</Label>
                              <select
                                id={`payment-method-${paymentLine.id}`}
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
                              <Label htmlFor={`payment-amount-${paymentLine.id}`}>
                                {paymentLine.method === PaymentMethod.CASH ? "Valor recebido (R$)" : "Valor (R$)"}
                              </Label>
                              <Input
                                id={`payment-amount-${paymentLine.id}`}
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
                                Auditoria
                              </summary>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`payment-approved-${paymentLine.id}`}>Valor aprovado (R$)</Label>
                                  <Input
                                    id={`payment-approved-${paymentLine.id}`}
                                    name="paymentApprovedAmount"
                                    value={paymentLine.approvedAmount ?? ""}
                                    onChange={(event) =>
                                      updatePaymentLine(paymentLine.id, "approvedAmount", event.target.value)
                                    }
                                    placeholder={paymentLine.amount || "0.00"}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`payment-nsu-${paymentLine.id}`}>NSU / ID Pix</Label>
                                  <Input
                                    id={`payment-nsu-${paymentLine.id}`}
                                    name="paymentNsu"
                                    value={paymentLine.nsu ?? ""}
                                    onChange={(event) => updatePaymentLine(paymentLine.id, "nsu", event.target.value)}
                                    placeholder="Ex.: 123456"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`payment-auth-${paymentLine.id}`}>Autorizacao</Label>
                                  <Input
                                    id={`payment-auth-${paymentLine.id}`}
                                    name="paymentAuthorizationCode"
                                    value={paymentLine.authorizationCode ?? ""}
                                    onChange={(event) =>
                                      updatePaymentLine(paymentLine.id, "authorizationCode", event.target.value)
                                    }
                                    placeholder="Codigo da maquininha"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`payment-terminal-${paymentLine.id}`}>Maquininha</Label>
                                  <Input
                                    id={`payment-terminal-${paymentLine.id}`}
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
                                    <div className="space-y-2 md:col-span-2 xl:col-span-3">
                                      <Label id={`payment-brand-${paymentLine.id}`}>Bandeira</Label>
                                      <PaymentCardBrandPicker
                                        ariaLabelledBy={`payment-brand-${paymentLine.id}`}
                                        name="paymentCardBrand"
                                        value={paymentLine.cardBrand ?? ""}
                                        onChange={(event) =>
                                          updatePaymentLine(paymentLine.id, "cardBrand", event)
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`payment-last4-${paymentLine.id}`}>Final do cartao</Label>
                                      <Input
                                        id={`payment-last4-${paymentLine.id}`}
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
                                  <Label htmlFor={`payment-external-${paymentLine.id}`}>ID unico da transacao</Label>
                                  <Input
                                    id={`payment-external-${paymentLine.id}`}
                                    name="paymentExternalTransactionId"
                                    value={paymentLine.externalTransactionId ?? ""}
                                    onChange={(event) =>
                                      updatePaymentLine(paymentLine.id, "externalTransactionId", event.target.value)
                                    }
                                    placeholder="ID do TEF, Pix ou comprovante"
                                  />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <Label htmlFor={`payment-receipt-${paymentLine.id}`}>Comprovante / observacao</Label>
                                  <Textarea
                                    id={`payment-receipt-${paymentLine.id}`}
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
                <div className="grid gap-3 rounded-[1.35rem] border border-border/75 bg-background/32 p-4 text-sm md:grid-cols-4">
                  <div className="flex items-center justify-between gap-2 text-muted-foreground md:block">
                    <span>Subtotal</span>
                    <p className="font-semibold text-foreground">{formatCurrency(subtotalInCents / 100)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground md:block">
                    <span>Desconto</span>
                    <p className={discountExceedsSubtotal ? "font-semibold text-destructive" : "font-semibold text-foreground"}>
                      {formatCurrency(discountInCents / 100)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground md:block">
                    <span>{hasCashPayment ? "Recebido" : "Pagamentos"}</span>
                    <p className="font-semibold text-foreground">{formatCurrency(paymentsTotalInCents / 100)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3 md:block md:border-l md:border-t-0 md:pl-3 md:pt-0">
                    <span className="text-muted-foreground">Total</span>
                    <p className="text-lg font-semibold text-primary">{formatCurrency(totalInCents / 100)}</p>
                  </div>
                  {hasCashPayment && changeInCents > 0 ? (
                    <div className="rounded-xl border border-border/70 bg-background/35 px-3 py-2 text-muted-foreground md:col-span-4">
                      Troco: <span className="font-semibold text-foreground">{formatCurrency(changeInCents / 100)}</span>
                    </div>
                  ) : null}
                  {paymentShortfallInCents > 0 || discountExceedsSubtotal ? (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/8 px-3 py-2 text-amber-100 md:col-span-4">
                      {discountExceedsSubtotal
                        ? "Desconto maior que o subtotal."
                        : `Falta ${formatCurrency(paymentShortfallInCents / 100)}.`}
                    </div>
                  ) : null}
                  {nonCashExcessInCents > 0 ? (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/8 px-3 py-2 text-amber-100 md:col-span-4">
                      Pix/cartao acima do total em {formatCurrency(nonCashExcessInCents / 100)}.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" className="sm:w-auto" onClick={syncSinglePaymentWithTotal}>
                    Ajustar pagamento
                  </Button>
                  <Button
                    type="button"
                    disabled={!canSubmitComandaSale || isClosingSale}
                    className="flex-1 gap-2"
                    onClick={() => setIsFinalizeDialogOpen(true)}
                  >
                    <Check className="h-4 w-4" />
                    {nonCashExcessInCents > 0 || paymentShortfallInCents > 0 ? "Ajuste o pagamento" : "Fechar venda"}
                  </Button>

                  <ComandaConfirmModal
                    open={isFinalizeDialogOpen}
                    title={`Fechar comanda #${selectedComanda.number}?`}
                    onClose={() => {
                      if (!isClosingSale) {
                        setIsFinalizeDialogOpen(false);
                      }
                    }}
                  >
                    <div className="space-y-4">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12 text-primary">
                        <Receipt className="h-5 w-5" />
                      </div>

                      <div className="grid gap-2 rounded-[1.2rem] border border-border/75 bg-background/40 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3 text-muted-foreground">
                          <span>Itens</span>
                          <span className="font-semibold text-foreground">{optimisticItems.length}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-muted-foreground">
                          <span>Desconto</span>
                          <span className="font-semibold text-foreground">{formatCurrency(discountInCents / 100)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-muted-foreground">
                          <span>{hasCashPayment ? "Recebido" : "Pagamentos"}</span>
                          <span className="font-semibold text-foreground">{formatCurrency(paymentsTotalInCents / 100)}</span>
                        </div>
                        {hasCashPayment && changeInCents > 0 ? (
                          <div className="flex items-center justify-between gap-3 text-muted-foreground">
                            <span>Troco</span>
                            <span className="font-semibold text-foreground">{formatCurrency(changeInCents / 100)}</span>
                          </div>
                        ) : null}
                        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/70 pt-2">
                          <span className="font-semibold text-foreground">Total</span>
                          <span className="text-lg font-semibold text-primary">{formatCurrency(totalInCents / 100)}</span>
                        </div>
                      </div>

                      {saleState.status === "error" ? <ActionFeedback state={saleState} /> : null}

                      <div className="-mx-5 -mb-5 mt-1 flex flex-col-reverse gap-2 rounded-b-[1.5rem] border-t border-border/70 bg-background/45 p-4 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isClosingSale}
                          onClick={() => setIsFinalizeDialogOpen(false)}
                        >
                          Voltar
                        </Button>
                        <Button
                          type="submit"
                          form={`close-comanda-form-${selectedComanda.id}`}
                          className="gap-2"
                          disabled={isClosingSale}
                        >
                          <Check className="h-4 w-4" />
                          {isClosingSale ? "Fechando..." : "Confirmar"}
                        </Button>
                      </div>
                    </div>
                  </ComandaConfirmModal>
                </div>
                <ActionFeedback state={saleState} />
              </form>
            )}
          </section>

          {canManage && activePanel === "danger" ? (
            <section className="space-y-3 rounded-[1.35rem] border border-destructive/25 bg-destructive/6 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Trash2 className="h-4 w-4 text-destructive" />
                Cancelar comanda
              </p>
              <form onSubmit={handleCancelComandaSubmit} className="space-y-3">
                <input type="hidden" name="comandaId" value={selectedComanda.id} />
                <div className="space-y-2">
                  <Label htmlFor={`cancelReason-${selectedComanda.id}`}>Motivo</Label>
                  <Textarea
                    id={`cancelReason-${selectedComanda.id}`}
                    name="cancelReason"
                    rows={3}
                    placeholder="Descreva o motivo do cancelamento"
                    required
                  />
                </div>
                <Button type="submit" variant="destructive" className="gap-2" disabled={isCancellingComanda}>
                  {isCancellingComanda ? "Cancelando..." : "Cancelar comanda"}
                </Button>
              </form>
              <ActionFeedback state={cancelState} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
