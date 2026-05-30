"use server";

import { revalidatePath } from "next/cache";

import {
  closeCashSessionRecord,
  openCashSessionRecord,
  registerCashMovementRecord,
  registerCashWithdrawalRecord,
} from "@/application/cash/cash-service";
import { requirePermission } from "@/application/auth/guards";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function openCashSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.CASH_MANAGE);
    const opened = await openCashSessionRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
    return { status: "success", message: "Caixa aberto com sucesso.", data: opened };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function closeCashSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.CASH_MANAGE);
    const closed = await closeCashSessionRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
    return { status: "success", message: "Caixa fechado com sucesso.", data: closed };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function registerCashMovementAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.CASH_MANAGE);
    const updated = await registerCashMovementRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
    return { status: "success", message: "Movimentacao registrada.", data: updated };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function registerCashWithdrawalAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.CASH_MANAGE);
    const updated = await registerCashWithdrawalRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
    return { status: "success", message: "Sangria registrada com sucesso.", data: updated };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
