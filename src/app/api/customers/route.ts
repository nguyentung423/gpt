import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { todayStr, expiryFromStart } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/customers - List all customers with workspace info
export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data: customers, error } = await supabase
      .from("customers")
      .select(
        `
        *,
        workspace:workspaces(id, name, account_id, status, created_at)
      `,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Failed to list customers:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list customers",
      },
      { status: 500 },
    );
  }
}

// POST /api/customers - Create a new customer
export async function POST(request: Request) {
  try {
    const { name, email, workspace_id, start_date } = await request.json();

    if (!name || !email || !workspace_id) {
      return NextResponse.json(
        { error: "name, email, and workspace_id are required" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspace_id)
      .is("deleted_at", null)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace không tồn tại hoặc đã bị ẩn" },
        { status: 400 },
      );
    }

    // start_date = ngày mua (user chọn hoặc mặc định hôm nay)
    const purchaseDate = start_date || todayStr();

    // Insert customer
    const { data: customer, error } = await supabase
      .from("customers")
      .insert({
        name,
        email: email.toLowerCase(),
        workspace_id,
        openai_user_id: null,
        member_status: "pending",
        start_date: purchaseDate,
        expiry_date: expiryFromStart(purchaseDate),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("Failed to create customer:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create customer",
      },
      { status: 500 },
    );
  }
}
