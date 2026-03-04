import { NextResponse } from "next/server";

// POST /api/login - Server-side PIN verification
export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json(
        { error: "Vui lòng nhập mật mã" },
        { status: 400 },
      );
    }

    // PIN is server-side only (NOT NEXT_PUBLIC_), never exposed to browser
    const ADMIN_PIN = process.env.ADMIN_PIN || "123456";

    if (pin !== ADMIN_PIN) {
      return NextResponse.json({ error: "Mật mã không đúng" }, { status: 401 });
    }

    // Set auth cookie from server side (HttpOnly for security)
    const response = NextResponse.json({ success: true });
    response.cookies.set("crm_authenticated", "true", {
      path: "/",
      maxAge: 86400, // 24 hours
      httpOnly: true, // Cannot be read/modified by JavaScript
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Lỗi xác thực" }, { status: 500 });
  }
}
