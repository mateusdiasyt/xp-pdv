"use server";

import { refresh, revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import {
  fetchAndStoreStockInvoiceXmlByAccessKey,
  importReviewedStockInvoiceXmlRecord,
  importStockInvoiceXmlById,
  registerStockMovementRecord,
  storeStockInvoiceXmlRecord,
} from "@/application/stock/stock-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

function buildStockXmlSummaryMessage(
  prefixes: { stored: string; imported: string },
  result: Awaited<ReturnType<typeof storeStockInvoiceXmlRecord>>,
) {
  if (!result.imported) {
    return `${prefixes.stored} Abra a conferencia na lista de XMLs guardados antes de dar entrada no estoque.`;
  }

  const summaryParts = [
    `${result.stockMovements} entrada(s)`,
    `${result.updatedProducts} produto(s) atualizado(s)`,
    `${result.createdProducts} produto(s) criado(s)`,
  ];

  if (result.skippedItems > 0) {
    summaryParts.push(`${result.skippedItems} item(ns) ignorado(s)`);
  }

  return `${prefixes.imported}: ${summaryParts.join(" | ")}.`;
}

export async function createStockMovementAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.STOCK_MANAGE);
    await registerStockMovementRecord(formData, session.user.id);
    revalidatePath("/admin/stock");
    revalidatePath("/admin/products");
    refresh();
    return { status: "success", message: "Movimentacao registrada com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function uploadStockInvoiceXmlAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.STOCK_MANAGE);
    const result = await storeStockInvoiceXmlRecord(formData, session.user.id);
    revalidatePath("/admin/stock");
    if (result.imported) {
      revalidatePath("/admin/products");
    }
    refresh();

    return {
      status: "success",
      message: buildStockXmlSummaryMessage(
        {
          stored: "XML salvo com sucesso.",
          imported: "XML salvo e importado com sucesso",
        },
        result,
      ),
    };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function fetchStockInvoiceXmlByAccessKeyAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.STOCK_MANAGE);
    const result = await fetchAndStoreStockInvoiceXmlByAccessKey(formData, session.user.id);
    revalidatePath("/admin/stock");
    if (result.imported) {
      revalidatePath("/admin/products");
    }
    refresh();

    return {
      status: "success",
      message: buildStockXmlSummaryMessage(
        {
          stored: "NF-e recebida baixada e guardada com sucesso.",
          imported: "NF-e recebida baixada e importada com sucesso",
        },
        result,
      ),
    };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function importStockInvoiceXmlItemsAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.STOCK_MANAGE);
    const stockInvoiceXmlId = String(formData.get("stockInvoiceXmlId") ?? "").trim();

    if (!stockInvoiceXmlId) {
      throw new Error("XML nao identificado para importacao.");
    }

    const result = await importStockInvoiceXmlById(stockInvoiceXmlId, session.user.id);
    revalidatePath("/admin/stock");
    revalidatePath("/admin/products");
    refresh();

    const summaryParts = [
      `${result.stockMovements} entrada(s)`,
      `${result.updatedProducts} produto(s) atualizado(s)`,
      `${result.createdProducts} produto(s) criado(s)`,
    ];

    if (result.skippedItems > 0) {
      summaryParts.push(`${result.skippedItems} item(ns) ignorado(s)`);
    }

    return {
      status: "success",
      message: `Importacao concluida: ${summaryParts.join(" | ")}.`,
    };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function importReviewedStockInvoiceXmlAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.STOCK_MANAGE);
    const result = await importReviewedStockInvoiceXmlRecord(formData, session.user.id);
    revalidatePath("/admin/stock");
    revalidatePath("/admin/products");
    refresh();

    const summaryParts = [
      `${result.stockMovements} entrada(s)`,
      `${result.updatedProducts} produto(s) atualizado(s)`,
      `${result.createdProducts} produto(s) criado(s)`,
    ];

    if (result.skippedItems > 0) {
      summaryParts.push(`${result.skippedItems} item(ns) ignorado(s)`);
    }

    return {
      status: "success",
      message: `Entrada XML confirmada: ${summaryParts.join(" | ")}.`,
    };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
