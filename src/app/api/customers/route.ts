import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { inviteUser } from "@/lib/chatgpt-business";
import { todayStr, expiryFromStart } from "@/lib/utils";

// GET /api/customers - List all customers with workspace info
export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data: customers, error } = await supabase
      .from("customers")
      .select(
        `
        *,
        workspace:workspaces(id, name, status)
      `,
      )
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

    // Auto-send invite to ChatGPT Business workspace
    let inviteResult: { success: boolean; error?: string } = { success: false };
    try {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("access_token, session_token, account_id")
        .eq("id", workspace_id)
        .single();

      if (workspace?.access_token && workspace?.session_token) {
        inviteResult = await inviteUser(
          {
            accessToken: workspace.access_token,
            sessionToken: workspace.session_token,
          },
          workspace.account_id,
          email,
        );
      }
    } catch (inviteErr) {
      console.error("Auto-invite failed:", inviteErr);
    }

    return NextResponse.json({
      success: true,
      customer,
      invited: inviteResult.success,
      inviteError: inviteResult.error
        ? typeof inviteResult.error === "string"
          ? inviteResult.error
          : JSON.stringify(inviteResult.error)
        : null,
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
