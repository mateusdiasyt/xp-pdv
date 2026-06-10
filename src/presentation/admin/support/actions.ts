"use server";

import { requirePermission } from "@/application/auth/guards";
import {
  createSupportTicketRecord,
  updateSupportTicketStatusRecord,
} from "@/application/support/support-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function createSupportTicketAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.SUPPORT_MANAGE);
    const actorName = session.user.name ?? session.user.email ?? "Usuario do painel";
    await createSupportTicketRecord(formData, {
      id: session.user.id,
      name: actorName,
    });
    return { status: "success", message: "Ticket registrado com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function updateSupportTicketStatusAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.SUPPORT_MANAGE);
    const actorName = session.user.name ?? session.user.email ?? "Usuario do painel";
    await updateSupportTicketStatusRecord(formData, {
      id: session.user.id,
      name: actorName,
    });
    return { status: "success", message: "Status do ticket atualizado." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
