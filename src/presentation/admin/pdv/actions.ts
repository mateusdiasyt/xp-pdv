"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/application/auth/guards";
import {
  addComandaItemRecord,
  cancelComandaRecord,
  cancelSaleRecord,
  closeComandaRecord,
  createComandaRecord,
  createSaleRecord,
  removeComandaItemRecord,
  updatePdvHappyHourRecord,
  updateComandaCustomerRecord,
  updateComandaItemRecord,
} from "@/application/pdv/pdv-service";
import { issueSaleNfce } from "@/application/fiscal/focus-nfce-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

function revalidatePdvPage() {
  revalidatePath("/admin/pdv");
}

function revalidateSaleSurfaces() {
  revalidatePath("/admin/pdv");
  revalidatePath("/admin/stock");
  revalidatePath("/admin/products");
  revalidatePath("/admin");
}

export async function createSaleAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await createSaleRecord(formData, session.user.id);
    revalidateSaleSurfaces();
    return { status: "success", message: "Venda registrada com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
export async function closeQuickSaleAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  const result = await closeQuickSaleRequest(formData);

  if (result.status !== "success") {
    return result;
  }

  const saleResult = result.data as { saleId?: string; cashReceived?: string } | undefined;
  if (!saleResult?.saleId) {
    return { status: "error", message: toActionErrorMessage(new Error("Nao foi possivel concluir a venda rapida")) };
  }

  const params = new URLSearchParams({
    receipt: saleResult.saleId,
    ticket: "quick",
    print: "ticket",
  });

  if (saleResult.cashReceived) {
    params.set("cashReceived", saleResult.cashReceived);
  }

  redirect(`/admin/pdv?${params.toString()}`);
}

export async function closeQuickSaleRequest(formData: FormData): Promise<ActionState> {
  let result: Awaited<ReturnType<typeof createSaleRecord>> | null = null;
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    result = await createSaleRecord(formData, session.user.id);
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }

  if (!result) {
    return { status: "error", message: toActionErrorMessage(new Error("Nao foi possivel concluir a venda rapida")) };
  }

  revalidateSaleSurfaces();
  return {
    status: "success",
    message: "Venda registrada com sucesso.",
    data: {
      saleId: result.saleId,
      cashReceived: result.cashReceived,
      ticket: "quick",
      print: "ticket",
    },
  };
}
export async function cancelSaleAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  return cancelSaleRequest(formData);
}

export async function cancelSaleRequest(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.PDV_CANCEL);
    const result = await cancelSaleRecord(formData, session.user.id);
    revalidateSaleSurfaces();
    return { status: "success", message: result?.message ?? "Venda cancelada com sucesso." };
  } catch (error) {
    return { status: "error", message: `${toActionErrorMessage(error)} Contate o Mateus.` };
  }
}

export async function retrySaleNfceAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const saleId = String(formData.get("saleId") ?? "");
    if (!saleId) {
      throw new Error("Venda nao informada para reprocessar NFC-e.");
    }

    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await issueSaleNfce({
      saleId,
      actorId: session.user.id,
    });

    revalidateSaleSurfaces();
    return {
      status: result.status === "AUTHORIZED" ? "success" : "error",
      message: result.message,
    };
  } catch (error) {
    return { status: "error", message: `${toActionErrorMessage(error)} Contate o Mateus.` };
  }
}

export async function retrySaleNfceRequest(formData: FormData): Promise<void> {
  try {
    const saleId = String(formData.get("saleId") ?? "");
    if (!saleId) {
      return;
    }

    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await issueSaleNfce({
      saleId,
      actorId: session.user.id,
    });
    revalidateSaleSurfaces();
  } catch {
    // Mantem o fluxo da tela sem travar, a situacao fiscal fica registrada na venda.
  }
}

export async function updatePdvHappyHourAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const updated = await updatePdvHappyHourRecord(formData, {
      id: session.user.id,
      name: session.user.name,
    });
    revalidatePdvPage();
    return {
      status: "success",
      message: updated.happyHourActive ? "Happy Hour ativado." : "Happy Hour desativado.",
      data: {
        happyHourActive: updated.happyHourActive,
      },
    };
  } catch (error) {
    return { status: "error", message: `${toActionErrorMessage(error)} Contate o Mateus.` };
  }
}

export async function createComandaAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  return createComandaRequest(formData);
}

export async function createComandaRequest(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const created = await createComandaRecord(formData, session.user.id);
    revalidatePdvPage();
    return {
      status: "success",
      message: "Comanda criada com sucesso.",
      data: {
        id: created.id,
        number: created.number,
        isWalkIn: created.isWalkIn,
        customerId: created.customerId,
        customerName: created.customerNameSnapshot ?? (created.isWalkIn ? "Comanda avulsa" : "Sem cliente"),
        openedAt: created.openedAt.toISOString(),
      },
    };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function addComandaItemAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  return addComandaItemRequest(formData);
}

export async function addComandaItemRequest(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await addComandaItemRecord(formData, session.user.id);
    revalidatePdvPage();
    return { status: "success", message: "Item adicionado na comanda." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function closeComandaAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  const result = await closeComandaRequest(formData);

  if (result.status !== "success") {
    return result;
  }

  const saleResult = result.data as { saleId?: string; cashReceived?: string } | undefined;
  if (!saleResult?.saleId) {
    return { status: "error", message: toActionErrorMessage(new Error("Nao foi possivel concluir o fechamento da comanda")) };
  }

  const params = new URLSearchParams({
    receipt: saleResult.saleId,
  });

  if (saleResult.cashReceived) {
    params.set("cashReceived", saleResult.cashReceived);
  }

  redirect(`/admin/pdv?${params.toString()}`);
}

export async function closeComandaRequest(formData: FormData): Promise<ActionState> {
  let result: Awaited<ReturnType<typeof closeComandaRecord>> | null = null;
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    result = await closeComandaRecord(formData, session.user.id);
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }

  if (!result) {
    return { status: "error", message: toActionErrorMessage(new Error("Nao foi possivel concluir o fechamento da comanda")) };
  }

  revalidateSaleSurfaces();
  return {
    status: "success",
    message: "Comanda fechada com sucesso.",
    data: {
      saleId: result.saleId,
      cashReceived: result.cashReceived,
    },
  };
}

export async function removeComandaItemAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  return removeComandaItemRequest(formData);
}

export async function removeComandaItemRequest(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await removeComandaItemRecord(formData, session.user.id);
    revalidatePdvPage();
    return { status: "success", message: "Item removido da comanda." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function updateComandaItemAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  return updateComandaItemRequest(formData);
}

export async function updateComandaItemRequest(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await updateComandaItemRecord(formData, session.user.id);
    revalidatePdvPage();
    return { status: "success", message: "Item atualizado." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function updateComandaCustomerAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  return updateComandaCustomerRequest(formData);
}

export async function updateComandaCustomerRequest(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await updateComandaCustomerRecord(formData, session.user.id);
    revalidatePdvPage();
    return { status: "success", message: "Cliente da comanda atualizado." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function cancelComandaAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  return cancelComandaRequest(formData);
}

export async function cancelComandaRequest(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await cancelComandaRecord(formData, session.user.id);
    revalidatePdvPage();
    return { status: "success", message: "Comanda cancelada." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
