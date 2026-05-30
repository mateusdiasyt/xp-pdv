"use server";

import { requirePermission } from "@/application/auth/guards";
import { createOperatorRecord } from "@/application/users/user-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function createOperatorAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    const operator = await createOperatorRecord(formData, session.user.id);
    return { status: "success", message: "Operador cadastrado.", data: operator };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
