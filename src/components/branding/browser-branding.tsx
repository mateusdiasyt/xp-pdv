"use client";

import { useEffect } from "react";

type BrandingMetadataResponse = {
  browserTitle?: string;
  faviconHref?: string;
};

function removeCurrentIconLinks() {
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .forEach((link) => link.remove());
}

function upsertIconLink(rel: string, href: string) {
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;

  if (rel.includes("icon")) {
    link.type = "image/png";
  }

  document.head.appendChild(link);
}

export function BrowserBranding() {
  useEffect(() => {
    let cancelled = false;

    async function syncBrowserBranding() {
      try {
        const response = await fetch(`/api/branding/metadata?t=${Date.now()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as BrandingMetadataResponse;
        if (cancelled) {
          return;
        }

        if (payload.browserTitle) {
          document.title = payload.browserTitle;
        }

        if (payload.faviconHref) {
          removeCurrentIconLinks();
          upsertIconLink("icon", payload.faviconHref);
          upsertIconLink("shortcut icon", payload.faviconHref);
          upsertIconLink("apple-touch-icon", payload.faviconHref);
        }
      } catch {
        // Browser chrome customization is cosmetic; the app should keep loading if it fails.
      }
    }

    void syncBrowserBranding();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
