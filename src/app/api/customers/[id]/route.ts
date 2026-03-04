import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { removeUser } from "@/lib/chatgpt-business";
import { expiryFromStart } from "@/lib/utils";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/customers/[id] - Get customer details
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: customer, error } = await supabase
      .from("customers")
      .select(
        `
        *,
        workspace:workspaces(id, name, status)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Failed to get customer:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get customer",
      },
      { status: 500 },
    );
  }
}

// PATCH /api/customers/[id] - Update customer
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const updates = await request.json();

    const supabase = await createServerClient();

    // Whitelist: chỉ cho phép update các field an toàn
    const ALLOWED_FIELDS = [
      "name",
      "email",
      "start_date",
      "member_status",
      "note",
      "is_trial",
      "is_unknown",
    ];
    const safeUpdates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json(
        { error: "Không có field hợp lệ để cập nhật" },
        { status: 400 },
      );
    }

    // Nếu update email → lowercase
    if (safeUpdates.email) {
      safeUpdates.email = (safeUpdates.email as string).toLowerCase();
    }

    // Nếu cần tính lại expiry_date (khi thay đổi start_date hoặc is_trial)
    const needsRecalc =
      safeUpdates.start_date !== undefined ||
      safeUpdates.is_trial !== undefined;

    if (needsRecalc) {
      // Fetch current record để lấy giá trị hiện tại
      const { data: current } = await supabase
        .from("customers")
        .select("start_date, is_trial")
        .eq("id", id)
        .single();

      const startDate =
        (safeUpdates.start_date as string) || current?.start_date;
      const isTrial =
        safeUpdates.is_trial !== undefined
          ? (safeUpdates.is_trial as boolean)
          : (current?.is_trial ?? false);

      if (startDate) {
        safeUpdates.expiry_date = expiryFromStart(startDate, isTrial);
      }
    }

    const { data: customer, error } = await supabase
      .from("customers")
      .update(safeUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("Failed to update customer:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update customer",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/customers/[id] - Delete customer + remove from ChatGPT workspace
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Get customer with workspace tokens before deleting
    const { data: customer } = await supabase
      .from("customers")
      .select(
        `
        id,
        openai_user_id,
        email,
        workspace:workspaces(id, access_token, session_token, account_id)
      `,
      )
      .eq("id", id)
      .single();

    // Try to remove from ChatGPT workspace first
    if (customer?.openai_user_id && customer?.workspace) {
      const wsRaw = customer.workspace as unknown;
      const ws = (Array.isArray(wsRaw) ? wsRaw[0] : wsRaw) as Record<
        string,
        string
      >;
      if (ws?.access_token && ws?.session_token && ws?.account_id) {
        try {
          await removeUser(
            { accessToken: ws.access_token, sessionToken: ws.session_token },
            ws.account_id,
            customer.openai_user_id,
          );
        } catch (removeErr) {
          console.error(
            "Failed to remove from ChatGPT workspace (continuing with DB delete):",
            removeErr,
          );
        }
      }
    }

    // Delete from database
    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Failed to delete customer:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete customer",
      },
      { status: 500 },
    );
  }
}
