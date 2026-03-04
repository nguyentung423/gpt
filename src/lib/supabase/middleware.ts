import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // For simple PIN auth, we check the cookie instead of Supabase session
  const isAuthenticated =
    request.cookies.get("crm_authenticated")?.value === "true";

  if (
    !isAuthenticated &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
