"use client";

import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type OpenComandaView = {
  id: string;
  number: number;
  isWalkIn: boolean;
  customerName: string;
  subtotalAmount: number;
  itemCount: number;
  openedAt: string;
};

type OpenComandasBoardProps = {
  canManage: boolean;
  openComandas: OpenComandaView[];
  slotCount: number;
  selectedComandaId: string | null;
  onAddSlot: () => void;
  onRequestCreateComanda: (slotNumber: number) => void;
  onSelectComanda: (comandaId: string) => void;
};

export function OpenComandasBoard({
  canManage,
  openComandas,
  slotCount,
  selectedComandaId,
  onAddSlot,
  onRequestCreateComanda,
  onSelectComanda,
}: OpenComandasBoardProps) {
  const activeComandasByNumber = new Map(openComandas.map((comanda) => [comanda.number, comanda]));
  const slotNumbers = Array.from({ length: slotCount }, (_, index) => index + 1);
  const compactGrid = Boolean(selectedComandaId);

  return (
    <div>
      <div
        className={cn(
          "grid gap-2",
          compactGrid
            ? "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-5 2xl:grid-cols-6"
            : "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10",
        )}
      >
        {slotNumbers.map((slotNumber) => {
          const comanda = activeComandasByNumber.get(slotNumber);
          const isSelected = comanda?.id === selectedComandaId;

          if (!comanda) {
            return (
              <button
                key={`slot-${slotNumber}`}
                type="button"
                disabled={!canManage}
                onClick={() => onRequestCreateComanda(slotNumber)}
                className={cn(
                  "group flex h-[4.45rem] w-full flex-col rounded-[0.95rem] border border-dashed border-border/75 bg-background/24 p-2 text-left transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25",
                  canManage
                    ? "hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background/48"
                    : "cursor-not-allowed opacity-65",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="h-2 w-2 rounded-full bg-border/80" />
                  <span className="text-[9px] text-muted-foreground/40"> </span>
                </div>

                <div className="mt-auto">
                  <p className="font-mono text-[1.08rem] font-semibold leading-none tracking-[-0.06em] text-foreground/86 tabular-nums sm:text-[1.14rem]">
                    #{slotNumber}
                  </p>
                </div>
              </button>
            );
          }

          return (
            <button
              key={comanda.id}
              type="button"
              title={comanda.customerName}
              aria-label={`Comanda ${comanda.number}: ${comanda.customerName}`}
              aria-pressed={isSelected}
              onClick={() => onSelectComanda(comanda.id)}
              className={cn(
                "group relative flex h-[4.45rem] w-full flex-col rounded-[0.95rem] border p-2 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25",
                isSelected
                  ? "border-primary/70 bg-primary/12 shadow-[0_12px_24px_-24px_color-mix(in_oklab,var(--primary)_82%,transparent)]"
                  : "border-border/75 bg-card/74 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/92",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-[1.1rem] opacity-0 transition-opacity duration-200",
                  "bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_56%)]",
                  isSelected && "opacity-100",
                )}
              />

              <div className="relative flex h-full flex-col">
                <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-max max-w-48 -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] rounded-xl border border-border/75 bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-xl group-hover:block">
                  <span className="block truncate">{comanda.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      "bg-emerald-400",
                    )}
                  />
                  {comanda.itemCount > 0 ? (
                    <Badge className="rounded-full border border-border/70 bg-background/68 px-1.5 py-0.5 text-[9px] text-foreground/82 hover:bg-background/68">
                      {comanda.itemCount}
                    </Badge>
                  ) : (
                    <span className="text-[9px] text-muted-foreground/40"> </span>
                  )}
                </div>

                <div className="mt-auto">
                  <p className="font-mono text-[1.08rem] font-semibold leading-none tracking-[-0.06em] text-foreground tabular-nums sm:text-[1.14rem]">
                    #{comanda.number}
                  </p>
                </div>
              </div>
            </button>
          );
        })}

        {canManage ? (
          <button
            type="button"
            onClick={onAddSlot}
            className="group flex h-[4.45rem] w-full flex-col items-center justify-center rounded-[0.95rem] border border-dashed border-primary/35 bg-primary/6 p-2 text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/28 bg-primary/12 text-primary">
              <Plus className="h-4 w-4" />
            </span>
            <p className="mt-1.5 font-mono text-[0.9rem] font-semibold leading-none tracking-[-0.06em] text-muted-foreground tabular-nums">
              #{slotCount + 1}
            </p>
          </button>
        ) : null}
      </div>
    </div>
  );
}
