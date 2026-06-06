"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import {
  cancelManualGameplayStation,
  endManualGameplayStation,
  extendManualGameplayStation,
  getManualPaidOpenChargeByStationId,
  pauseManualGameplayStation,
  releaseManualGameplayStation,
  resumeManualGameplayStation,
  triggerGameplayReleaseForSale,
} from "@/application/gameplay/gameplay-release-service";
import { cancelSaleRecord, createSaleRecord } from "@/application/pdv/pdv-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

function getOperatorName(user: { name?: string | null; email?: string | null }) {
  return user.name?.trim() || user.email?.trim() || "Administrador Sistema";
}

function moneyFromCents(value: number) {
  return (value / 100).toFixed(2);
}

function copyPaymentAuditFields(source: FormData, target: FormData) {
  const fields = [
    "paymentApprovedAmount",
    "paymentCardBrand",
    "paymentCardLast4",
    "paymentNsu",
    "paymentAuthorizationCode",
    "paymentTerminalId",
    "paymentExternalTransactionId",
    "paymentReceiptText",
  ];

  for (const field of fields) {
    target.set(field, String(source.get(field) ?? ""));
  }
}

export async function retryGameplayReleaseAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const saleId = String(formData.get("saleId") ?? "");
    if (!saleId) {
      throw new Error("Venda obrigatoria para reenviar a liberacao.");
    }

    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await triggerGameplayReleaseForSale(saleId, session.user.id);

    revalidatePath("/admin/pdv");

    return {
      status: result.status === "LIBERADA" ? "success" : "error",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function manualServiceReleaseAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const durationPreset = String(formData.get("durationPreset") ?? "");
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await releaseManualGameplayStation({
      stationId,
      durationPreset,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
    });

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function extendServiceSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const durationPreset = String(formData.get("durationPreset") ?? "");
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await extendManualGameplayStation({
      stationId,
      durationPreset,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
    });

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function paidServiceReleaseAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const isExtension = formData.get("extendActiveSession") === "true";
    const durationPreset = String(formData.get("durationPreset") ?? "");

    if (!isExtension && durationPreset === "FREE") {
      const result = await releaseManualGameplayStation({
        stationId: String(formData.get("stationId") ?? ""),
        durationPreset,
        actorId: session.user.id,
        operator: getOperatorName(session.user),
        billingMode: "PAID_OPEN",
        billingProductId: String(formData.get("gameplayProductId") ?? formData.get("itemProductId") ?? ""),
      });

      revalidatePath("/admin/services");
      revalidatePath("/admin/pdv");

      return {
        status: "success",
        message: result.message,
      };
    }

    if (isExtension) {
      formData.set("skipGameplayRelease", "true");
    }

    const result = await createSaleRecord(formData, session.user.id);
    const extensionResult = isExtension
      ? await extendManualGameplayStation({
          stationId: String(formData.get("stationId") ?? ""),
          durationPreset: String(formData.get("durationPreset") ?? ""),
          actorId: session.user.id,
          operator: getOperatorName(session.user),
          saleId: result.saleId,
        })
      : null;

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: extensionResult?.message || result.gameplayMessage || "Venda registrada e serviço liberado.",
      data: {
        saleId: result.saleId,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function endPaidOpenServiceSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const chargeSnapshot = await getManualPaidOpenChargeByStationId(stationId);

    if (!chargeSnapshot) {
      throw new Error("Esta TV nao possui tempo livre pago ativo.");
    }

    const { charge } = chargeSnapshot;
    const saleFormData = new FormData();
    const paymentMethod = String(formData.get("paymentMethod") ?? "");
    const paymentAmount = String(formData.get("paymentAmount") ?? "") || moneyFromCents(charge.amountInCents);
    const cashReceived = String(formData.get("cashReceived") ?? "");

    saleFormData.set("cashSessionId", String(formData.get("cashSessionId") ?? ""));
    saleFormData.set("customerName", String(formData.get("customerName") ?? ""));
    saleFormData.set("couponCode", String(formData.get("couponCode") ?? ""));
    saleFormData.set("discountAmount", "0.00");
    saleFormData.set("cashReceived", paymentMethod === "CASH" ? cashReceived || paymentAmount : "");
    saleFormData.set("skipGameplayRelease", "true");
    saleFormData.append("itemProductId", charge.productId);
    saleFormData.append("itemQuantity", "1");
    saleFormData.append("itemUnitPrice", moneyFromCents(charge.amountInCents));
    saleFormData.append("gameplayProductId", charge.productId);
    saleFormData.append("gameplayStationId", stationId);
    saleFormData.append("paymentMethod", paymentMethod);
    saleFormData.append("paymentAmount", paymentAmount);
    copyPaymentAuditFields(formData, saleFormData);

    const saleResult = await createSaleRecord(saleFormData, session.user.id);
    const endResult = await endManualGameplayStation({
      stationId,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
      saleId: saleResult.saleId,
      amount: charge.amount,
      durationMinutes: charge.billedMinutes,
      billingPayload: {
        manualBillingMode: charge.mode,
        billingProductId: charge.productId,
        billingProductName: charge.productName,
        billingPlanCode: charge.productPlanCode,
        billingCategoryId: charge.categoryId,
        elapsedMinutes: charge.elapsedMinutes,
        billedMinutes: charge.billedMinutes,
        amountInCents: charge.amountInCents,
      },
    });

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: `${endResult.message} Total cobrado: R$ ${moneyFromCents(charge.amountInCents)}.`,
      data: {
        saleId: saleResult.saleId,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function pauseServiceSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await pauseManualGameplayStation({
      stationId,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
    });

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function resumeServiceSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await resumeManualGameplayStation({
      stationId,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
    });

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function cancelServiceSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const cancelReason = String(formData.get("cancelReason") ?? "").trim();
    const session = await requirePermission(PERMISSIONS.PDV_CANCEL);
    const result = await cancelManualGameplayStation({
      stationId,
      reason: cancelReason,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
    });

    let saleCancelMessage = "";
    if (result.saleId) {
      const saleCancelFormData = new FormData();
      saleCancelFormData.set("saleId", result.saleId);
      saleCancelFormData.set("cancelReason", cancelReason);
      saleCancelFormData.set("refundStatus", String(formData.get("refundStatus") ?? "PENDING"));
      saleCancelFormData.set("refundMethod", String(formData.get("refundMethod") ?? ""));
      saleCancelFormData.set("refundAmount", String(formData.get("refundAmount") ?? ""));
      saleCancelFormData.set("refundNsu", String(formData.get("refundNsu") ?? ""));
      saleCancelFormData.set("refundAuthorizationCode", String(formData.get("refundAuthorizationCode") ?? ""));
      saleCancelFormData.set("refundTerminalId", String(formData.get("refundTerminalId") ?? ""));
      saleCancelFormData.set("refundExternalTransactionId", String(formData.get("refundExternalTransactionId") ?? ""));
      saleCancelFormData.set("refundReceiptText", String(formData.get("refundReceiptText") ?? ""));

      const saleCancelResult = await cancelSaleRecord(saleCancelFormData, session.user.id);
      saleCancelMessage = saleCancelResult.message;
    }

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");
    revalidatePath("/admin/reports");

    return {
      status: "success",
      message: [result.message, saleCancelMessage].filter(Boolean).join(" "),
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function endServiceSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await endManualGameplayStation({
      stationId,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
    });

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}
