import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type WarningCustomer = {
  id: string;
  name: string;
  email: string;
  is_trial: boolean;
  expiry_date: string;
  workspace: { name: string } | null;
  remaining: number;
};

type UnknownCustomer = {
  id: string;
  email: string;
  created_at: string;
  workspace: { name: string } | null;
};

const toYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dayDiff = (fromYmd: string, toYmdStr: string) => {
  const from = new Date(`${fromYmd}T00:00:00`);
  const to = new Date(`${toYmdStr}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
};

// GET /api/dashboard - Optimized dashboard payload
export async function GET() {
  try {
    const supabase = await createServerClient();

    const today = new Date();
    const todayYmd = toYmd(today);
    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysYmd = toYmd(in3Days);

    const [
      totalCustomersRes,
      totalWorkspacesRes,
      activeWorkspacesRes,
      expiredCountRes,
      expiringIn1DayRes,
      expiringIn3DaysRes,
      warningCustomersRes,
      unknownCustomersRes,
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("workspaces")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("workspaces")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "active"),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .lt("expiry_date", todayYmd),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("expiry_date", todayYmd)
        .lte(
          "expiry_date",
          toYmd(
            new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() + 1,
            ),
          ),
        ),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gt(
          "expiry_date",
          toYmd(
            new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() + 1,
            ),
          ),
        )
        .lte("expiry_date", in3DaysYmd),
      supabase
        .from("customers")
        .select(
          "id, name, email, is_trial, expiry_date, workspace:workspaces(name)",
        )
        .is("deleted_at", null)
        .lte("expiry_date", in3DaysYmd)
        .order("expiry_date", { ascending: true })
        .limit(300),
      supabase
        .from("customers")
        .select("id, email, created_at, workspace:workspaces(name)")
        .is("deleted_at", null)
        .eq("is_unknown", true)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const errors = [
      totalCustomersRes.error,
      totalWorkspacesRes.error,
      activeWorkspacesRes.error,
      expiredCountRes.error,
      expiringIn1DayRes.error,
      expiringIn3DaysRes.error,
      warningCustomersRes.error,
      unknownCustomersRes.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw errors[0];
    }

    const warningList: WarningCustomer[] = (warningCustomersRes.data || []).map(
      (row: {
        id: string;
        name: string;
        email: string;
        is_trial?: boolean;
        expiry_date: string;
        workspace?: { name?: string } | { name?: string }[] | null;
      }) => {
        const ws = Array.isArray(row.workspace)
          ? row.workspace[0] || null
          : row.workspace || null;

        return {
          id: row.id,
          name: row.name,
          email: row.email,
          is_trial: !!row.is_trial,
          expiry_date: row.expiry_date,
          workspace: ws?.name ? { name: ws.name } : null,
          remaining: dayDiff(todayYmd, row.expiry_date),
        };
      },
    );

    const unknownList: UnknownCustomer[] = (unknownCustomersRes.data || []).map(
      (row: {
        id: string;
        email: string;
        created_at: string;
        workspace?: { name?: string } | { name?: string }[] | null;
      }) => {
        const ws = Array.isArray(row.workspace)
          ? row.workspace[0] || null
          : row.workspace || null;

        return {
          id: row.id,
          email: row.email,
          created_at: row.created_at,
          workspace: ws?.name ? { name: ws.name } : null,
        };
      },
    );

    return NextResponse.json({
      stats: {
        totalCustomers: totalCustomersRes.count || 0,
        totalWorkspaces: totalWorkspacesRes.count || 0,
        activeWorkspaces: activeWorkspacesRes.count || 0,
        expiredCount: expiredCountRes.count || 0,
        expiringIn1Day: expiringIn1DayRes.count || 0,
        expiringIn3Days: expiringIn3DaysRes.count || 0,
      },
      warningList,
      unknownList,
    });
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load dashboard data",
      },
      { status: 500 },
    );
  }
}
