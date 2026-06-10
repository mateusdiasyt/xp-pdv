"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import {
  checkTenantSlugAvailability,
  updateTenantCustomSlug,
} from "@/application/platform/platform-service";
import {
  updateFiscalConfigurationRecord,
  updateFiscalEnvironmentRecord,
} from "@/application/fiscal/fiscal-configuration-service";
import { updateBrandCustomizationRecord } from "@/application/customization/brand-customization-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function updateBrandCustomizationAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  try {
    const session = await requirePermission(PERMISSIONS.CUSTOMIZATION_MANAGE);
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

export async function updateFiscalSettingsAction(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    const actorName = session.user.name ?? session.user.email ?? "Usuario do painel";
    const updated = await updateFiscalConfigurationRecord(formData, {
      id: session.user.id,
      name: actorName,
    });

    return {
      status: "success",
      message:
        updated.environment === "producao"
          ? "Configuracao fiscal salva em producao."
          : "Configuracao fiscal salva em homologacao.",
    };
  } catch (error) {
    return { status: "error", message: `${toActionErrorMessage(error)} Contate o Mateus.` };
  }
}

export async function checkTenantCustomLinkAction(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.CUSTOMIZATION_MANAGE);
    const requestedSlug = String(formData.get("slug") ?? "");
    const result = await checkTenantSlugAvailability(session.user.tenantSlug, requestedSlug);

    return {
      status: result.available ? "success" : "error",
      message: result.message,
      data: {
        slug: result.slug,
        available: result.available,
      },
    };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}

export async function updateTenantCustomLinkAction(formData: FormData): Promise<ActionState> {
  try {
    const session = await requirePermission(PERMISSIONS.CUSTOMIZATION_MANAGE);
    const requestedSlug = String(formData.get("slug") ?? "");
    const result = await updateTenantCustomSlug(session.user.tenantSlug, requestedSlug);

    revalidatePath("/admin");
    revalidatePath("/admin/customization");

    return {
      status: "success",
      message: result.changed ? "Link personalizado aplicado." : "Esse link ja esta aplicado.",
      data: {
        slug: result.slug,
        changed: result.changed,
      },
    };
  } catch (error) {
    return { status: "error", message: toActionErrorMessage(error) };
  }
}
