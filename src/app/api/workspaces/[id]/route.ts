import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifyCredentials } from "@/lib/chatgpt-business";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/workspaces/[id] - Get workspace details
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    // Count customers
    const { count: customerCount } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", id);

    return NextResponse.json({
      workspace: {
        ...workspace,
        access_token: "***hidden***",
        session_token: "***hidden***",
        customer_count: customerCount || 0,
      },
    });
  } catch (error) {
    console.error("Failed to get workspace:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get workspace",
      },
      { status: 500 },
    );
  }
}

// PATCH /api/workspaces/[id] - Update workspace (name, status, or tokens)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = await createServerClient();

    // If session_json is provided, parse tokens from it and reactivate
    if (body.session_json) {
      let parsed;
      try {
        parsed =
          typeof body.session_json === "string"
            ? JSON.parse(body.session_json)
            : body.session_json;
      } catch {
        return NextResponse.json(
          { error: "JSON session không hợp lệ" },
          { status: 400 },
        );
      }

      const accessToken = parsed.accessToken;
      const sessionToken =
        parsed.sessionToken ||
        parsed["__Secure-next-auth.session-token"] ||
        parsed.session_token;

      if (!accessToken || !sessionToken) {
        return NextResponse.json(
          { error: "Thiếu accessToken hoặc sessionToken trong JSON" },
          { status: 400 },
        );
      }

      // Verify credentials trước khi lưu
      const verification = await verifyCredentials({
        accessToken,
        sessionToken,
      });
      if (!verification.valid) {
        return NextResponse.json(
          {
            error: `Token không hợp lệ: ${verification.error || "Không thể xác minh"}`,
          },
          { status: 400 },
        );
      }

      const { data: workspace, error } = await supabase
        .from("workspaces")
        .update({
          access_token: accessToken,
          session_token: sessionToken,
          status: "active",
        })
        .eq("id", id)
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
    }

    // Normal update (name / status / note)
    const updateData: Record<string, string | null> = {};
    if (body.name) updateData.name = body.name;
    if (body.status) updateData.status = body.status;
    if (body.note !== undefined) updateData.note = body.note || null;

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .update(updateData)
      .eq("id", id)
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
    console.error("Failed to update workspace:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update workspace",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/workspaces/[id] - Delete workspace
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Check if there are customers
    const { count } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `Không thể xóa workspace có ${count} khách hàng. Hãy chuyển khách hàng sang workspace khác trước.`,
        },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("workspaces").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Failed to delete workspace:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete workspace",
      },
      { status: 500 },
    );
  }
}
