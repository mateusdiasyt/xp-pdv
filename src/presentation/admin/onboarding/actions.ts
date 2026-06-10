"use server";

import { requireSession } from "@/application/auth/guards";
import { confirmTenantCompanyName } from "@/application/platform/platform-service";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function confirmCompanyNameAction(formData: FormData): Promise<ActionState> {
  try {
    const session = await requireSession();
    const companyName = String(formData.get("companyName") ?? "");

    await confirmTenantCompanyName(session.user.tenantSlug, companyName);

    return {
      status: "success",
      message: "Nome da empresa confirmado.",
    };
  } catch (error) {
    return {
      ...initialActionState,
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}
