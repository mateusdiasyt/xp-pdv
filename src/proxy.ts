import { type NextRequestWithAuth, withAuth } from "next-auth/middleware";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const DEFAULT_WORKSPACE_SLUG = process.env.DEFAULT_WORKSPACE_SLUG ?? "xp-arcade";

function normalizeTenantSlug(value: unknown) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || DEFAULT_WORKSPACE_SLUG
  );
}

function parseTenantAdminPath(pathname: string) {
  const legacyMatch = pathname.match(/^\/app\/([^/]+)\/admin(?:\/(.*))?$/);

  if (legacyMatch) {
    const slug = normalizeTenantSlug(legacyMatch[1]);
    const rest = legacyMatch[2] ? `/${legacyMatch[2]}` : "";

    return {
      slug,
      adminPath: `/admin${rest}`,
      isLegacy: true,
    };
  }

  const match = pathname.match(/^\/app\/([^/.]+)(?:\/(.*))?$/);

  if (!match) {
    return null;
  }

  const slug = normalizeTenantSlug(match[1]);
  const rest = match[2] ? `/${match[2]}` : "";

  return {
    slug,
    adminPath: `/admin${rest}`,
    isLegacy: false,
  };
}

function isPublicTvAppRoute(pathname: string) {
  return pathname === "/admin/app" || pathname.startsWith("/admin/app/");
}

function rewriteTenantAdminRoute(request: NextRequest, slug: string, adminPath: string, isPublicAdminApp = false) {
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = adminPath;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", slug);

  if (isPublicAdminApp) {
    requestHeaders.set("x-public-admin-app", "1");
  }

  const response = NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set("xp-tenant-slug", slug, {
    path: "/",
    sameSite: "lax",
  });

  return response;
}

function buildTenantPublicPath(slug: string, adminPath: string) {
  const publicPath = adminPath === "/admin" ? "" : adminPath.replace(/^\/admin/, "");

  return `/app/${slug}${publicPath}`;
}

function nextWithHeaders(request: NextRequest, isPublicAdminApp = false) {
  const requestHeaders = new Headers(request.headers);

  if (isPublicAdminApp) {
    requestHeaders.set("x-public-admin-app", "1");
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

const authenticatedProxy = withAuth(
  function authenticatedRoute(request: NextRequestWithAuth) {
    const pathname = request.nextUrl.pathname;
    const tenantRoute = parseTenantAdminPath(pathname);

    if (request.nextauth.token?.accessScope === "platform") {
      const url = request.nextUrl.clone();
      url.pathname = "/super-admin";
      return NextResponse.redirect(url);
    }

    if (tenantRoute) {
      const tokenTenantSlug = normalizeTenantSlug(request.nextauth.token?.tenantSlug);

      if (tokenTenantSlug !== tenantRoute.slug) {
        const url = request.nextUrl.clone();
        url.pathname = buildTenantPublicPath(tokenTenantSlug, tenantRoute.adminPath);
        return NextResponse.redirect(url);
      }

      if (tenantRoute.isLegacy) {
        const url = request.nextUrl.clone();
        url.pathname = buildTenantPublicPath(tenantRoute.slug, tenantRoute.adminPath);
        return NextResponse.redirect(url);
      }

      return rewriteTenantAdminRoute(request, tenantRoute.slug, tenantRoute.adminPath);
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const tenantSlug = normalizeTenantSlug(request.nextauth.token?.tenantSlug);
      const url = request.nextUrl.clone();
      url.pathname = buildTenantPublicPath(tenantSlug, pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token }) => {
        return Boolean(token);
      },
    },
  },
);

const superAdminProxy = withAuth(
  function superAdminRoute() {
    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/super-admin/login",
    },
    callbacks: {
      authorized: ({ token }) => {
        return Boolean(token);
      },
    },
  },
);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/app/xp-tv.apk") {
    return NextResponse.next();
  }

  if (pathname === "/super-admin/login") {
    return NextResponse.next();
  }

  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) {
    return superAdminProxy(request as NextRequestWithAuth, event);
  }

  const tenantRoute = parseTenantAdminPath(pathname);

  if (tenantRoute && isPublicTvAppRoute(tenantRoute.adminPath)) {
    if (tenantRoute.isLegacy) {
      const url = request.nextUrl.clone();
      url.pathname = buildTenantPublicPath(tenantRoute.slug, tenantRoute.adminPath);
      return NextResponse.redirect(url);
    }

    return rewriteTenantAdminRoute(request, tenantRoute.slug, tenantRoute.adminPath, true);
  }

  if (isPublicTvAppRoute(pathname)) {
    return nextWithHeaders(request, true);
  }

  return authenticatedProxy(request as NextRequestWithAuth, event);
}

export const config = {
  matcher: ["/admin/:path*", "/app/:workspace", "/app/:workspace/:path*", "/super-admin/:path*"],
};
