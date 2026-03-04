import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { inviteUser } from "@/lib/chatgpt-business";

interface Params {
  params: Promise<{ id: string }>;
}

interface CustomerWithWorkspace {
  id: string;
  email: string;
  workspace: {
    id: string;
    access_token: string;
    session_token: string;
    account_id: string;
  } | null;
}

// POST /api/customers/[id]/invite - Send ChatGPT Business invite for customer
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Get customer with workspace
    const { data, error: custError } = await supabase
      .from("customers")
      .select(
        `
        id,
        email,
        workspace:workspaces(id, access_token, session_token, account_id)
      `,
      )
      .eq("id", id)
      .single();

    const customer = data as CustomerWithWorkspace | null;

    if (custError || !customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    if (!customer.workspace?.access_token) {
      return NextResponse.json(
        { error: "Workspace không có token" },
        { status: 400 },
      );
    }

    const creds = {
      accessToken: customer.workspace.access_token,
      sessionToken: customer.workspace.session_token,
    };

    // Send invite via ChatGPT Business API
    const result = await inviteUser(
      creds,
      customer.workspace.account_id,
      customer.email,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Update customer status to pending
    await supabase
      .from("customers")
      .update({ member_status: "pending" })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      message: `Đã gửi lời mời đến ${customer.email}`,
    });
  } catch (error) {
    console.error("Failed to send invite:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send invite",
      },
      { status: 500 },
    );
  }
}
