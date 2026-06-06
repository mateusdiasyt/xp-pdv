import { NextRequest, NextResponse } from "next/server";
import { StockMovementType, StockUnit } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import {
  getStockInvoiceXmlHistory,
  getStockMovementFilterOptions,
  getStockMovements,
} from "@/application/stock/stock-service";
import { PERMISSIONS } from "@/domain/auth/permissions";

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function serializeCurrency(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function stockUnitLabel(stockUnit: StockUnit) {
  return stockUnit === StockUnit.MILLILITER ? "ml" : "un";
}

function normalizeMovementType(value: string | null) {
  if (
    value === StockMovementType.IN ||
    value === StockMovementType.OUT ||
    value === StockMovementType.ADJUSTMENT
  ) {
    return value;
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  await requirePermission(PERMISSIONS.STOCK_VIEW);

  const { searchParams } = request.nextUrl;
  const panel = searchParams.get("panel");

  if (panel === "log") {
    const [movements, categories] = await Promise.all([
      getStockMovements({
        query: searchParams.get("q")?.trim() || undefined,
        categoryId: searchParams.get("categoryId") || undefined,
        type: normalizeMovementType(searchParams.get("movementType")),
      }),
      getStockMovementFilterOptions(),
    ]);

    return NextResponse.json({
      categories,
      movements: movements.map((movement) => ({
        id: movement.id,
        createdAt: serializeDate(movement.createdAt),
        type: movement.type,
        typeLabel:
          movement.type === StockMovementType.IN
            ? "Entrada"
            : movement.type === StockMovementType.OUT
              ? "Saida"
              : "Ajuste",
        quantity: movement.quantity,
        previousStock: movement.previousStock,
        resultingStock: movement.resultingStock,
        unitLabel: stockUnitLabel(movement.product.stockUnit),
        note: movement.note ?? "",
        operatorName: movement.operator?.name ?? null,
        product: {
          name: movement.product.name,
          sku: movement.product.sku,
          categoryName: movement.product.category.name,
        },
      })),
    });
  }

  if (panel === "xml") {
    const history = await getStockInvoiceXmlHistory();

    return NextResponse.json({
      setupPending: history.setupPending,
      entries: history.entries.map((entry) => ({
        id: entry.id,
        accessKey: entry.accessKey,
        invoiceNumber: entry.invoiceNumber,
        invoiceSeries: entry.invoiceSeries,
        supplierName: entry.supplierName,
        issuedAt: serializeDate(entry.issuedAt),
        totalAmount: serializeCurrency(entry.totalAmount),
        itemCount: entry.itemCount,
        sourceFileName: entry.sourceFileName,
        createdAt: serializeDate(entry.createdAt),
        importedAt: serializeDate(entry.importedAt),
        previewError: entry.previewError,
        preview: entry.preview
          ? {
              shownItems: entry.preview.shownItems.map((item) => ({
                lineNumber: item.lineNumber,
                description: item.description,
                ncm: item.ncm,
                cfop: item.cfop,
                quantity: item.quantity,
                unitCost: item.unitCost,
                totalCost: item.totalCost,
              })),
              itemLines: entry.preview.itemLines,
            }
          : null,
      })),
    });
  }

  return NextResponse.json({ error: "Painel invalido." }, { status: 400 });
}
