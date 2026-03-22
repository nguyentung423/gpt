import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { expiryFromStart, todayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Safe defaults to reduce setup steps.
// Keep bot token in env to avoid secret leakage in source code.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ALLOWED_CHAT_IDS = process.env.TELEGRAM_ALLOWED_CHAT_IDS || "";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat?: { id: number };
  };
};

const parseAddCommand = (text: string) => {
  // Format:
  // /add name | email | workspace_account_id | YYYY-MM-DD(optional)
  const payload = text.replace(/^\/add\s+/i, "").trim();
  const parts = payload.split("|").map((p) => p.trim());

  if (parts.length < 3) {
    return {
      ok: false as const,
      error:
        "Sai cú pháp. Dùng: /add Ten Khach | email@gmail.com | workspace_account_id | 2026-03-22",
    };
  }

  const [name, email, workspaceAccountId, startDateRaw] = parts;
  const startDate = startDateRaw || todayStr();

  if (!name || !email || !workspaceAccountId) {
    return {
      ok: false as const,
      error:
        "Thiếu dữ liệu. Cần đủ: tên, email, workspace_account_id (ngày mua có thể bỏ trống).",
    };
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false as const, error: "Email không hợp lệ." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return {
      ok: false as const,
      error: "Ngày mua không hợp lệ. Dùng định dạng YYYY-MM-DD.",
    };
  }

  return {
    ok: true as const,
    data: {
      name,
      email: email.toLowerCase(),
      workspaceAccountId,
      startDate,
    },
  };
};

async function sendTelegramMessage(chatId: number, text: string) {
  if (!BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN is missing");
    return;
  }

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

function isAllowedChat(chatId: number) {
  if (!ALLOWED_CHAT_IDS.trim()) {
    return true;
  }

  const allowed = ALLOWED_CHAT_IDS.split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return allowed.includes(String(chatId));
}

export async function POST(request: Request) {
  try {
    const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");

    if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as TelegramUpdate;
    const msg = body.message;

    if (!msg?.chat?.id || !msg.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!isAllowedChat(chatId)) {
      return NextResponse.json({ ok: true });
    }

    if (/^\/help/i.test(text) || /^\/start/i.test(text)) {
      await sendTelegramMessage(
        chatId,
        [
          "Lenh ho tro:",
          "/add Ten Khach | email@gmail.com | workspace_account_id | 2026-03-22",
          "Ngay mua co the bo trong, he thong se mac dinh ngay hom nay.",
        ].join("\n"),
      );
      return NextResponse.json({ ok: true });
    }

    if (!/^\/add\s+/i.test(text)) {
      await sendTelegramMessage(
        chatId,
        "Lenh khong hop le. Dung /help de xem huong dan.",
      );
      return NextResponse.json({ ok: true });
    }

    const parsed = parseAddCommand(text);
    if (!parsed.ok) {
      await sendTelegramMessage(chatId, parsed.error);
      return NextResponse.json({ ok: true });
    }

    const { name, email, workspaceAccountId, startDate } = parsed.data;
    const supabase = await createServerClient();

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("account_id", workspaceAccountId)
      .is("deleted_at", null)
      .single();

    if (workspaceError || !workspace) {
      await sendTelegramMessage(
        chatId,
        `Khong tim thay workspace voi account_id: ${workspaceAccountId}`,
      );
      return NextResponse.json({ ok: true });
    }

    const { data: customer, error: insertError } = await supabase
      .from("customers")
      .insert({
        name,
        email,
        workspace_id: workspace.id,
        openai_user_id: null,
        member_status: "pending",
        start_date: startDate,
        expiry_date: expiryFromStart(startDate),
      })
      .select("id, name, email")
      .single();

    if (insertError) {
      await sendTelegramMessage(
        chatId,
        `Them khach that bai: ${insertError.message}`,
      );
      return NextResponse.json({ ok: true });
    }

    await sendTelegramMessage(
      chatId,
      `Da them customer thanh cong:\n- Ten: ${customer.name}\n- Email: ${customer.email}\n- Workspace: ${workspace.name}`,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook failed:", error);
    return NextResponse.json({ ok: true });
  }
}
