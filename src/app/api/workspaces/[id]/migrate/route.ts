import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { inviteUser, removeUser } from "@/lib/chatgpt-business";

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/workspaces/[id]/migrate - Migrate all customers to a new workspace
// Body: { target_workspace_id: string }
export async function POST(request: Request, { params }: Params) {
  try {
    const { id: sourceId } = await params;
    const { target_workspace_id } = await request.json();

    if (!target_workspace_id) {
      return NextResponse.json(
        { error: "target_workspace_id là bắt buộc" },
        { status: 400 },
      );
    }

    if (sourceId === target_workspace_id) {
      return NextResponse.json(
        { error: "Workspace nguồn và đích không được trùng nhau" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    // Get source workspace (for removing users)
    const { data: sourceWs } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", sourceId)
      .single();

    // Get target workspace (for inviting users)
    const { data: targetWs, error: targetErr } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", target_workspace_id)
      .single();

    if (targetErr || !targetWs) {
      return NextResponse.json(
        { error: "Workspace đích không tồn tại" },
        { status: 404 },
      );
    }

    // Get all customers from source workspace
    const { data: customers, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("workspace_id", sourceId);

    if (custErr || !customers || customers.length === 0) {
      return NextResponse.json(
        { error: "Không có khách hàng nào để chuyển" },
        { status: 400 },
      );
    }

    const targetCreds = {
      accessToken: targetWs.access_token,
      sessionToken: targetWs.session_token,
    };

    let migrated = 0;
    let inviteSent = 0;
    let inviteFailed = 0;
    const errors: string[] = [];

    for (const customer of customers) {
      const c = customer as Record<string, unknown>;
      const email = c.email as string;
      const openaiUserId = c.openai_user_id as string | null;

      // 1. Try to remove from source workspace (if has openai_user_id and source has tokens)
      if (openaiUserId && sourceWs?.access_token && sourceWs?.session_token) {
        try {
          await removeUser(
            {
              accessToken: sourceWs.access_token,
              sessionToken: sourceWs.session_token,
            },
            sourceWs.account_id,
            openaiUserId,
          );
        } catch {
          // Source workspace might be dead, continue anyway
        }
      }

      // 2. Move customer to target workspace in DB (keep original start_date)
      await (supabase as unknown as Record<string, CallableFunction>)
        .from("customers")
        .update({
          workspace_id: target_workspace_id,
          openai_user_id: null, // Reset — will be set after they accept invite
          member_status: "pending",
        })
        .eq("id", c.id);

      migrated++;

      // 3. Send invite to target workspace
      const inviteResult = await inviteUser(
        targetCreds,
        targetWs.account_id,
        email,
      );

      if (inviteResult.success) {
        inviteSent++;
      } else {
        inviteFailed++;
        errors.push(`${email}: ${inviteResult.error}`);
      }
    }

    // 4. Mark source workspace as dead
    await (supabase as unknown as Record<string, CallableFunction>)
      .from("workspaces")
      .update({ status: "dead" })
      .eq("id", sourceId);

    return NextResponse.json({
      success: true,
      migrated,
      inviteSent,
      inviteFailed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Migration failed",
      },
      { status: 500 },
    );
  }
}
