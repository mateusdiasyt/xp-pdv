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

export async function createSaleAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await createSaleRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
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
  let result: Awaited<ReturnType<typeof createSaleRecord>> | null = null;
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    result = await createSaleRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }

  if (!result) {
    return { status: "error", message: toActionErrorMessage(new Error("Nao foi possivel concluir a venda rapida")) };
  }

  const params = new URLSearchParams({
    receipt: result.saleId,
    ticket: "quick",
    print: "ticket",
  });

  if (result.cashReceived) {
    params.set("cashReceived", result.cashReceived);
  }

  redirect(`/admin/pdv?${params.toString()}`);
}
export async function cancelSaleAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.PDV_CANCEL);
    const result = await cancelSaleRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
    revalidatePath("/admin/cash");
    revalidatePath("/admin/stock");
    revalidatePath("/admin/products");
    revalidatePath("/admin");
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

    revalidatePath("/admin/pdv");
    revalidatePath("/admin");
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
    revalidatePath("/admin/pdv");
    revalidatePath("/admin");
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
    revalidatePath("/admin/pdv");

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
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await createComandaRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
    return { status: "success", message: "Comanda criada com sucesso." };
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
    revalidatePath("/admin/pdv");
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

  const params = new URLSearchParams({
    receipt: result.saleId,
  });

  if (result.cashReceived) {
    params.set("cashReceived", result.cashReceived);
  }

  redirect(`/admin/pdv?${params.toString()}`);
}

export async function removeComandaItemAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await removeComandaItemRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
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
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await updateComandaItemRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
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
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await updateComandaCustomerRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
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
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await cancelComandaRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
    revalidatePath("/admin");
    return { status: "success", message: "Comanda cancelada." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
