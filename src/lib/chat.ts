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

export function isBlockedFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return BLOCKED_EXT.includes(ext);
}

export function deletedLabel(m: Pick<Message, "deleted_by">) {
  return m.deleted_by === "admin" ? "הודעה מחוקה על ידי מנהל" : "הודעה מחוקה על ידי כותב";
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
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
