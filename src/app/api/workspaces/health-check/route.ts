import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifyCredentials } from "@/lib/chatgpt-business";

// POST /api/workspaces/health-check - Check all active workspaces and auto-mark dead ones
export async function POST() {
  try {
    const supabase = await createServerClient();

    // Get all active workspaces
    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("id, name, access_token, session_token, status")
      .eq("status", "active");

    if (error) throw error;

    const results: {
      id: string;
      name: string;
      alive: boolean;
      error?: string;
    }[] = [];

    // Process in batches of 5 to avoid rate limits
    const BATCH_SIZE = 5;
    const allWs = workspaces || [];

    for (let i = 0; i < allWs.length; i += BATCH_SIZE) {
      const batch = allWs.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (ws) => {
          const creds = {
            accessToken: ws.access_token,
            sessionToken: ws.session_token,
          };

          const check = await verifyCredentials(creds);

          if (!check.valid) {
            await (supabase as unknown as Record<string, CallableFunction>)
              .from("workspaces")
              .update({ status: "dead" })
              .eq("id", ws.id);

            return {
              id: ws.id,
              name: ws.name,
              alive: false,
              error: check.error,
            };
          }
          return { id: ws.id, name: ws.name, alive: true };
        }),
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") results.push(r.value);
      }
    }

    const deadCount = results.filter((r) => !r.alive).length;

    return NextResponse.json({
      success: true,
      checked: results.length,
      dead: deadCount,
      results,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 500 },
    );
  }
}
