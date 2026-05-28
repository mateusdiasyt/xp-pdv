"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, LayoutGrid, Plus, Receipt } from "lucide-react";
import { ProductKind } from "@prisma/client";
import type { CouponDiscountType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { initialActionState } from "@/presentation/admin/common/action-state";
import { CreateComandaDialog } from "@/presentation/admin/pdv/create-comanda-dialog";
import { CreateSaleForm } from "@/presentation/admin/pdv/create-sale-form";
import { OpenComandasBoard } from "@/presentation/admin/pdv/open-comandas-board";
import { QuickSaleForm } from "@/presentation/admin/pdv/quick-sale-form";
import { updatePdvHappyHourAction } from "@/presentation/admin/pdv/actions";

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
  happyHourPrice?: number | null;
  currentStock: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
};

type OpenComandaView = {
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

type CouponOption = {
  id: string;
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minSubtotalAmount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  productIds: string[];
  categoryIds: string[];
};

type PdvWorkspaceProps = {
  customers: CustomerOption[];
  openSessions: OpenSessionOption[];
  products: ProductOption[];
  coupons: CouponOption[];
  openComandas: OpenComandaView[];
  canManage: boolean;
  happyHourActive: boolean;
};

const DEFAULT_SLOT_COUNT = 50;

function HappyHourToggle({
  active,
  canManage,
  onStateChange,
}: {
  active: boolean;
  canManage: boolean;
  onStateChange: (active: boolean) => void;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(updatePdvHappyHourAction, initialActionState);

  useEffect(() => {
    if (state.status !== "success" || !state.data || typeof state.data !== "object") {
      return;
    }

    const nextActive = Boolean((state.data as { happyHourActive?: boolean }).happyHourActive);
    onStateChange(nextActive);
    router.refresh();
  }, [onStateChange, router, state]);

  if (!canManage) {
    return active ? (
      <div className="inline-flex h-10 items-center gap-2 rounded-full border border-orange-400/40 bg-orange-500/10 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-orange-100">
        <Flame className="h-4 w-4 text-orange-300" />
        Happy Hour ativo
      </div>
    ) : null;
  }

  return (
    <form action={action} className="flex flex-col items-start gap-2 sm:items-end">
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full border px-4 text-xs font-black uppercase tracking-[0.14em] transition-all disabled:cursor-wait disabled:opacity-70",
          active
            ? "border-orange-300/55 bg-[linear-gradient(135deg,#ff4d00,#ffb000_52%,#ff0066)] text-white shadow-[0_0_30px_-8px_rgba(255,92,0,0.8)]"
            : "border-border/80 bg-card/88 text-muted-foreground hover:border-orange-300/45 hover:text-orange-100",
        )}
      >
        {active ? <span className="happy-hour-fire" aria-hidden="true" /> : <Flame className="h-4 w-4" />}
        <span className="relative z-10">{active ? "Happy Hour ativo" : "Ativar Happy Hour"}</span>
        {active ? <span className="happy-hour-heat" aria-hidden="true" /> : null}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function PdvWorkspace({
  customers,
  openSessions,
  products,
  coupons,
  openComandas,
  canManage,
  happyHourActive,
}: PdvWorkspaceProps) {
  const [workspaceMode, setWorkspaceMode] = useState<"comanda" | "quick">("comanda");
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);
  const [manualSlotCount, setManualSlotCount] = useState(DEFAULT_SLOT_COUNT);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogPresetNumber, setCreateDialogPresetNumber] = useState<number | undefined>(undefined);
  const [lockCreateDialogNumber, setLockCreateDialogNumber] = useState(false);
  const [isHappyHourActive, setIsHappyHourActive] = useState(happyHourActive);

  useEffect(() => {
    setIsHappyHourActive(happyHourActive);
  }, [happyHourActive]);

  const selectedComanda = openComandas.find((comanda) => comanda.id === selectedComandaId) ?? null;
  const comandaProducts = products.filter((product) => product.kind === ProductKind.STANDARD);
  const highestActiveNumber = openComandas.reduce(
    (currentMax, comanda) => Math.max(currentMax, comanda.number),
    DEFAULT_SLOT_COUNT,
  );
  const visibleSlotCount = Math.max(manualSlotCount, highestActiveNumber, DEFAULT_SLOT_COUNT);

  function handleSelectComanda(comandaId: string) {
    setSelectedComandaId((currentValue) => (currentValue === comandaId ? null : comandaId));
  }

  function handleOpenManualCreateDialog() {
    setCreateDialogPresetNumber(undefined);
    setLockCreateDialogNumber(false);
    setIsCreateDialogOpen(true);
  }

  function handleOpenPresetCreateDialog(slotNumber: number) {
    setCreateDialogPresetNumber(slotNumber);
    setLockCreateDialogNumber(true);
    setIsCreateDialogOpen(true);
  }

  function handleAddSlot() {
    setManualSlotCount((currentValue) => Math.max(currentValue, visibleSlotCount) + 1);
  }

  if (workspaceMode === "quick") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="inline-flex items-center gap-2 rounded-[0.95rem] border border-border/75 bg-card/70 p-1">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-[0.7rem] border border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setWorkspaceMode("comanda")}
            >
              <LayoutGrid className="h-4 w-4" />
              Comandas
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-[0.7rem] border border-primary/50 bg-primary/15 px-3 text-sm font-medium text-foreground shadow-[0_8px_18px_-14px_color-mix(in_oklab,var(--primary)_80%,transparent)]"
              onClick={() => setWorkspaceMode("quick")}
            >
              <Receipt className="h-4 w-4" />
              Venda rapida
            </button>
          </div>
          <HappyHourToggle active={isHappyHourActive} canManage={canManage} onStateChange={setIsHappyHourActive} />
        </div>

        <Card className="border-border/80 bg-card/86">
          <CardContent className="pt-5">
            <QuickSaleForm
              canManage={canManage}
              customers={customers}
              openSessions={openSessions}
              products={products}
              coupons={coupons}
              happyHourActive={isHappyHourActive}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="inline-flex items-center gap-2 rounded-[0.95rem] border border-border/75 bg-card/70 p-1">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-[0.7rem] border border-primary/50 bg-primary/15 px-3 text-sm font-medium text-foreground shadow-[0_8px_18px_-14px_color-mix(in_oklab,var(--primary)_80%,transparent)]"
            onClick={() => setWorkspaceMode("comanda")}
          >
            <LayoutGrid className="h-4 w-4" />
            Comandas
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-[0.7rem] border border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setWorkspaceMode("quick")}
          >
            <Receipt className="h-4 w-4" />
            Venda rapida
          </button>
        </div>
        <HappyHourToggle active={isHappyHourActive} canManage={canManage} onStateChange={setIsHappyHourActive} />
      </div>

      <section
        className={cn(
          "grid items-start gap-5",
          selectedComanda
            ? "xl:grid-cols-[minmax(320px,360px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(340px,388px)_minmax(0,1fr)]"
            : "grid-cols-1",
        )}
      >
        <Card className="border-border/80 bg-card/86">
          <CardContent className="space-y-3.5 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3.5">
              <div>
                <CardTitle>Comandas abertas</CardTitle>
                <p className="text-sm text-muted-foreground">{openComandas.length} ativas em {visibleSlotCount} slots.</p>
              </div>
              {canManage ? (
                <Button type="button" size="sm" className="gap-2" onClick={handleOpenManualCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Nova comanda
                </Button>
              ) : null}
            </div>

            <OpenComandasBoard
              canManage={canManage}
              openComandas={openComandas}
              slotCount={visibleSlotCount}
              selectedComandaId={selectedComandaId}
              onAddSlot={handleAddSlot}
              onRequestCreateComanda={handleOpenPresetCreateDialog}
              onSelectComanda={handleSelectComanda}
            />
          </CardContent>
        </Card>

        {selectedComanda ? (
          <Card className="animate-in fade-in-0 slide-in-from-right-5 duration-300 xl:sticky xl:top-24">
            <CardContent className="pt-5">
              <CreateSaleForm
                key={`${selectedComanda.id}-${selectedComanda.customerId ?? "walkin"}-${selectedComanda.itemCount}-${selectedComanda.subtotalAmount}`}
                canManage={canManage}
                customers={customers}
                openSessions={openSessions}
                products={comandaProducts}
                coupons={coupons}
                happyHourActive={isHappyHourActive}
                selectedComanda={selectedComanda}
                onClose={() => setSelectedComandaId(null)}
              />
            </CardContent>
          </Card>
        ) : null}

        <CreateComandaDialog
          customers={customers}
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          presetNumber={createDialogPresetNumber}
          lockNumber={lockCreateDialogNumber}
        />
      </section>
    </div>
  );
}
