import { NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";

import { getProductImagePayload } from "@/application/catalog/product-service";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { getServerAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseDataUrlImage(dataUrl: string) {
  const matches = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);

  if (!matches) {
    return null;
  }

  const [, mimeType, base64Payload] = matches;

  try {
    return {
      mimeType,
      bytes: Buffer.from(base64Payload, "base64"),
    };
  } catch {
    return null;
  }
}

async function canViewProducts() {
  const session = await getServerAuthSession();

  if (!session?.user || session.user.status !== RecordStatus.ACTIVE) {
    return false;
  }

  return session.user.roleSlug === "administrador" || hasPermission(session.user.permissions, PERMISSIONS.PRODUCTS_VIEW);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  if (!(await canViewProducts())) {
    return NextResponse.json({ ok: false, message: "Acesso nao autorizado. Contate o Mateus." }, { status: 401 });
  }

  const { productId } = await context.params;
  const product = await getProductImagePayload(productId);
  const imageUrl = product?.imageUrl?.trim();

  if (!product || !imageUrl) {
    return NextResponse.json({ ok: false, message: "Produto sem imagem." }, { status: 404 });
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return NextResponse.redirect(new URL(imageUrl, request.url), 307);
  }

  const parsedImage = parseDataUrlImage(imageUrl);

  if (!parsedImage) {
    return NextResponse.json({ ok: false, message: "Imagem invalida. Contate o Mateus." }, { status: 422 });
  }

  return new NextResponse(parsedImage.bytes, {
    headers: {
      "Content-Type": parsedImage.mimeType,
      "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
      "Last-Modified": product.updatedAt.toUTCString(),
    },
  });
}
