import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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
      .is("deleted_at", null)
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
      .eq("workspace_id", id)
      .is("deleted_at", null);

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

// PATCH /api/workspaces/[id] - Update workspace (manual fields only)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = await createServerClient();

    // Normal update (name / account_id / registration_date / status / note)
    const updateData: Record<string, string | null> = {};

    const safeName = typeof body.name === "string" ? body.name.trim() : "";
    const safeAccountId =
      typeof body.accountId === "string" ? body.accountId.trim() : "";
    const safeRegistrationDate =
      typeof body.registrationDate === "string"
        ? body.registrationDate.trim()
        : "";

    if (body.name !== undefined) {
      if (!safeName) {
        return NextResponse.json(
          { error: "Tên workspace không được để trống" },
          { status: 400 },
        );
      }
      updateData.name = safeName;
    }

    if (body.accountId !== undefined) {
      if (!safeAccountId) {
        return NextResponse.json(
          { error: "Account ID không được để trống" },
          { status: 400 },
        );
      }

      const { data: existing, error: existingError } = await supabase
        .from("workspaces")
        .select("id, name")
        .eq("account_id", safeAccountId)
        .is("deleted_at", null)
        .neq("id", id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        return NextResponse.json(
          {
            error: `Account ID đã được dùng bởi workspace "${existing.name}"`,
          },
          { status: 400 },
        );
      }

      updateData.account_id = safeAccountId;
    }

    if (body.registrationDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(safeRegistrationDate)) {
        return NextResponse.json(
          { error: "Ngày đăng ký workspace không hợp lệ" },
          { status: 400 },
        );
      }

      updateData.created_at = `${safeRegistrationDate}T00:00:00.000Z`;
    }

    if (body.status) updateData.status = body.status;
    if (body.note !== undefined) updateData.note = body.note || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Không có field hợp lệ để cập nhật" },
        { status: 400 },
      );
    }

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .update(updateData)
      .eq("id", id)
      .is("deleted_at", null)
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

// DELETE /api/workspaces/[id] - Soft delete workspace and active customers
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const deletedAt = new Date().toISOString();

    const { error: deleteWorkspaceError } = await supabase
      .from("workspaces")
      .update({ deleted_at: deletedAt })
      .eq("id", id)
      .is("deleted_at", null);

    if (deleteWorkspaceError) throw deleteWorkspaceError;

    const { error: deleteCustomersError } = await supabase
      .from("customers")
      .update({ deleted_at: deletedAt })
      .eq("workspace_id", id)
      .is("deleted_at", null);

    if (deleteCustomersError) throw deleteCustomersError;

    return NextResponse.json({
      success: true,
      deleted: true,
      soft: true,
    });
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
