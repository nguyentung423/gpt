import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/data - List Data customers (independent module)
export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("data_customers")
      .select("id, name, email, start_date, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ customers: data || [] });
  } catch (error) {
    console.error("Failed to list Data customers:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list Data customers",
      },
      { status: 500 },
    );
  }
}

// POST /api/data - Create Data customer
export async function POST(request: Request) {
  try {
    const { name, email, start_date } = await request.json();

    if (!name || !email || !start_date) {
      return NextResponse.json(
        { error: "name, email, start_date are required" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("data_customers")
      .insert({
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        start_date: String(start_date).trim(),
      })
      .select("id, name, email, start_date, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, customer: data });
  } catch (error) {
    console.error("Failed to create Data customer:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Data customer",
      },
      { status: 500 },
    );
  }
}
