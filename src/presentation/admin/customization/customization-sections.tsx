"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Building2, FileKey2, Link2, LockKeyhole } from "lucide-react";

import { ModuleLockCard } from "@/components/admin/module-lock-card";
import { cn } from "@/lib/utils";

type CustomizationSectionKey = "brand" | "link" | "fiscal";

type CustomizationSectionsProps = {
  brandPanel: ReactNode;
  linkPanel: ReactNode;
  fiscalPanel: ReactNode;
  lockedSections?: Partial<Record<CustomizationSectionKey, {
    title: string;
    description: string;
    requiredPlan?: string;
  }>>;
};

const sections: Array<{
  key: CustomizationSectionKey;
  title: string;
  description: string;
  icon: typeof Building2;
}> = [
  {
    key: "brand",
    title: "Marca e identidade visual",
    description: "Logo, cores, aba do navegador e horario.",
    icon: Building2,
  },
  {
    key: "link",
    title: "Link personalizado",
    description: "Defina o endereco exclusivo do cliente.",
    icon: Link2,
  },
  {
    key: "fiscal",
    title: "Fiscal / Focus NFe",
    description: "Tokens, ambiente, CNPJ e NFC-e.",
    icon: FileKey2,
  },
];

export function CustomizationSections({
  brandPanel,
  linkPanel,
  fiscalPanel,
  lockedSections = {},
}: CustomizationSectionsProps) {
  const [activeSection, setActiveSection] = useState<CustomizationSectionKey>("brand");
  const activeTitle = sections.find((section) => section.key === activeSection)?.title ?? "Configuracoes";
  const activeLock = lockedSections[activeSection];

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="grid content-start gap-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = section.key === activeSection;
          const isLocked = Boolean(lockedSections[section.key]);

          return (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              className={cn(
                "group rounded-2xl border bg-card/70 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card",
                isActive ? "border-primary/45 bg-primary/10 shadow-primary/10" : "border-border/70",
                isLocked ? "border-amber-300/22 bg-amber-300/5" : "",
              )}
            >
              <span className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                    isActive
                      ? "border-primary/45 bg-primary text-primary-foreground"
                      : "border-border/70 bg-background/55 text-muted-foreground group-hover:text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {section.title}
                    {isLocked ? <LockKeyhole className="size-3.5 text-amber-100/80" /> : null}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{section.description}</span>
                </span>
              </span>
            </button>
          );
        })}
      </aside>

      <section className="min-h-[520px] rounded-3xl border border-border/75 bg-card/70 p-5 shadow-xl shadow-black/10">
        <div className="mb-5 border-b border-border/65 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Configuracoes</p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">{activeTitle}</h2>
        </div>

        {activeLock ? (
          <ModuleLockCard
            title={activeLock.title}
            description={activeLock.description}
            requiredPlan={activeLock.requiredPlan}
          />
        ) : null}
        {!activeLock && activeSection === "brand" ? brandPanel : null}
        {!activeLock && activeSection === "link" ? linkPanel : null}
        {!activeLock && activeSection === "fiscal" ? fiscalPanel : null}
      </section>
    </div>
  );
}
