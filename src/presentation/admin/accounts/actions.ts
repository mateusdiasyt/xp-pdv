"use server";

import { requirePermission } from "@/application/auth/guards";
import {
  createAccountPayableRecord,
  updateAccountPayableStatusRecord,
  uploadAccountPayableReceiptRecord,
} from "@/application/accounts/account-payable-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function createAccountPayableAction(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.ACCOUNTS_MANAGE);
    await createAccountPayableRecord(formData, {
      id: session.user.id,
    });
    return { status: "success", message: "Conta adicionada." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function updateAccountPayableStatusAction(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.ACCOUNTS_MANAGE);
    await updateAccountPayableStatusRecord(formData, {
      id: session.user.id,
    });
    return { status: "success", message: "Status atualizado." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function uploadAccountPayableReceiptAction(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.ACCOUNTS_MANAGE);
    await uploadAccountPayableReceiptRecord(formData, {
      id: session.user.id,
    });
    return { status: "success", message: "Comprovante anexado." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
