import { NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";

import { getProductEditPayload } from "@/application/catalog/product-service";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { getServerAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function canViewProducts() {
  const session = await getServerAuthSession();

  if (!session?.user || session.user.status !== RecordStatus.ACTIVE) {
    return false;
  }

  return session.user.roleSlug === "administrador" || hasPermission(session.user.permissions, PERMISSIONS.PRODUCTS_VIEW);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  if (!(await canViewProducts())) {
    return NextResponse.json({ ok: false, message: "Acesso nao autorizado. Contate o Mateus." }, { status: 401 });
  }

  const { productId } = await context.params;
  const product = await getProductEditPayload(productId);

  if (!product) {
    return NextResponse.json({ ok: false, message: "Produto nao encontrado. Contate o Mateus." }, { status: 404 });
  }

  return NextResponse.json(
    {
      id: product.id,
      name: product.name,
      sku: product.sku,
      ncm: product.ncm,
      description: product.description,
      imageUrl: product.imageUrl,
      kind: product.kind,
      serviceCnae: product.serviceCnae,
      serviceDescription: product.serviceDescription,
      gameplayPlanCode: product.gameplayPlanCode,
      gameplayDurationMinutes: product.gameplayDurationMinutes,
      tracksStock: product.tracksStock,
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      costPrice: product.costPrice.toString(),
      salePrice: product.salePrice.toString(),
      happyHourPrice: product.happyHourPrice?.toString() ?? "",
      minStock: product.minStock,
      currentStock: product.currentStock,
      stockUnit: product.stockUnit,
      recipeIngredients: product.recipeIngredients,
      status: product.status,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
