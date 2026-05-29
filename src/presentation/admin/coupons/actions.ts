"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { saveCouponRecord, updateCouponStatusRecord } from "@/application/coupons/coupon-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function saveCouponAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  return saveCouponRequest(formData);
}

export async function saveCouponRequest(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    await saveCouponRecord(formData, session.user.id);
    revalidatePath("/admin/coupons");
    revalidatePath("/admin/pdv");
    return { status: "success", message: "Cupom salvo." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function toggleCouponStatusAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
  await updateCouponStatusRecord(formData, session.user.id);
  revalidatePath("/admin/coupons");
  revalidatePath("/admin/pdv");
}
