import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type RestoreType = "customer" | "workspace";

// GET /api/trash - List deleted customers/workspaces
export async function GET() {
  try {
    const supabase = await createServerClient();

    const [customersRes, workspacesRes] = await Promise.all([
      supabase
        .from("customers")
        .select(
          `
          id,
          name,
          email,
          start_date,
          deleted_at,
          workspace_id,
          workspace:workspaces(id, name, account_id)
        `,
        )
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("workspaces")
        .select("id, name, account_id, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ]);

    if (customersRes.error) throw customersRes.error;
    if (workspacesRes.error) throw workspacesRes.error;

    const workspaces = workspacesRes.data || [];
    const workspaceIds = workspaces.map((w) => w.id);

    let countsMap = new Map<string, number>();
    if (workspaceIds.length > 0) {
      const { data: counts, error: countError } = await supabase
        .from("customers")
        .select("workspace_id")
        .in("workspace_id", workspaceIds)
        .not("deleted_at", "is", null);

      if (countError) throw countError;

      countsMap = new Map<string, number>();
      for (const row of counts || []) {
        const key = row.workspace_id as string;
        countsMap.set(key, (countsMap.get(key) || 0) + 1);
      }
    }

    const deletedWorkspaces = workspaces.map((ws) => ({
      ...ws,
      deleted_customers_count: countsMap.get(ws.id) || 0,
    }));

    return NextResponse.json({
      customers: customersRes.data || [],
      workspaces: deletedWorkspaces,
    });
  } catch (error) {
    console.error("Failed to load trash:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load trash",
      },
      { status: 500 },
    );
  }
}

// PATCH /api/trash - Restore soft-deleted customer/workspace
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const type = body?.type as RestoreType;
    const id = typeof body?.id === "string" ? body.id : "";

    if (!id || (type !== "customer" && type !== "workspace")) {
      return NextResponse.json(
        { error: "type và id là bắt buộc" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    if (type === "customer") {
      const { data: customer, error: getCustomerError } = await supabase
        .from("customers")
        .select("id, workspace_id")
        .eq("id", id)
        .not("deleted_at", "is", null)
        .single();

      if (getCustomerError || !customer) {
        return NextResponse.json(
          { error: "Khách hàng không tồn tại trong thùng rác" },
          { status: 404 },
        );
      }

      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("id", customer.workspace_id)
        .is("deleted_at", null)
        .single();

      if (workspaceError || !workspace) {
        return NextResponse.json(
          {
            error:
              "Workspace của khách hàng đang bị ẩn. Hãy khôi phục workspace trước.",
          },
          { status: 400 },
        );
      }

      const { error: restoreError } = await supabase
        .from("customers")
        .update({ deleted_at: null })
        .eq("id", id)
        .not("deleted_at", "is", null);

      if (restoreError) throw restoreError;

      return NextResponse.json({ success: true, restored: true, type });
    }

    const { error: restoreWorkspaceError } = await supabase
      .from("workspaces")
      .update({ deleted_at: null })
      .eq("id", id)
      .not("deleted_at", "is", null);

    if (restoreWorkspaceError) throw restoreWorkspaceError;

    // Restore all customers in this workspace for convenience.
    const { error: restoreCustomersError } = await supabase
      .from("customers")
      .update({ deleted_at: null })
      .eq("workspace_id", id)
      .not("deleted_at", "is", null);

    if (restoreCustomersError) throw restoreCustomersError;

    return NextResponse.json({ success: true, restored: true, type });
  } catch (error) {
    console.error("Failed to restore from trash:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to restore from trash",
      },
      { status: 500 },
    );
  }
}
