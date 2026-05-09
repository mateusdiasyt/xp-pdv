"use client";

import { useEffect } from "react";

type BrandingMetadataResponse = {
  browserTitle?: string;
  faviconHref?: string;
};

function upsertIconLink(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }

  link.href = href;
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
