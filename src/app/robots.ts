import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "https://xp-pdv.vercel.app").replace(
  /\/$/,
  "",
);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/admin", "/api", "/app", "/super-admin"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
