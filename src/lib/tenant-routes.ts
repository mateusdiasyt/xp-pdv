export const DEFAULT_WORKSPACE_SLUG = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_SLUG ?? "xp-arcade";

export function getWorkspaceSlugFromPathname(pathname: string | null | undefined) {
  const match = pathname?.match(/^\/app\/([^/.]+)(?:\/|$)/);
  return match?.[1] ?? null;
}

export function toTenantAdminHref(href: string, workspaceSlug: string | null | undefined) {
  if (!workspaceSlug) {
    return href;
  }

  if (!href.startsWith("/admin")) {
    return href;
  }

  const publicPath = href === "/admin" ? "" : href.replace(/^\/admin/, "");

  return `/app/${workspaceSlug}${publicPath}`;
}

export function buildTenantAdminHref(workspaceSlug: string | null | undefined, adminPath = "/admin") {
  const slug = workspaceSlug || DEFAULT_WORKSPACE_SLUG;
  const normalizedPath = adminPath.startsWith("/admin") ? adminPath : `/admin${adminPath.startsWith("/") ? adminPath : `/${adminPath}`}`;
  const publicPath = normalizedPath === "/admin" ? "" : normalizedPath.replace(/^\/admin/, "");

  return `/app/${slug}${publicPath}`;
}
