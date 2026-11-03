import { useEffect, useState } from "react";
import { Check, X, Copy, Link2, MoreVertical, ShieldCheck, UserMinus, LogOut, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { deletedLabel, errorText, formatDay, formatTime, isOnline, type Group, type Member, type Message } from "@/lib/chat";

export function GroupSidebar({ group, members, userId, isAdmin, groups, onSwitchGroup, onChanged }: {
  group: Group; members: Member[]; userId: string; isAdmin: boolean; groups: Group[]; onSwitchGroup: (id: string) => void; onChanged: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [desc, setDesc] = useState(group.description);
  const active = members.filter((m) => m.status === "active");

  const rpc = async (fn: "promote_member" | "remove_member", u: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    const { error } = await supabase.rpc(fn, { _g: group.id, _u: u });
    if (error) toast.error(errorText(error)); else onChanged();
  };
  const leave = async () => {
    if (!confirm("לעזוב את הקבוצה?")) return;
    const { error } = await supabase.rpc("leave_group", { _g: group.id });
    if (error) toast.error(errorText(error)); else onChanged();
  };
  const save = async () => {
    const { error } = await supabase.rpc("update_group", { _g: group.id, _name: name, _description: desc });
    if (error) return toast.error(errorText(error));
    setEditOpen(false);
    onChanged();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 flex-none items-center justify-center rounded-2xl bg-accent text-xl font-bold text-accent-foreground">{group.name[0]}</div>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-base font-medium">{group.name}</b>
          <small className="text-xs text-muted-foreground">{active.length} חברים</small>
        </div>
        {isAdmin && (
          <button aria-label="עריכת פרטי הקבוצה" onClick={() => { setName(group.name); setDesc(group.description); setEditOpen(true); }} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
            <Pencil className="size-4" />
          </button>
        )}
      </div>
      {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
      {groups.length > 1 && (
        <select className="h-9 rounded-full border bg-card px-3 text-sm" value={group.id} onChange={(e) => onSwitchGroup(e.target.value)}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
      <div className="mt-2 text-xs font-medium text-muted-foreground">חברי הקבוצה</div>
      <ul className="-mx-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {active.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted">
            <div className="relative">
              <Avatar profile={m.profile} size={32} />
              {isOnline(m.profile?.last_seen_at) && <span className="absolute -bottom-0.5 -end-0.5 size-3 rounded-full border-2 border-card bg-ok" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{m.profile?.display_name}{m.user_id === userId && " (את/ה)"}</div>
              {m.role === "admin" && <div className="text-[11px] text-primary">מנהל</div>}
            </div>
            {isAdmin && m.user_id !== userId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="פעולות" className="rounded-full p-1 text-muted-foreground hover:bg-card"><MoreVertical className="size-4" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {m.role !== "admin" && <DropdownMenuItem onClick={() => rpc("promote_member", m.user_id, `למנות את ${m.profile?.display_name} למנהל?`)}><ShieldCheck className="size-4" /> מינוי למנהל</DropdownMenuItem>}
                  <DropdownMenuItem className="text-destructive" onClick={() => rpc("remove_member", m.user_id, `להסיר את ${m.profile?.display_name} מהקבוצה?`)}><UserMinus className="size-4" /> הסרה מהקבוצה</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ul>
      <Button variant="outline" className="rounded-full" onClick={leave}><LogOut className="size-4" /> עזיבת הקבוצה</Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>עריכת פרטי הקבוצה</DialogTitle></DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם הקבוצה" />
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="תיאור" />
          <DialogFooter><Button onClick={save} disabled={!name.trim()}>שמירה</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export type PanelTab = "pinned" | "invite" | "requests" | "reports" | "audit" | "search";

type ReportRow = { id: string; reason: string; reporter_id: string; message_id: string; created_at: string; status: string };
type AuditRow = { id: string; action: string; actor_id: string | null; subject_user_id: string | null; created_at: string };

const AUDIT_LABEL: Record<string, string> = {
  join_approved: "אישר/ה בקשת הצטרפות של",
  join_rejected: "דחה/תה בקשת הצטרפות של",
  member_removed: "הסיר/ה את",
  member_promoted: "מינה/תה למנהל את",
  message_deleted: "מחק/ה הודעה של",
  message_pinned: "הצמיד/ה הודעה של",
  message_unpinned: "ביטל/ה הצמדה להודעה של",
  group_updated: "עדכן/ה את פרטי הקבוצה",
  report_delete: "טיפל/ה בדיווח (מחיקה) על",
  report_remove: "טיפל/ה בדיווח (הסרה) על",
  report_dismiss: "דחה/תה דיווח על",
};

export function ContextPanel({ tab, setTab, groupId, userId, isAdmin, members, pinned, searchResults, searchQuery, nameOf, onJump, onChanged, reportsVersion }: {
  tab: PanelTab; setTab: (t: PanelTab) => void; groupId: string; userId: string; isAdmin: boolean; members: Member[];
  pinned: Message[]; searchResults: Message[] | null; searchQuery: string; nameOf: (id: string | null) => string;
  onJump: (id: string) => void; onChanged: () => void; reportsVersion: number;
}) {
  const pending = members.filter((m) => m.status === "pending");
  const [reports, setReports] = useState<(ReportRow & { msg?: Message })[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [invite, setInvite] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("reports").select("*").eq("group_id", groupId).eq("status", "open").order("created_at", { ascending: false }).then(async ({ data }) => {
      const rows = (data ?? []) as ReportRow[];
      const ids = rows.map((r) => r.message_id);
      const { data: msgs } = ids.length ? await supabase.from("messages").select("*").in("id", ids) : { data: [] };
      setReports(rows.map((r) => ({ ...r, msg: msgs?.find((m) => m.id === r.message_id) })));
    });
  }, [groupId, isAdmin, reportsVersion, tab]);

  useEffect(() => {
    if (tab !== "audit" || !isAdmin) return;
    supabase.from("audit_log").select("*").eq("group_id", groupId).order("created_at", { ascending: false }).limit(200).then(({ data }) => setAudit((data ?? []) as AuditRow[]));
  }, [tab, groupId, isAdmin]);

  useEffect(() => {
    if (tab !== "invite" || invite) return;
    supabase.from("invites").select("token").eq("group_id", groupId).eq("created_by", userId).limit(1).then(({ data }) => {
      if (data?.[0]) setInvite(data[0].token);
    });
  }, [tab, groupId, userId, invite]);

  const createInvite = async () => {
    const { data, error } = await supabase.from("invites").insert({ group_id: groupId, created_by: userId }).select("token").single();
    if (error) return toast.error(errorText(error));
    setInvite(data.token);
  };
  const inviteUrl = invite ? `${window.location.origin}/join/${invite}` : "";

  const decide = async (u: string, approve: boolean) => {
    const { error } = await supabase.rpc("decide_request", { _g: groupId, _u: u, _approve: approve });
    if (error) toast.error(errorText(error)); else onChanged();
  };
  const resolve = async (r: ReportRow & { msg?: Message }, action: "delete" | "remove" | "dismiss") => {
    if (action !== "dismiss" && !confirm(action === "delete" ? "למחוק את ההודעה?" : "להסיר את הכותב מהקבוצה?")) return;
    const { error } = await supabase.rpc("resolve_report", { _r: r.id, _action: action });
    if (error) return toast.error(errorText(error));
    if (action === "delete" && r.msg?.attachment_path) await supabase.storage.from("attachments").remove([r.msg.attachment_path]);
    setReports((x) => x.filter((y) => y.id !== r.id));
    onChanged();
  };

  const tabs: { id: PanelTab; label: string; count?: number; show: boolean }[] = [
    { id: "pinned", label: "נעוצות", show: true },
    { id: "invite", label: "הזמנה", show: true },
    { id: "requests", label: "בקשות", count: pending.length, show: isAdmin },
    { id: "reports", label: "דיווחים", count: reports.length, show: isAdmin },
    { id: "audit", label: "יומן", show: isAdmin },
    { id: "search", label: "חיפוש", show: searchResults !== null },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-1 border-b p-2">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-1 rounded-full px-3 py-1.5 text-sm", tab === t.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
            {t.label}
            {!!t.count && <span className="min-w-[18px] rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "pinned" && (pinned.length === 0 ? <Empty>אין הודעות נעוצות</Empty> : pinned.map((m) => (
          <MsgCard key={m.id} m={m} nameOf={nameOf} onClick={() => onJump(m.id)} />
        )))}

        {tab === "invite" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">כל מי שמקבל את הקישור יכול לבקש להצטרף. אף אחד לא נכנס בלי אישור של מנהל.</p>
            {invite ? (
              <>
                <div className="break-all rounded-xl bg-secondary p-3 text-xs" dir="ltr">{inviteUrl}</div>
                <Button className="w-full rounded-full" onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success("הקישור הועתק"); }}><Copy className="size-4" /> העתקת הקישור</Button>
              </>
            ) : (
              <Button className="w-full rounded-full" onClick={createInvite}><Link2 className="size-4" /> יצירת קישור הזמנה</Button>
            )}
          </div>
        )}

        {tab === "requests" && (pending.length === 0 ? <Empty>אין בקשות ממתינות</Empty> : pending.map((m) => (
          <div key={m.user_id} className="mb-2 flex items-center gap-3 rounded-xl border p-3">
            <Avatar profile={m.profile} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.profile?.display_name}</div>
              <div className="truncate text-xs text-muted-foreground" dir="ltr">{m.profile?.email}</div>
              <div className="text-xs text-muted-foreground">הוזמן/ה על ידי {m.inviter?.display_name ?? "—"}</div>
            </div>
            <button aria-label="אישור" onClick={() => decide(m.user_id, true)} className="rounded-full bg-primary p-2 text-primary-foreground"><Check className="size-4" /></button>
            <button aria-label="דחייה" onClick={() => decide(m.user_id, false)} className="rounded-full border p-2 text-destructive"><X className="size-4" /></button>
          </div>
        )))}

        {tab === "reports" && (reports.length === 0 ? <Empty>אין דיווחים פתוחים</Empty> : reports.map((r) => (
          <div key={r.id} className="mb-3 space-y-2 rounded-xl border p-3 text-sm">
            <div className="text-xs text-muted-foreground">דווח על ידי {nameOf(r.reporter_id)} · {formatTime(r.created_at)}</div>
            {r.reason && <div>סיבה: {r.reason}</div>}
            {r.msg && <MsgCard m={r.msg} nameOf={nameOf} onClick={() => onJump(r.message_id)} />}
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="destructive" className="rounded-full" onClick={() => resolve(r, "delete")}>מחיקת ההודעה</Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => resolve(r, "remove")}>הסרת הכותב</Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => resolve(r, "dismiss")}>דחייה</Button>
            </div>
          </div>
        )))}

        {tab === "audit" && (audit.length === 0 ? <Empty>היומן ריק</Empty> : audit.map((a) => (
          <div key={a.id} className="border-b py-2 text-sm">
            <b className="font-medium">{nameOf(a.actor_id)}</b> {AUDIT_LABEL[a.action] ?? a.action} {a.subject_user_id && <b className="font-medium">{nameOf(a.subject_user_id)}</b>}
            <div className="text-xs text-muted-foreground">{formatDay(a.created_at)} · {formatTime(a.created_at)}</div>
          </div>
        )))}

        {tab === "search" && searchResults && (searchResults.length === 0 ? <Empty>לא נמצאו תוצאות ל"{searchQuery}"</Empty> : searchResults.map((m) => (
          <MsgCard key={m.id} m={m} nameOf={nameOf} onClick={() => onJump(m.id)} highlight={searchQuery} />
        )))}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

function MsgCard({ m, nameOf, onClick, highlight }: { m: Message; nameOf: (id: string | null) => string; onClick: () => void; highlight?: string }) {
  const body = m.deleted_by ? deletedLabel(m) : m.body || m.attachment_name || "";
  let content: React.ReactNode = body;
  if (highlight) {
    const i = body.toLowerCase().indexOf(highlight.toLowerCase());
    if (i >= 0) content = <>{body.slice(0, i)}<mark className="bg-mark text-foreground">{body.slice(i, i + highlight.length)}</mark>{body.slice(i + highlight.length)}</>;
  }
  return (
    <button onClick={onClick} className="mb-2 block w-full rounded-xl bg-muted p-3 text-start text-sm hover:bg-accent">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <b className="font-medium text-foreground">{nameOf(m.author_id)}</b>
        <span>{formatDay(m.created_at)} · {formatTime(m.created_at)}</span>
      </div>
      <div className="line-clamp-3 whitespace-pre-wrap" dir="auto">{content}</div>
    </button>
  );
}
