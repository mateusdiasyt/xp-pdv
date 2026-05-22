"use server";

import { revalidatePath } from "next/cache";

import {
  closeCashSessionRecord,
  openCashSessionRecord,
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
    await openCashSessionRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
    return { status: "success", message: "Sessao de caixa aberta com sucesso." };
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
    await closeCashSessionRecord(formData, session.user.id);
    revalidatePath("/admin/pdv");
    return { status: "success", message: "Sessao de caixa fechada com sucesso." };
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
    await registerCashWithdrawalRecord(formData, session.user.id);
    return { status: "success", message: "Sangria registrada com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
