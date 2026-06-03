import { type NextRequestWithAuth, withAuth } from "next-auth/middleware";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const authenticatedProxy = withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token }) => {
      return Boolean(token);
    },
  },
});

function isPublicTvAppRoute(pathname: string) {
  return pathname === "/admin/app" || pathname.startsWith("/admin/app/");
}

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isPublicTvAppRoute(request.nextUrl.pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-public-admin-app", "1");

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return authenticatedProxy(request as NextRequestWithAuth, event);
}

export const config = {
  matcher: ["/admin/:path*"],
};
