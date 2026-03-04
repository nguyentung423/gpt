// ChatGPT Business API Client
// Uses accessToken + sessionToken from chatgpt.com /api/auth/session
// to interact with chatgpt.com/backend-api endpoints

const BACKEND_API = "https://chatgpt.com/backend-api";

// ─── Types ────────────────────────────────────────────────────────

export interface ChatGPTBusinessUser {
  id: string;
  account_user_id: string;
  email: string;
  verified_email: string | null;
  role: "account-owner" | "standard-user" | "admin";
  seat_type: string | null;
  name: string;
  created_time: string; // ISO timestamp
  is_scim_managed: boolean;
  deactivated_time: string | null;
}

export interface ChatGPTBusinessInvite {
  id: string;
  email_address: string;
  role: string;
  status?: string;
  created_time: string;
  is_scim_managed?: boolean;
}

export interface ChatGPTAccountInfo {
  id: string;
  planType: string;
  structure: string;
  organizationId: string;
}

export interface ChatGPTMeResponse {
  object: string;
  id: string;
  email: string;
  name: string;
  orgs: {
    object: string;
    data: Array<{
      id: string;
      title: string;
      name: string;
      personal: boolean;
      role: string;
    }>;
  };
}

// ─── Auth Credentials ─────────────────────────────────────────────

export interface ChatGPTCredentials {
  accessToken: string;
  sessionToken: string;
}

// ─── Core Fetch ───────────────────────────────────────────────────

function buildHeaders(creds: ChatGPTCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.accessToken}`,
    Cookie: `__Secure-next-auth.session-token=${creds.sessionToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Oai-Device-Id": crypto.randomUUID(),
    "Oai-Language": "en-US",
  };
}

async function fetchChatGPT<T>(
  creds: ChatGPTCredentials,
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BACKEND_API}${endpoint}`, {
    ...options,
    headers: {
      ...buildHeaders(creds),
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (!response.ok) {
    let errorMsg = `ChatGPT API error: ${response.status}`;
    try {
      const errorData = await response.json();
      const detail = errorData.detail || errorData.message;
      if (typeof detail === "string") {
        errorMsg = detail;
      } else if (detail) {
        errorMsg = JSON.stringify(detail);
      }
    } catch {
      // response wasn't JSON
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

// ─── Verify Credentials ──────────────────────────────────────────

export async function verifyCredentials(creds: ChatGPTCredentials): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  name?: string;
  error?: string;
}> {
  try {
    const me = await fetchChatGPT<ChatGPTMeResponse>(creds, "/me");
    return {
      valid: true,
      userId: me.id,
      email: me.email,
      name: me.name,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Connection error",
    };
  }
}

// ─── List Account Users (Members) ─────────────────────────────────

export async function listAccountUsers(
  creds: ChatGPTCredentials,
  accountId: string,
): Promise<ChatGPTBusinessUser[]> {
  const result = await fetchChatGPT<{ items: ChatGPTBusinessUser[] }>(
    creds,
    `/accounts/${accountId}/users`,
  );
  return result.items || [];
}

// ─── List Account Invites ─────────────────────────────────────────

export async function listAccountInvites(
  creds: ChatGPTCredentials,
  accountId: string,
): Promise<ChatGPTBusinessInvite[]> {
  try {
    const result = await fetchChatGPT<{ items: ChatGPTBusinessInvite[] }>(
      creds,
      `/accounts/${accountId}/invites`,
    );
    console.log(
      `[Invites] Found ${(result.items || []).length} invites for account ${accountId}`,
    );
    return result.items || [];
  } catch (err) {
    console.error("[Invites] Failed to fetch invites:", err);
    return [];
  }
}

// ─── Get All Members (users + invites) ────────────────────────────

export async function getWorkspaceMembers(
  creds: ChatGPTCredentials,
  accountId: string,
): Promise<{
  users: ChatGPTBusinessUser[];
  invites: ChatGPTBusinessInvite[];
}> {
  const [users, invites] = await Promise.all([
    listAccountUsers(creds, accountId),
    listAccountInvites(creds, accountId),
  ]);

  return { users, invites };
}

// ─── Invite User ──────────────────────────────────────────────────

export async function inviteUser(
  creds: ChatGPTCredentials,
  accountId: string,
  email: string,
  role: string = "standard-user",
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(
      `[Invite] Sending invite to ${email} for account ${accountId}, role: ${role}`,
    );

    // Check if there's already a pending invite for this email
    const existingInvites = await listAccountInvites(creds, accountId);
    console.log(`[Invite] Existing invites:`, JSON.stringify(existingInvites));
    const existingInvite = existingInvites.find(
      (inv) => inv.email_address?.toLowerCase() === email.toLowerCase(),
    );

    if (existingInvite) {
      console.log(
        `[Invite] Found existing invite ${existingInvite.id} (status: ${existingInvite.status}) — deleting and re-inviting`,
      );
      // Delete existing invite first
      try {
        await fetchChatGPT(
          creds,
          `/accounts/${accountId}/invites/${existingInvite.id}`,
          { method: "DELETE" },
        );
        console.log(`[Invite] Deleted old invite ${existingInvite.id}`);
      } catch (delErr) {
        console.error(`[Invite] Failed to delete old invite:`, delErr);
        // Continue anyway — try to create new invite
      }
    }

    // Send new invite
    const result = await fetchChatGPT<unknown>(
      creds,
      `/accounts/${accountId}/invites`,
      {
        method: "POST",
        body: JSON.stringify({ email_addresses: [email], role }),
      },
    );
    console.log(`[Invite] Response:`, JSON.stringify(result));
    return { success: true };
  } catch (error) {
    console.error(`[Invite] Error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to invite",
    };
  }
}

// ─── Remove User ──────────────────────────────────────────────────

export async function removeUser(
  creds: ChatGPTCredentials,
  accountId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await fetchChatGPT(creds, `/accounts/${accountId}/users/${userId}`, {
      method: "DELETE",
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove user",
    };
  }
}
