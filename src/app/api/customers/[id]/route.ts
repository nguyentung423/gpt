import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { expiryFromStart, todayStr } from "@/lib/utils";

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
        workspace:workspaces(id, name, account_id, status, created_at)
      `,
      )
      .eq("id", id)
      .is("deleted_at", null)
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

    // Rule trial:
    // - Bật/tắt trial => reset còn lại ngay lập tức (35/30 ngày)
    // - Đổi start_date => tính lại hạn theo trạng thái trial hiện tại
    const needCurrentRow =
      safeUpdates.start_date !== undefined ||
      safeUpdates.is_trial !== undefined;

    if (needCurrentRow) {
      const { data: current } = await supabase
        .from("customers")
        .select("start_date, is_trial, expiry_date")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      const startDate =
        safeUpdates.start_date !== undefined
          ? (safeUpdates.start_date as string)
          : current?.start_date;

      const currentIsTrial = current?.is_trial ?? false;
      const nextIsTrial =
        safeUpdates.is_trial !== undefined
          ? (safeUpdates.is_trial as boolean)
          : currentIsTrial;

      const startChanged = safeUpdates.start_date !== undefined;
      const trialChanged = safeUpdates.is_trial !== undefined;

      if (trialChanged) {
        // Toggle trial should immediately reset remaining days.
        const resetStart =
          safeUpdates.start_date !== undefined
            ? (safeUpdates.start_date as string)
            : todayStr();

        safeUpdates.start_date = resetStart;
        safeUpdates.expiry_date = expiryFromStart(resetStart, nextIsTrial);
      } else if (startDate && startChanged) {
        safeUpdates.expiry_date = expiryFromStart(startDate, nextIsTrial);
      }
    }

    const { data: customer, error } = await supabase
      .from("customers")
      .update(safeUpdates)
      .eq("id", id)
      .is("deleted_at", null)
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

// DELETE /api/customers/[id] - Soft delete customer (move to trash)
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: true, soft: true });
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
