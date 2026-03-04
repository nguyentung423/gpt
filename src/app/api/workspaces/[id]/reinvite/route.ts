import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { inviteUser } from "@/lib/chatgpt-business";

// POST /api/workspaces/[id]/reinvite - Re-invite all removed customers
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Get workspace
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", id)
      .single();

    if (wsError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    const creds = {
      accessToken: workspace.access_token,
      sessionToken: workspace.session_token,
    };

    // Get all customers with status "removed" for this workspace
    const { data: removedCustomers } = await supabase
      .from("customers")
      .select("*")
      .eq("workspace_id", id)
      .eq("member_status", "removed");

    const toReinvite = removedCustomers || [];

    if (toReinvite.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Không có thành viên nào cần mời lại",
        invited: 0,
        failed: 0,
      });
    }

    let invited = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const customer of toReinvite) {
      const c = customer as Record<string, unknown>;
      const email = c.email as string;

      console.log(`[Re-invite] Sending invite to: ${email}`);
      const result = await inviteUser(
        creds,
        workspace.account_id,
        email,
        "standard-user",
      );

      if (result.success) {
        // Update status to pending
        await supabase
          .from("customers")
          .update({ member_status: "pending", openai_user_id: null })
          .eq("id", c.id);
        invited++;
      } else {
        failed++;
        errors.push(`${email}: ${result.error}`);
        console.error(`[Re-invite] Failed for ${email}:`, result.error);
      }
    }

    return NextResponse.json({
      success: true,
      total: toReinvite.length,
      invited,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Re-invite failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Re-invite failed",
      },
      { status: 500 },
    );
  }
}
