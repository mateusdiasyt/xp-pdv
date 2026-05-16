"use client";

import { useState } from "react";
import { LayoutGrid, Plus, Receipt } from "lucide-react";
import { ProductKind } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CreateComandaDialog } from "@/presentation/admin/pdv/create-comanda-dialog";
import { CreateSaleForm } from "@/presentation/admin/pdv/create-sale-form";
import { OpenComandasBoard } from "@/presentation/admin/pdv/open-comandas-board";
import { QuickSaleForm } from "@/presentation/admin/pdv/quick-sale-form";

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

type PdvWorkspaceProps = {
  customers: CustomerOption[];
  openSessions: OpenSessionOption[];
  products: ProductOption[];
  openComandas: OpenComandaView[];
  canManage: boolean;
};

const DEFAULT_SLOT_COUNT = 50;

export function PdvWorkspace({
  customers,
  openSessions,
  products,
  openComandas,
  canManage,
}: PdvWorkspaceProps) {
  const [workspaceMode, setWorkspaceMode] = useState<"comanda" | "quick">("comanda");
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);
  const [manualSlotCount, setManualSlotCount] = useState(DEFAULT_SLOT_COUNT);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogPresetNumber, setCreateDialogPresetNumber] = useState<number | undefined>(undefined);
  const [lockCreateDialogNumber, setLockCreateDialogNumber] = useState(false);

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

        <Card className="border-border/80 bg-card/86">
          <CardContent className="pt-5">
            <QuickSaleForm canManage={canManage} customers={customers} openSessions={openSessions} products={products} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
