"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { updateBrandCustomizationRecord } from "@/application/customization/brand-customization-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function updateBrandCustomizationAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
    const actorName = session.user.name ?? session.user.email ?? "Usuario do painel";
    await updateBrandCustomizationRecord(formData, {
      id: session.user.id,
      name: actorName,
    });
    revalidatePath("/admin/customization");
    revalidatePath("/admin");
    revalidatePath("/admin/pdv");
    revalidatePath("/login");
    return { status: "success", message: "Personalizacao atualizada com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
