"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import {
  createCustomerRecord,
  updateCustomerRecord,
  updateCustomerStatusRecord,
} from "@/application/customers/customer-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function createCustomerAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
    await createCustomerRecord(formData, session.user.id);
    return { status: "success", message: "Cliente cadastrado com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function toggleCustomerStatusAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
  await updateCustomerStatusRecord(formData, session.user.id);
  revalidatePath("/admin/customers");
}

export async function updateCustomerAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
    await updateCustomerRecord(formData, session.user.id);
    return { status: "success", message: "Cliente atualizado com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
