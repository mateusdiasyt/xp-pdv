"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { createSupplierRecord, updateSupplierStatusRecord } from "@/application/catalog/supplier-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function createSupplierAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE);
    await createSupplierRecord(formData, session.user.id);
    return { status: "success", message: "Fornecedor criado com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function toggleSupplierStatusAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE);
  await updateSupplierStatusRecord(formData, session.user.id);
  revalidatePath("/admin/suppliers");
}
