"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { updateFiscalEnvironmentRecord } from "@/application/fiscal/fiscal-configuration-service";
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
    revalidatePath("/admin");
    revalidatePath("/admin/pdv");
    revalidatePath("/login");
    return { status: "success", message: "Personalizacao atualizada com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function updateFiscalEnvironmentAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    const actorName = session.user.name ?? session.user.email ?? "Usuario do painel";
    const updated = await updateFiscalEnvironmentRecord(formData, {
      id: session.user.id,
      name: actorName,
    });

    revalidatePath("/admin/pdv");
    revalidatePath("/admin");

    return {
      status: "success",
      message:
        updated.environment === "producao"
          ? "Ambiente fiscal alterado para producao."
          : "Ambiente fiscal alterado para homologacao.",
    };
  } catch (error) {
    return { status: "error", message: `${toActionErrorMessage(error)} Contate o Mateus.` };
  }
}
