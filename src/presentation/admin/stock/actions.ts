"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import {
  importStockInvoiceXmlById,
  registerStockMovementRecord,
  storeStockInvoiceXmlRecord,
} from "@/application/stock/stock-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

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

    if (!result.imported) {
      return {
        status: "success",
        message: "XML salvo com sucesso. Agora voce pode importar os itens pela lista de XMLs guardados.",
      };
    }

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
      message: `XML salvo e importado com sucesso: ${summaryParts.join(" | ")}.`,
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
