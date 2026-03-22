import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/workspaces - List all workspaces
export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Don't expose tokens in list response
    const safeWorkspaces = workspaces?.map((ws: Record<string, unknown>) => ({
      ...ws,
      access_token: "***hidden***",
      session_token: "***hidden***",
    }));

    return NextResponse.json({ workspaces: safeWorkspaces });
  } catch (error) {
    console.error("Failed to list workspaces:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list workspaces",
      },
      { status: 500 },
    );
  }
}

// POST /api/workspaces - Create workspace manually
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, accountId, registrationDate, status } = body;

    const safeName = typeof name === "string" ? name.trim() : "";
    const safeAccountId = typeof accountId === "string" ? accountId.trim() : "";
    const safeRegistrationDate =
      typeof registrationDate === "string" ? registrationDate.trim() : "";

    if (!safeAccountId) {
      return NextResponse.json(
        { error: "accountId là bắt buộc" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    // Check if workspace with same account_id already exists
    const { data: existing, error: existingError } = await supabase
      .from("workspaces")
      .select("id, name, deleted_at")
      .eq("account_id", safeAccountId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return NextResponse.json(
        {
          error: existing.deleted_at
            ? `Workspace "${existing.name}" đang nằm trong thùng rác. Hãy khôi phục thay vì tạo mới.`
            : `Workspace "${existing.name}" đã tồn tại với Account này`,
        },
        { status: 400 },
      );
    }

    // Create workspace with manually entered data.
    const safeStatus = status === "dead" ? "dead" : "active";
    const createdAt = safeRegistrationDate
      ? `${safeRegistrationDate}T00:00:00.000Z`
      : undefined;
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .insert({
        // Keep account_id as identity, while allowing optional display name.
        name: safeName || safeAccountId,
        access_token: "",
        session_token: "",
        account_id: safeAccountId,
        org_id: "",
        note: null,
        status: safeStatus,
        ...(createdAt ? { created_at: createdAt } : {}),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      workspace: {
        ...workspace,
        access_token: "***hidden***",
        session_token: "***hidden***",
      },
    });
  } catch (error) {
    console.error("Failed to create workspace:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create workspace",
      },
      { status: 500 },
    );
  }
}
