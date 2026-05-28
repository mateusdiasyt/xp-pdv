import { CouponDiscountType, RecordStatus } from "@prisma/client";
import { BadgePercent, Power } from "lucide-react";

import { requirePermission } from "@/application/auth/guards";
import { getCouponsPageData } from "@/application/coupons/coupon-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";
import { CouponFormDialog } from "@/presentation/admin/coupons/coupon-form-dialog";
import { toggleCouponStatusAction } from "@/presentation/admin/coupons/actions";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

function formatDiscount(coupon: {
  discountType: CouponDiscountType;
  discountValue: { toString(): string };
}) {
  const value = Number(coupon.discountValue.toString());
  return coupon.discountType === CouponDiscountType.PERCENTAGE ? `${value}%` : formatCurrency(value);
}

export default async function CouponsPage() {
  await requirePermission(PERMISSIONS.PDV_VIEW);
  const { coupons, products, categories } = await getCouponsPageData();

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">PDV</p>
          <h1 className="text-3xl font-semibold tracking-[-0.01em] text-foreground">Cupons</h1>
        </div>
        <CouponFormDialog products={products} categories={categories} />
      </section>

      <div className="grid gap-3">
        {coupons.length === 0 ? (
          <Card className="border-dashed border-border/75 bg-card/70">
            <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <BadgePercent className="h-5 w-5 text-primary" />
              Nenhum cupom cadastrado.
            </CardContent>
          </Card>
        ) : (
          coupons.map((coupon) => {
            const isActive = coupon.status === RecordStatus.ACTIVE;
            const nextStatus = isActive ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
            const productCount = coupon.products.length;
            const categoryCount = coupon.categories.length;

            return (
              <Card key={coupon.id} className="border-border/75 bg-card/82">
                <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-sm font-semibold text-primary">
                        {coupon.code}
                      </span>
                      <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Ativo" : "Inativo"}</Badge>
                      <span className="text-sm font-semibold text-foreground">{coupon.name}</span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatDiscount(coupon)}</span>
                      <span>Usos: {coupon.usageLimit ? `${coupon.usedCount}/${coupon.usageLimit}` : `${coupon.usedCount}/sem limite`}</span>
                      <span>{coupon.minSubtotalAmount ? `Min. ${formatCurrency(Number(coupon.minSubtotalAmount.toString()))}` : "Sem minimo"}</span>
                      <span>
                        {categoryCount > 0
                          ? `${categoryCount} categoria(s)`
                          : productCount > 0
                            ? `${productCount} produto(s)`
                            : "Tudo"}
                      </span>
                      {coupon.endsAt ? <span>Ate {dateFormatter.format(coupon.endsAt)}</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:justify-end">
                    <CouponFormDialog coupon={coupon} products={products} categories={categories} />
                    <form action={toggleCouponStatusAction}>
                      <input type="hidden" name="couponId" value={coupon.id} />
                      <input type="hidden" name="status" value={nextStatus} />
                      <Button type="submit" variant="ghost" size="icon-sm" className="rounded-full border border-border/70">
                        <Power className="h-4 w-4" />
                        <span className="sr-only">{isActive ? "Desativar" : "Ativar"}</span>
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
