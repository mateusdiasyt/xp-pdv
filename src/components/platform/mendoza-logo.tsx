import { cn } from "@/lib/utils";

type MendozaLogoProps = {
  className?: string;
};

export function MendozaLogo({ className }: MendozaLogoProps) {
  return (
    <svg
      viewBox="0 0 512 390"
      role="img"
      aria-label="Mendoza PDV"
      className={cn("block h-auto w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mendoza-logo-gradient" x1="92" y1="40" x2="430" y2="318" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff496a" />
          <stop offset="1" stopColor="#ff174f" />
        </linearGradient>
      </defs>

      <path
        d="M105 220v-73c0-59 48-107 107-107h61c-44 29-72 78-72 134v46h-96Z"
        fill="url(#mendoza-logo-gradient)"
      />
      <path
        d="M224 220v-73c0-59 48-107 107-107h28c47 0 88 22 114 57h-73c-38 0-68 30-68 68v55H224Z"
        fill="url(#mendoza-logo-gradient)"
      />
      <rect x="354" y="97" width="88" height="123" rx="44" fill="url(#mendoza-logo-gradient)" />
      <text
        x="256"
        y="293"
        fill="url(#mendoza-logo-gradient)"
        fontFamily="Arial Black, Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="52"
        fontWeight="900"
        letterSpacing="10"
        textAnchor="middle"
      >
        MENDOZA
      </text>
      <line x1="116" y1="342" x2="205" y2="342" stroke="url(#mendoza-logo-gradient)" strokeWidth="4" />
      <text
        x="256"
        y="354"
        fill="url(#mendoza-logo-gradient)"
        fontFamily="Arial Black, Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="34"
        fontWeight="900"
        letterSpacing="18"
        textAnchor="middle"
      >
        PDV
      </text>
      <line x1="307" y1="342" x2="396" y2="342" stroke="url(#mendoza-logo-gradient)" strokeWidth="4" />
    </svg>
  );
}
