import { LockKeyhole, Sparkles } from "lucide-react";

type ModuleLockCardProps = {
  title: string;
  description: string;
  requiredPlan?: string;
  className?: string;
};

export function ModuleLockCard({
  title,
  description,
  requiredPlan = "Platina",
  className = "",
}: ModuleLockCardProps) {
  return (
    <div
      className={`rounded-3xl border border-primary/25 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_14%,transparent),rgba(18,18,18,0.88)_42%,rgba(18,18,18,0.72))] p-6 shadow-2xl shadow-black/16 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/12 text-primary">
            <LockKeyhole className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-100">
                <Sparkles className="size-3" />
                Plano {requiredPlan}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
