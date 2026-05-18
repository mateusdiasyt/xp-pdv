import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";

import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";
import { BrowserBranding } from "@/components/branding/browser-branding";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const browserTitleFallback = "PDV - XP Arcade e Bar";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { customization } = await getBrandCustomizationSnapshot();
    const browserTitle = customization.browserTitle || browserTitleFallback;
    const faviconVersion =
      "updatedAt" in customization && customization.updatedAt ? customization.updatedAt.getTime() : "default";
    const faviconHref = `/api/branding/favicon?v=${faviconVersion}`;

    return {
      title: browserTitle,
      description: "Sistema administrativo profissional para operacao, estoque, caixa e PDV.",
      icons: {
        icon: [{ url: faviconHref }],
        shortcut: [{ url: faviconHref }],
        apple: [{ url: faviconHref }],
      },
    };
  } catch {
    return {
      title: browserTitleFallback,
      description: "Sistema administrativo profissional para operacao, estoque, caixa e PDV.",
      icons: {
        icon: [{ url: "/api/branding/favicon?v=fallback" }],
        shortcut: [{ url: "/api/branding/favicon?v=fallback" }],
        apple: [{ url: "/api/branding/favicon?v=fallback" }],
      },
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <body className="antialiased">
        <BrowserBranding />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
