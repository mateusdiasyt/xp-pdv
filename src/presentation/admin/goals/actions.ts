"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { upsertDailyGoalRecord, upsertMonthlyGoalPlanRecord } from "@/application/goals/goal-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function upsertDailyGoalAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.GOALS_MANAGE);
    await upsertDailyGoalRecord(formData, session.user.id);
    revalidatePath("/admin");
    return { status: "success", message: "Meta diaria salva com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function upsertMonthlyGoalPlanAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.GOALS_MANAGE);
    await upsertMonthlyGoalPlanRecord(formData, session.user.id);
    revalidatePath("/admin");
    return { status: "success", message: "Planejamento mensal salvo com sucesso." };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
