import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { listAccountUsers, listAccountInvites } from "@/lib/chatgpt-business";
import { todayStr, expiryFromStart } from "@/lib/utils";

// POST /api/workspaces/[id]/sync - Sync members from ChatGPT Business
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Get workspace with tokens
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

    // Fetch current members AND invites from ChatGPT
    const [users, invites] = await Promise.all([
      listAccountUsers(creds, workspace.account_id),
      listAccountInvites(creds, workspace.account_id),
    ]);

    // Get existing customers for this workspace
    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("*")
      .eq("workspace_id", id);

    const dbCustomers = existingCustomers || [];
    const existingEmails = new Set(
      dbCustomers.map((c: Record<string, unknown>) =>
        (c.email as string).toLowerCase(),
      ),
    );
    const remoteEmails = new Set(users.map((u) => u.email.toLowerCase()));
    const pendingInviteEmails = new Set(
      invites
        .map((inv) => inv.email_address?.toLowerCase())
        .filter((e): e is string => !!e),
    );

    let added = 0;
    let updated = 0;
    const unknownEmails: string[] = [];

    for (const user of users) {
      if (user.role === "account-owner") continue;

      if (!existingEmails.has(user.email.toLowerCase())) {
        // Member chưa có trong DB → người lạ tự add hoặc mới tham gia
        unknownEmails.push(user.email.toLowerCase());

        // Vẫn import vào DB như bình thường, đánh dấu là unknown
        const startDate = todayStr();
        await supabase.from("customers").upsert(
          {
            name: user.name || user.email.split("@")[0],
            email: user.email.toLowerCase(),
            workspace_id: id,
            openai_user_id: user.id,
            member_status: user.deactivated_time ? "removed" : "active",
            start_date: startDate,
            expiry_date: expiryFromStart(startDate),
            is_unknown: true,
          },
          { onConflict: "email,workspace_id", ignoreDuplicates: true },
        );
        added++;
      } else {
        // Existing member - update status & openai_user_id
        const newStatus = user.deactivated_time ? "removed" : "active";
        await (supabase as unknown as Record<string, CallableFunction>)
          .from("customers")
          .update({
            openai_user_id: user.id,
            member_status: newStatus,
            name: user.name || undefined,
          })
          .eq("workspace_id", id)
          .ilike("email", user.email);
        updated++;
      }
    }

    // Mark removed members (in DB but not in ChatGPT users AND not in pending invites)
    let removed = 0;
    for (const customer of dbCustomers) {
      const c = customer as Record<string, unknown>;
      const email = (c.email as string).toLowerCase();
      if (remoteEmails.has(email)) continue;
      if (pendingInviteEmails.has(email)) {
        await (supabase as unknown as Record<string, CallableFunction>)
          .from("customers")
          .update({ member_status: "pending" })
          .eq("id", c.id);
        continue;
      }
      await (supabase as unknown as Record<string, CallableFunction>)
        .from("customers")
        .update({ member_status: "removed" })
        .eq("id", c.id);
      removed++;
    }

    return NextResponse.json({
      success: true,
      added,
      updated,
      removed,
      unknownMembers: unknownEmails.length,
      totalRemote: users.filter((u) => u.role !== "account-owner").length,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 },
    );
  }
}
