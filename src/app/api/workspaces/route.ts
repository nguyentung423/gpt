import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifyCredentials, listAccountUsers } from "@/lib/chatgpt-business";
import { todayStr, expiryFromStart } from "@/lib/utils";

// GET /api/workspaces - List all workspaces
export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("*")
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

// POST /api/workspaces - Create workspace from ChatGPT session data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accessToken, sessionToken, accountId, organizationId, name } = body;

    if (!accessToken || !sessionToken || !accountId) {
      return NextResponse.json(
        { error: "accessToken, sessionToken, và accountId là bắt buộc" },
        { status: 400 },
      );
    }

    const creds = { accessToken, sessionToken };

    // Verify credentials work
    const verification = await verifyCredentials(creds);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Token không hợp lệ hoặc đã hết hạn" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    // Check if workspace with same account_id already exists
    const { data: existing } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("account_id", accountId)
      .single();

    if (existing) {
      return NextResponse.json(
        {
          error: `Workspace "${existing.name}" đã tồn tại với Account này`,
        },
        { status: 400 },
      );
    }

    // Create workspace
    const workspaceName =
      name || verification.name || "ChatGPT Business Workspace";
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .insert({
        name: workspaceName,
        access_token: accessToken,
        session_token: sessionToken,
        account_id: accountId,
        org_id: organizationId || "",
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-import members from ChatGPT Business
    let importedCount = 0;
    try {
      const users = await listAccountUsers(creds, accountId);

      for (const user of users) {
        // Skip the account owner (admin)
        if (user.role === "account-owner") continue;

        const startDate = todayStr();

        const { error: upsertErr } = await supabase.from("customers").upsert(
          {
            name: user.name || user.email.split("@")[0],
            email: user.email.toLowerCase(),
            workspace_id: workspace.id,
            openai_user_id: user.id,
            member_status: user.deactivated_time ? "removed" : "active",
            start_date: startDate,
            expiry_date: expiryFromStart(startDate),
          },
          { onConflict: "email,workspace_id", ignoreDuplicates: true },
        );
        if (!upsertErr) importedCount++;
      }
    } catch (importErr) {
      console.error("Auto-import failed (workspace still created):", importErr);
    }

    return NextResponse.json({
      success: true,
      workspace: {
        ...workspace,
        access_token: "***hidden***",
        session_token: "***hidden***",
      },
      importedMembers: importedCount,
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
