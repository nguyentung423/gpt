import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date helpers (siêu đơn giản) ─────────────────────────────────

/** Get today as "YYYY-MM-DD" local */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Số ngày gói: trial = 35, thường = 30 */
export const DURATION_NORMAL = 30;
export const DURATION_TRIAL = 35;

/**
 * Đếm số ngày còn lại: start_date + duration - hôm nay
 * Input: "YYYY-MM-DD" string, isTrial flag
 * Output: số ngày còn lại (âm = hết hạn)
 */
export function daysLeft(startDate: string, isTrial = false): number {
  const [y, m, d] = startDate.split("-").map(Number);
  const start = new Date(y, m - 1, d); // local midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const duration = isTrial ? DURATION_TRIAL : DURATION_NORMAL;
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + duration);
  return Math.round((expiry.getTime() - today.getTime()) / 86400000);
}

/** Format "YYYY-MM-DD" → "dd/MM/yyyy" */
export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/** Tính ngày hết hạn "YYYY-MM-DD" = start + duration days (trial = 35, thường = 30) */
export function expiryFromStart(startDate: string, isTrial = false): string {
  const [y, m, d] = startDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const duration = isTrial ? DURATION_TRIAL : DURATION_NORMAL;
  dt.setDate(dt.getDate() + duration);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
