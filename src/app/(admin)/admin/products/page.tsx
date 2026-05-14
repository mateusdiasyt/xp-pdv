import Image from "next/image";
import Link from "next/link";
import { ProductKind, RecordStatus } from "@prisma/client";
import { Download, Search, SlidersHorizontal } from "lucide-react";

import { requirePermission } from "@/application/auth/guards";
import { getProductFormOptions, getProducts } from "@/application/catalog/product-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreateProductDialog } from "@/presentation/admin/catalog/products/create-product-dialog";
import { EditProductDialog } from "@/presentation/admin/catalog/products/edit-product-dialog";
import { toggleProductStatusAction } from "@/presentation/admin/catalog/products/actions";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    categoryId?: string;
  }>;
};

const statusFilterOptions: Array<{ label: string; value: string }> = [
  { label: "Todos", value: "all" },
  { label: "Ativos", value: RecordStatus.ACTIVE },
  { label: "Inativos", value: RecordStatus.INACTIVE },
];

const headerOutlineLinkClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70";

function productAvatarLabel(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function ProductImageCard({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string | null;
}) {
  if (!imageUrl) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-border/75 bg-background/35">
        <span className="text-2xl font-semibold tracking-[-0.04em] text-muted-foreground">
          {productAvatarLabel(name)}
        </span>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/75 bg-background/35">
      <Image src={imageUrl} alt={name} fill className="object-cover" unoptimized />
    </div>
  );
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_VIEW);
  const { q, status, categoryId } = await searchParams;
  const search = q?.trim() || undefined;
  const statusFilter =
    status === RecordStatus.ACTIVE || status === RecordStatus.INACTIVE ? (status as RecordStatus) : undefined;
  const categoryFilter =
    categoryId && categoryId !== "all" ? categoryId.trim() || undefined : undefined;

  const [products, options] = await Promise.all([
    getProducts({
      search,
      status: statusFilter,
      categoryId: categoryFilter,
    }),
    getProductFormOptions(),
  ]);
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.PRODUCTS_MANAGE);
  const hasFilters = Boolean(search || statusFilter || categoryFilter);

  const groupedProducts = options.categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      products: products.filter((product) => product.categoryId === category.id),
    }))
    .filter((category) => category.products.length > 0);

  const uncategorizedProducts = products.filter(
    (product) => !options.categories.some((category) => category.id === product.categoryId),
  );

  if (uncategorizedProducts.length > 0) {
    groupedProducts.push({
      id: "sem-categoria",
      name: "Outras categorias",
      products: uncategorizedProducts,
    });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Modulo ERP</p>
          <h1 className="text-3xl font-semibold tracking-[-0.01em] text-foreground">Catalogo de produtos</h1>
          <p className="text-sm text-muted-foreground">
            Produtos organizados por categoria, com imagem, estoque e edicao direta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/products" className={headerOutlineLinkClass}>
            <Download className="h-4 w-4" />
            Atualizar
          </Link>
          {canManage ? <CreateProductDialog categories={options.categories} suppliers={options.suppliers} /> : null}
        </div>
      </section>

      <Card>
        <CardContent className="space-y-4 pt-4">
          <form method="GET" className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_220px_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={search ?? ""}
                placeholder="Buscar por nome do produto ou SKU"
                className="pl-9"
              />
            </div>

            <select name="status" className="admin-native-select" defaultValue={statusFilter ?? "all"}>
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select name="categoryId" className="admin-native-select" defaultValue={categoryFilter ?? "all"}>
              <option value="all">Categoria</option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <Button type="submit" variant="secondary" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filtrar
            </Button>

            <Link href="/admin/products" className={headerOutlineLinkClass}>
              Limpar
            </Link>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <p>
              {products.length} produto(s) encontrado(s)
            </p>
            <p>Filtros ativos: {hasFilters ? "sim" : "nao"}</p>
          </div>
        </CardContent>
      </Card>

      {groupedProducts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado com os filtros atuais.
          </CardContent>
        </Card>
      ) : null}

      {groupedProducts.map((category) => (
        <section key={category.id} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{category.name}</h2>
              <p className="text-sm text-muted-foreground">{category.products.length} produto(s)</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1750px]:grid-cols-5">
            {category.products.map((product) => {
              const isLowStock = product.currentStock <= product.minStock;
              const isOutOfStock = product.currentStock <= 0;
              const stockLabel = isOutOfStock ? "Sem estoque" : isLowStock ? "Estoque baixo" : "Disponivel";

              return (
                <Card key={product.id} className="overflow-hidden">
                  <CardContent className="space-y-4 pt-4">
                    <ProductImageCard name={product.name} imageUrl={product.imageUrl} />

                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                          <p className="text-xs text-muted-foreground">NCM {product.ncm ?? "Nao informado"}</p>
                        </div>
                        <Badge
                          className={
                            product.kind === ProductKind.GAMEPLAY
                              ? "border border-sky-400/20 bg-sky-500/15 text-sky-200 hover:bg-sky-500/15"
                              : product.status === RecordStatus.ACTIVE
                              ? "border border-emerald-400/20 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15"
                              : "border border-rose-400/20 bg-rose-500/15 text-rose-300 hover:bg-rose-500/15"
                          }
                        >
                          {product.kind === ProductKind.GAMEPLAY
                            ? "Gameplay"
                            : product.status === RecordStatus.ACTIVE
                              ? "Ativo"
                              : "Inativo"}
                        </Badge>
                      </div>

                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {product.description || "Sem descricao cadastrada."}
                      </p>
                    </div>

                    <div className="grid gap-3 rounded-2xl border border-border/75 bg-background/32 p-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Categoria</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{product.category.name}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Preco</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatCurrency(Number(product.salePrice))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Estoque</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {product.kind === ProductKind.GAMEPLAY ? `${product.gameplayDurationMinutes ?? 0} min` : product.currentStock}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            product.kind === ProductKind.GAMEPLAY
                              ? "text-sky-300"
                              : isOutOfStock
                              ? "text-rose-400"
                              : isLowStock
                                ? "text-amber-400"
                                : "text-emerald-400",
                          )}
                        >
                          {product.kind === ProductKind.GAMEPLAY ? product.gameplayPlanCode ?? "Plano" : stockLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {canManage ? (
                        <>
                          <EditProductDialog
                            categories={options.categories}
                            suppliers={options.suppliers}
                            product={{
                              id: product.id,
                              name: product.name,
                              sku: product.sku,
                              ncm: product.ncm,
                              description: product.description,
                              imageUrl: product.imageUrl,
                              kind: product.kind,
                              gameplayPlanCode: product.gameplayPlanCode,
                              gameplayDurationMinutes: product.gameplayDurationMinutes,
                              categoryId: product.categoryId,
                              supplierId: product.supplierId,
                              costPrice: Number(product.costPrice).toFixed(2),
                              salePrice: Number(product.salePrice).toFixed(2),
                              minStock: product.minStock,
                              currentStock: product.currentStock,
                              status: product.status,
                            }}
                          />

                          <form action={toggleProductStatusAction} className="inline-flex">
                            <input type="hidden" name="productId" value={product.id} />
                            <input
                              type="hidden"
                              name="status"
                              value={product.status === RecordStatus.ACTIVE ? RecordStatus.INACTIVE : RecordStatus.ACTIVE}
                            />
                            <Button type="submit" variant="outline" size="sm">
                              {product.status === RecordStatus.ACTIVE ? "Desativar" : "Reativar"}
                            </Button>
                          </form>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem permissao de edicao</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
