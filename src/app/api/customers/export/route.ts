import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { expiryFromStart } from "@/lib/utils";

const escapeCsv = (value: unknown) => {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// GET /api/customers/export - Download all customers as CSV
export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data: customers, error } = await supabase
      .from("customers")
      .select(
        `
        *,
        workspace:workspaces(id, name, account_id, status)
      `,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = customers || [];

    const headers = [
      "id",
      "name",
      "email",
      "workspace_id",
      "workspace_name",
      "workspace_account_id",
      "workspace_status",
      "start_date",
      "expiry_date",
      "days_left",
      "member_status",
      "is_trial",
      "is_unknown",
      "openai_user_id",
      "created_at",
    ];

    const csvRows = rows.map((row) => {
      const wsRaw = row.workspace as
        | {
            id?: string;
            name?: string;
            account_id?: string;
            status?: string;
          }
        | Array<{
            id?: string;
            name?: string;
            account_id?: string;
            status?: string;
          }>
        | null;
      const workspace = Array.isArray(wsRaw) ? wsRaw[0] : wsRaw;

      const expiryDate =
        row.expiry_date || expiryFromStart(row.start_date, !!row.is_trial);
      const daysLeft = Math.ceil(
        (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      return [
        row.id,
        row.name,
        row.email,
        row.workspace_id,
        workspace?.name || "",
        workspace?.account_id || "",
        workspace?.status || "",
        row.start_date,
        expiryDate,
        daysLeft,
        row.member_status,
        row.is_trial,
        row.is_unknown,
        row.openai_user_id || "",
        row.created_at,
      ]
        .map(escapeCsv)
        .join(",");
    });

    const csv = [headers.join(","), ...csvRows].join("\n");
    const fileName = `customers-export-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export customers:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export customers",
      },
      { status: 500 },
    );
  }
}
