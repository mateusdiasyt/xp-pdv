"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { createCategoryRecord, updateCategoryStatusRecord } from "@/application/catalog/category-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function createCategoryAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.CATEGORIES_MANAGE);
    await createCategoryRecord(formData, session.user.id);
    return { status: "success", message: "Categoria criada com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function toggleCategoryStatusAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CATEGORIES_MANAGE);
  await updateCategoryStatusRecord(formData, session.user.id);
  revalidatePath("/admin/categories");
}
