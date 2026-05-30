import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  void priority;

  return (
    <div className={cn("relative flex w-full items-center justify-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/branding/logo"
        alt="Logo do sistema"
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
