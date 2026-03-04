// ─── Database Types ────────────────────────────────────────────────
// Mirror of Supabase PostgreSQL schema for PremiumShop CRM

export type WorkspaceStatus = "active" | "dead";
export type MemberStatus = "active" | "pending" | "removed";

export interface Workspace {
  id: string; // uuid
  name: string; // Organization/Account name
  access_token: string; // ChatGPT accessToken (JWT)
  session_token: string; // ChatGPT sessionToken (encrypted JWT)
  account_id: string; // ChatGPT Business Account ID
  org_id: string; // OpenAI Organization ID
  status: WorkspaceStatus;
  note: string | null; // Ghi chú workspace
  created_at: string; // ISO timestamp
}

export interface Customer {
  id: string; // uuid
  name: string;
  email: string;
  workspace_id: string; // FK → workspaces.id
  openai_user_id: string | null; // OpenAI user ID (after accepted invite)
  member_status: MemberStatus; // Status in OpenAI org
  start_date: string; // ISO date string "YYYY-MM-DD" (ngày mua, hết hạn = +30 ngày)
  is_trial: boolean; // Khách dùng thử
  is_unknown: boolean; // Email lạ tự add vào workspace
  created_at: string; // ISO timestamp
}

// ─── Joined / View types ──────────────────────────────────────────

export interface CustomerWithWorkspace extends Customer {
  workspace: Pick<Workspace, "id" | "name" | "status"> | null;
}
