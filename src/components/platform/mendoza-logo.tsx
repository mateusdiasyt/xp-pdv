import { cn } from "@/lib/utils";

type MendozaLogoProps = {
  className?: string;
};

export function MendozaLogo({ className }: MendozaLogoProps) {
  return (
    <svg
      viewBox="0 0 360 86"
      role="img"
      aria-label="Mendoza PDV"
      className={cn("block h-auto w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="7" width="72" height="72" rx="18" fill="hsl(var(--primary))" />
      <path d="M50 7h6c10 0 18 8 18 18v36c0 10-8 18-18 18H34L50 7Z" fill="#ff004f" opacity="0.45" />
      <rect x="2.5" y="7.5" width="71" height="71" rx="17.5" fill="none" stroke="rgba(255,255,255,0.22)" />
      <path
        d="M18 58V26h11.5L38 40.3 46.5 26H58v32H46.6V43.7L38 57.2 29.4 43.7V58H18Z"
        fill="white"
      />
      <path d="M63 18h-9v-5h9v5ZM23 73h-9v-5h9v5Z" fill="rgba(255,255,255,0.74)" />
      <text
        x="92"
        y="40"
        fill="white"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="28"
        fontWeight="900"
        letterSpacing="2.4"
      >
        MENDOZA
      </text>
      <text
        x="94"
        y="64"
        fill="hsl(var(--primary))"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="18"
        fontWeight="900"
        letterSpacing="7"
      >
        PDV
      </text>
    </svg>
  );
}
