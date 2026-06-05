"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { createUserRecord, updateUserAccessRecord, updateUserStatusRecord } from "@/application/users/user-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function createUserAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    await createUserRecord(formData, session.user.id, session.user.tenantSlug);
    return { status: "success", message: "Usuario criado com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function updateUserStatusAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    await updateUserStatusRecord(formData, session.user.id);
    return { status: "success", message: "Status atualizado com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function toggleUserStatusAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  await updateUserStatusRecord(formData, session.user.id);
  revalidatePath("/admin/users");
}

export async function updateUserAccessAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    await updateUserAccessRecord(formData, session.user.id);
    return { status: "success", message: "Acesso atualizado com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
