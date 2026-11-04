import type { Tables } from "@/integrations/supabase/types";

export type Profile = Pick<Tables<"profiles">, "id" | "display_name" | "email" | "avatar_url" | "last_seen_at">;
export type Member = Tables<"group_members"> & { profile: Profile | null; inviter: Pick<Profile, "id" | "display_name"> | null };
export type Message = Tables<"messages">;
export type Reaction = Tables<"reactions">;
export type Group = Tables<"groups">;
export type Quote = { id: string; author: string; body: string; deleted?: boolean };

export const INVITE_KEY = "gc.pendingInvite";
export const ACTIVE_GROUP_KEY = "gc.activeGroup";
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const BLOCKED_EXT = ["exe", "bat", "cmd", "sh", "msi", "scr", "com", "jar", "app"];
export const QUICK_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** Pastel background / dark ink pairs for space avatars (picked by a stable hash of the name). */
const SPACE_COLORS: [string, string][] = [
  ["oklch(0.911 0.06 154)", "oklch(0.319 0.075 151.7)"],
  ["oklch(0.912 0.04 260.1)", "oklch(0.495 0.199 260.6)"],
  ["oklch(0.917 0.052 58.7)", "oklch(0.38 0.101 49.5)"],
  ["oklch(0.918 0.042 25.2)", "oklch(0.383 0.131 29)"],
  ["oklch(0.916 0.037 303.1)", "oklch(0.36 0.176 296.3)"],
  ["oklch(0.956 0.074 95.9)", "oklch(0.399 0.082 84.4)"],
];

export function spaceColors(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  const [bg, ink] = SPACE_COLORS[h % SPACE_COLORS.length]!;
  return { bg, ink };
}

export function isBlockedFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return BLOCKED_EXT.includes(ext);
}

export function deletedLabel(m: Pick<Message, "deleted_by">) {
  return m.deleted_by === "admin" ? "הודעה נמחקה על ידי המנהל" : "הודעה נמחקה על ידי כותב ההודעה";
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

/** Message time like Google Chat: "5 דקות" for the first hour, then HH:MM. */
export function formatMsgTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${Math.max(1, mins)} דקות` : formatTime(iso);
}

export function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "היום";
  if (d.toDateString() === y.toDateString()) return "אתמול";
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

export function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isOnline(lastSeen: string | null | undefined) {
  return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

export function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (msg.includes("sole admin")) return "מנהל יחיד חייב למנות מנהל נוסף לפני עזיבה";
  if (msg.includes("forbidden")) return "אין לך הרשאה לפעולה הזו";
  if (msg.includes("invalid invite")) return "קישור ההזמנה אינו תקין";
  return "משהו השתבש, נסו שוב";
}

export type Notification = Tables<"notifications">;
export type ThreadSummary = { count: number; authors: string[] };

/** Active members (other than the author) whose last read time is at or after the message. */
export function seenBy<T extends { user_id: string; status: string; last_read_at: string | null }>(
  msg: Pick<Message, "author_id" | "created_at">,
  members: T[],
): T[] {
  return members.filter((m) => m.status === "active" && m.user_id !== msg.author_id && !!m.last_read_at && m.last_read_at >= msg.created_at);
}

/** Summarise thread replies: count and up to 3 most recent distinct authors (newest first). */
export function summarizeThread(replies: Pick<Message, "author_id" | "created_at">[]): ThreadSummary {
  const sorted = [...replies].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const authors: string[] = [];
  for (const r of sorted) if (r.author_id && !authors.includes(r.author_id) && authors.length < 3) authors.push(r.author_id);
  return { count: replies.length, authors };
}
