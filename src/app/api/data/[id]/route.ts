import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

// DELETE /api/data/[id] - Delete Data customer
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("data_customers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Failed to delete Data customer:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete Data customer",
      },
      { status: 500 },
    );
  }
}
