import { describe, expect, it } from "vitest";
import { seenBy, summarizeThread } from "@/lib/chat";

describe("thread summary", () => {
  it("counts replies and keeps up to 3 most recent distinct authors", () => {
    const r = (a: string, t: string) => ({ author_id: a, created_at: t });
    const s = summarizeThread([r("a", "1"), r("b", "2"), r("a", "3"), r("c", "4"), r("d", "5")]);
    expect(s.count).toBe(5);
    expect(s.authors).toEqual(["d", "c", "a"]);
  });
});

describe("seen by", () => {
  it("counts only active non-authors who read after the message", () => {
    const msg = { author_id: "me", created_at: "2026-01-01T10:00" };
    const m = (user_id: string, status: string, last_read_at: string | null) => ({ user_id, status, last_read_at });
    const res = seenBy(msg, [m("me", "active", "2026-01-02"), m("x", "active", "2026-01-01T11:00"), m("y", "active", "2025-12-31"), m("z", "removed", "2026-01-02")]);
    expect(res.map((r) => r.user_id)).toEqual(["x"]);
  });
});
