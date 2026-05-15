"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { createServiceFiscalDeclarationRecord } from "@/application/service-fiscal/service-fiscal-service";
import { PERMISSIONS } from "@/domain/auth/permissions";

export async function declareServiceNfseAction(formData: FormData): Promise<void> {
  const session = await requirePermission(PERMISSIONS.PDV_MANAGE);

  await createServiceFiscalDeclarationRecord(formData, session.user.id);

  revalidatePath("/admin/service-fiscal");
  revalidatePath("/admin/fiscal");
  revalidatePath("/admin/reports");
}
