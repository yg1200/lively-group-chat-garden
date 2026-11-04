import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search, LogOut, Settings, PanelLeft, X, Upload, Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThreadPanel } from "./ThreadPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar } from "./Avatar";
import { MessageItem } from "./MessageItem";
import { Composer } from "./Composer";
import { ContextPanel, GroupSidebar, type PanelTab } from "./Panels";
import { errorText, formatDay, formatTime, seenBy, summarizeThread, type Group, type Member, type Message, type Notification, type Quote, type Reaction, type ThreadSummary } from "@/lib/chat";

const PAGE = 50;
const MEMBER_SELECT = "*, profile:profiles!group_members_user_id_fkey(id,display_name,email,avatar_url,last_seen_at), inviter:profiles!group_members_invited_by_fkey(id,display_name)";

type Props = { groupId: string; userId: string; groups: Group[]; onSwitchGroup: (id: string) => void; onMembershipChanged: () => void };

export function ChatApp({ groupId, userId, groups, onSwitchGroup, onMembershipChanged }: Props) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [pinned, setPinned] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("pinned");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [reporting, setReporting] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportsVersion, setReportsVersion] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState<File | null>(null);
  const [threadRoot, setThreadRoot] = useState<Message | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [threadFocus, setThreadFocus] = useState<string | null>(null);
  const [threadReplyMap, setThreadReplyMap] = useState<Map<string, Pick<Message, "id" | "author_id" | "created_at">[]>>(new Map());
  const [rootAuthors, setRootAuthors] = useState<Map<string, string | null>>(new Map());
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const threadRootRef = useRef<string | null>(null);
  threadRootRef.current = threadRoot?.id ?? null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);

  const me = members.find((m) => m.user_id === userId);
  const isAdmin = me?.role === "admin" && me.status === "active";
  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const nameOf = useCallback((id: string | null) => (id ? memberMap.get(id)?.profile?.display_name ?? "משתמש" : "מערכת"), [memberMap]);
  const activeMembers = members.filter((m) => m.status === "active");
  const memberNames = activeMembers.map((m) => m.profile?.display_name ?? "").filter(Boolean);
  const myName = me?.profile?.display_name ?? "";

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("group_members").select(MEMBER_SELECT).eq("group_id", groupId);
    setMembers((data ?? []) as unknown as Member[]);
  }, [groupId]);
  const loadGroup = useCallback(async () => {
    const { data } = await supabase.from("groups").select("*").eq("id", groupId).single();
    setGroup(data);
  }, [groupId]);
  const loadPinned = useCallback(async () => {
    const { data } = await supabase.from("messages").select("*").eq("group_id", groupId).not("pinned_at", "is", null).is("deleted_by", null).order("pinned_at", { ascending: false });
    setPinned(data ?? []);
  }, [groupId]);
  const loadReactions = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await supabase.from("reactions").select("*").in("message_id", ids);
    setReactions((r) => [...r.filter((x) => !ids.includes(x.message_id)), ...(data ?? [])]);
  }, []);

  // thread metadata: reply lists per root + root authors (for participation)
  const loadThreadMeta = useCallback(async (rootIds: string[]) => {
    const ids = [...new Set(rootIds)];
    if (!ids.length) return;
    const [{ data: reps }, { data: roots }] = await Promise.all([
      supabase.from("messages").select("id, author_id, created_at, thread_root_id").in("thread_root_id", ids),
      supabase.from("messages").select("id, author_id").in("id", ids),
    ]);
    setThreadReplyMap((old) => {
      const next = new Map(old);
      ids.forEach((id) => next.set(id, []));
      (reps ?? []).forEach((r) => next.get(r.thread_root_id!)!.push(r));
      return next;
    });
    setRootAuthors((old) => { const next = new Map(old); (roots ?? []).forEach((r) => next.set(r.id, r.author_id)); return next; });
  }, []);
  const metaFor = useCallback((list: Message[]) => loadThreadMeta(list.map((m) => m.thread_root_id ?? m.id)), [loadThreadMeta]);

  const loadNotifs = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).eq("group_id", groupId).is("read_at", null).order("created_at", { ascending: false }).limit(50);
    setNotifs(data ?? []);
  }, [userId, groupId]);

  // initial load
  useEffect(() => {
    (async () => {
      const { data: mine } = await supabase.from("group_members").select("last_read_at").eq("group_id", groupId).eq("user_id", userId).single();
      setLastRead(mine?.last_read_at ?? null);
      await Promise.all([loadGroup(), loadMembers(), loadPinned()]);
      const { data } = await supabase.from("messages").select("*").eq("group_id", groupId).order("created_at", { ascending: false }).limit(PAGE);
      const list = (data ?? []).reverse();
      setMessages(list);
      setHasMore((data ?? []).length === PAGE);
      loadReactions(list.map((m) => m.id));
      metaFor(list);
      loadNotifs();
      supabase.rpc("mark_read", { _g: groupId });
    })();
  }, [groupId, userId, loadGroup, loadMembers, loadPinned, loadReactions, metaFor, loadNotifs]);

  // presence heartbeat
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") supabase.rpc("mark_read", { _g: groupId }); }, 120000);
    return () => clearInterval(t);
  }, [groupId]);

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel(`group-${groupId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` }, (p) => {
        const m = p.new as Message;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        if (m.thread_root_id) {
          const rid = m.thread_root_id;
          setThreadReplyMap((old) => { const next = new Map(old); const l = next.get(rid) ?? []; if (!l.some((x) => x.id === m.id)) next.set(rid, [...l, m]); return next; });
          if (threadRootRef.current === rid) setThreadReplies((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
          setRootAuthors((old) => { if (old.has(rid)) return old; loadThreadMeta([rid]); return old; });
        }
        if (m.kind === "system") { loadMembers(); loadGroup(); }
        if (document.visibilityState === "visible") supabase.rpc("mark_read", { _g: groupId });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` }, (p) => {
        const m = p.new as Message;
        setMessages((list) => list.map((x) => (x.id === m.id ? m : x)));
        setThreadReplies((list) => list.map((x) => (x.id === m.id ? m : x)));
        setThreadRoot((r) => (r?.id === m.id ? m : r));
        loadPinned();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions", filter: `group_id=eq.${groupId}` }, (p) => {
        const r = p.new as Reaction;
        setReactions((list) => (list.some((x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji) ? list : [...list, r]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "reactions" }, (p) => {
        const r = p.old as Partial<Reaction>;
        setReactions((list) => list.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` }, (p) => {
        const row = (p.new ?? {}) as Partial<Member>;
        if (row.user_id === userId && row.status !== "active") onMembershipChanged();
        else loadMembers();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => loadNotifs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId, userId, loadMembers, loadGroup, loadPinned, onMembershipChanged, loadThreadMeta, loadNotifs]);

  // scrolling
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stickBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const loadOlder = async () => {
    if (!hasMore || !messages.length) return;
    const { data } = await supabase.from("messages").select("*").eq("group_id", groupId).lt("created_at", messages[0]!.created_at).order("created_at", { ascending: false }).limit(PAGE);
    const older = (data ?? []).reverse();
    prevHeight.current = scrollRef.current?.scrollHeight ?? null;
    setMessages((l) => [...older, ...l]);
    setHasMore((data ?? []).length === PAGE);
    loadReactions(older.map((m) => m.id));
    metaFor(older);
  };

  const openThread = async (rootId: string, focus: string | null = null) => {
    const root = messages.find((m) => m.id === rootId) ?? (await supabase.from("messages").select("*").eq("id", rootId).single()).data;
    if (!root) return;
    const { data } = await supabase.from("messages").select("*").eq("thread_root_id", rootId).order("created_at");
    const replies = data ?? [];
    setThreadRoot(root);
    setThreadReplies(replies);
    setThreadFocus(focus);
    loadReactions([root.id, ...replies.map((r) => r.id)]);
    setSideOpen(false);
    setPanelOpen(true);
    const unread = notifs.filter((n) => n.thread_root_id === rootId).map((n) => n.id);
    if (unread.length) {
      setNotifs((l) => l.filter((n) => !unread.includes(n.id)));
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread);
    }
  };
  const closeThread = () => { setThreadRoot(null); setThreadReplies([]); setThreadFocus(null); };

  const onScroll = () => {
    const el = scrollRef.current!;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && hasMore && prevHeight.current === null) loadOlder();
  };

  const jumpTo = async (id: string) => {
    const known = messages.find((m) => m.id === id) ?? threadReplies.find((m) => m.id === id);
    const rootOf = known ? known.thread_root_id : (await supabase.from("messages").select("thread_root_id").eq("id", id).single()).data?.thread_root_id;
    if (rootOf && !isVisible(known ?? null)) return void openThread(rootOf, id);
    setSideOpen(false); setPanelOpen(false);
    if (!messages.some((m) => m.id === id) && messages.length) {
      const { data: target } = await supabase.from("messages").select("created_at").eq("id", id).single();
      if (!target) return;
      const { data } = await supabase.from("messages").select("*").eq("group_id", groupId).gte("created_at", target.created_at).lt("created_at", messages[0]!.created_at).order("created_at");
      const older = data ?? [];
      stickBottom.current = false;
      setMessages((l) => [...older, ...l]);
      loadReactions(older.map((m) => m.id));
      metaFor(older);
    }
    setTimeout(() => {
      document.getElementById(`m-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlight(id);
      setTimeout(() => setHighlight(null), 2000);
    }, 50);
  };

  // actions
  const send = async (body: string, extra: Partial<Message> = {}) => {
    const inThread = !!extra.thread_root_id;
    if (!inThread) stickBottom.current = true;
    const { data, error } = await supabase.from("messages").insert({ group_id: groupId, author_id: userId, body, quote: inThread ? null : quote ?? null, ...extra }).select().single();
    if (error) { toast.error(errorText(error)); return false; }
    setMessages((l) => (l.some((x) => x.id === data.id) ? l : [...l, data]));
    if (data.thread_root_id) {
      const rid = data.thread_root_id;
      setThreadReplies((l) => (l.some((x) => x.id === data.id) ? l : [...l, data]));
      setThreadReplyMap((old) => { const next = new Map(old); const l = next.get(rid) ?? []; if (!l.some((x) => x.id === data.id)) next.set(rid, [...l, data]); return next; });
    } else setQuote(null);
    return true;
  };

  const upload = async (file: File, body: string, signal: { cancelled: boolean }, base: Partial<Message> = {}) => {
    const path = `${groupId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
    if (signal.cancelled) { if (!error) await supabase.storage.from("attachments").remove([path]); return false; }
    if (error) { toast.error("ההעלאה נכשלה"); return false; }
    return send(body, { ...base, attachment_path: path, attachment_name: file.name, attachment_type: file.type, attachment_size: file.size });
  };

  const react = async (m: Message, emoji: string) => {
    const existing = reactions.find((r) => r.message_id === m.id && r.user_id === userId && r.emoji === emoji);
    if (existing) {
      setReactions((l) => l.filter((r) => r !== existing));
      await supabase.from("reactions").delete().match({ message_id: m.id, user_id: userId, emoji });
    } else {
      const row = { message_id: m.id, group_id: groupId, user_id: userId, emoji, created_at: new Date().toISOString() };
      setReactions((l) => [...l, row]);
      const { error } = await supabase.from("reactions").insert({ message_id: m.id, group_id: groupId, user_id: userId, emoji });
      if (error) toast.error(errorText(error));
    }
  };

  const edit = async (m: Message, body: string) => {
    const { error } = await supabase.rpc("edit_message", { _m: m.id, _body: body });
    if (error) { toast.error(errorText(error)); return false; }
    return true;
  };

  const remove = async (m: Message) => {
    if (!confirm("למחוק את ההודעה?")) return;
    const { data: path, error } = await supabase.rpc("delete_message", { _m: m.id });
    if (error) return void toast.error(errorText(error));
    if (path) await supabase.storage.from("attachments").remove([path]);
  };

  const pin = async (m: Message) => {
    const { error } = await supabase.rpc("toggle_pin", { _m: m.id });
    if (error) toast.error(errorText(error));
  };

  const submitReport = async () => {
    if (!reporting) return;
    const { error } = await supabase.from("reports").insert({ message_id: reporting.id, group_id: groupId, reporter_id: userId, reason: reportReason.trim() });
    if (error) return void toast.error(errorText(error));
    toast.success("הדיווח נשלח למנהלים");
    setReporting(null); setReportReason("");
  };

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) { setSearchResults(null); setTab("pinned"); return; }
    const { data } = await supabase.from("messages").select("*").eq("group_id", groupId).eq("kind", "user").is("deleted_by", null).ilike("body", `%${q.replace(/[%_]/g, "")}%`).order("created_at", { ascending: false }).limit(100);
    setSearchResults(data ?? []);
    setTab("search");
    setPanelOpen(true);
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const participates = (rootId: string) => rootAuthors.get(rootId) === userId || (threadReplyMap.get(rootId) ?? []).some((r) => r.author_id === userId);
  function isVisible(m: Message | null) {
    if (!m) return false;
    if (!m.thread_root_id) return true;
    return participates(m.thread_root_id) || (!!myName && m.body.includes(`@${myName}`));
  }
  const visible = messages.filter(isVisible);
  const summaryOf = (id: string): ThreadSummary => summarizeThread(threadReplyMap.get(id) ?? []);
  const actions = {
    onReact: (m: Message, e: string) => react(m, e),
    onEdit: edit,
    onDelete: remove,
    onPin: pin,
    onReport: (m: Message) => setReporting(m),
  };

  if (!group) return <div className="flex h-screen items-center justify-center text-muted-foreground">טוען את הקבוצה…</div>;

  const pendingCount = isAdmin ? members.filter((m) => m.status === "pending").length : 0;
  const firstUnread = lastRead ? visible.find((m) => m.created_at > lastRead && m.author_id !== userId && m.kind === "user")?.id : undefined;

  const sidebar = <GroupSidebar group={group} members={members} userId={userId} isAdmin={isAdmin} groups={groups} onSwitchGroup={onSwitchGroup} onChanged={() => { loadMembers(); loadGroup(); onMembershipChanged(); }} />;
  const panel = threadRoot ? (
    <ThreadPanel
      {...actions}
      root={threadRoot} replies={threadReplies} focusId={threadFocus} groupId={groupId} userId={userId} isAdmin={isAdmin}
      members={members} memberMap={memberMap} reactions={reactions} memberNames={memberNames} myName={myName} nameOf={nameOf}
      onClose={closeThread}
      onSend={(b, q) => send(b, { thread_root_id: threadRoot.id, quote: q })}
      onUpload={(f, b, s, q) => upload(f, b, s, { thread_root_id: threadRoot.id, quote: q })}
    />
  ) : (
    <ContextPanel
      tab={tab} setTab={setTab} groupId={groupId} userId={userId} isAdmin={isAdmin} members={members} pinned={pinned}
      searchResults={searchResults} searchQuery={search.trim()} nameOf={nameOf} onJump={jumpTo} reportsVersion={reportsVersion}
      onChanged={() => { loadMembers(); setReportsVersion((v) => v + 1); }}
    />
  );

  return (
    <div className="flex h-dvh flex-col px-2 md:px-4">
      <header className="flex min-h-16 flex-none items-center gap-3 py-2">
        <button aria-label="הגדרות הקבוצה" title="הגדרות הקבוצה" onClick={() => setSideOpen(true)} className="rounded-full p-2 text-muted-foreground hover:bg-secondary"><Settings className="size-5" /></button>
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><MessageSquare className="size-5" /></div>
          <span className="text-xl font-medium text-muted-foreground">צ'אט הקבוצה</span>
        </div>
        <form onSubmit={runSearch} className="mx-auto flex h-12 min-w-0 max-w-2xl flex-1 items-center gap-3 rounded-full bg-secondary px-4 text-muted-foreground">
          <Search className="size-5 flex-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש בהודעות" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground" />
          {search && <button type="button" aria-label="ניקוי" onClick={() => { setSearch(""); setSearchResults(null); setTab("pinned"); }}><X className="size-4" /></button>}
        </form>
        <button aria-label="לוח צד" onClick={() => setPanelOpen(true)} className="relative rounded-full p-2 text-muted-foreground hover:bg-secondary xl:hidden">
          <PanelLeft className="size-5" />
          {pendingCount > 0 && <span className="absolute -top-0.5 -start-0.5 min-w-[18px] rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">{pendingCount}</span>}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="התראות" className="relative rounded-full p-2 text-muted-foreground hover:bg-secondary">
              <Bell className="size-5" />
              {notifs.length > 0 && <span className="absolute -top-0.5 -start-0.5 min-w-[18px] rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">{notifs.length}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72" dir="rtl">
            <DropdownMenuLabel>התראות</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifs.length === 0 && <div className="px-2 py-4 text-center text-sm text-muted-foreground">אין התראות חדשות</div>}
            {notifs.map((n) => (
              <DropdownMenuItem key={n.id} onClick={() => openThread(n.thread_root_id, n.message_id)} className="flex-col items-start gap-0.5">
                <span className="text-sm"><b className="font-medium">{nameOf(n.actor_id)}</b> הגיב/ה בשרשור שלך</span>
                <span className="text-xs text-muted-foreground">{formatTime(n.created_at)}</span>
              </DropdownMenuItem>
            ))}
            {notifs.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { const ids = notifs.map((n) => n.id); setNotifs([]); await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids); }}>סימון הכל כנקרא</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-2">
          <div className="hidden text-end leading-tight sm:block">
            <b className="block text-sm font-medium">{myName}</b>
            <small className="text-xs text-muted-foreground">{isAdmin ? "מנהל" : "חבר/ה"}</small>
          </div>
          <Avatar profile={me?.profile} size={36} />
          <button aria-label="יציאה" onClick={signOut} className="rounded-full p-2 text-muted-foreground hover:bg-secondary"><LogOut className="size-5" /></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 pb-3">

        <main
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-card"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setDropped(f); }}
        >
          <div className="flex flex-none items-center gap-3 border-b px-5 py-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-medium">{group.name}</h1>
              <button onClick={() => setSideOpen(true)} className="text-xs text-muted-foreground hover:text-primary">{activeMembers.length} חברים</button>
            </div>
          </div>
          <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-2 py-3 md:px-4">
            {!hasMore && <p className="py-6 text-center text-xs text-muted-foreground">תחילת השיחה</p>}
            {visible.map((m, i) => {
              const prev = visible[i - 1];
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const showHeader = newDay || !prev || prev.kind !== "user" || prev.author_id !== m.author_id || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60000 || m.id === firstUnread;
              return (
                <Fragment key={m.id}>
                  {newDay && <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />{formatDay(m.created_at)}<div className="h-px flex-1 bg-border" /></div>}
                  {m.id === firstUnread && <div className="my-3 flex items-center gap-3 text-xs font-medium text-destructive"><div className="h-px flex-1 bg-destructive" />הודעות חדשות<div className="h-px flex-1 bg-destructive" /></div>}
                  <MessageItem
                    msg={m}
                    author={m.author_id ? memberMap.get(m.author_id) : undefined}
                    reactions={reactions.filter((r) => r.message_id === m.id)}
                    userId={userId}
                    isAdmin={isAdmin}
                    showHeader={showHeader}
                    highlighted={highlight === m.id}
                    memberNames={memberNames}
                    myName={myName}
                    nameOf={nameOf}
                    onQuote={setQuote}
                    onJump={jumpTo}
                    onReact={(e) => react(m, e)}
                    onEdit={(b) => edit(m, b)}
                    onDelete={() => remove(m)}
                    onPin={() => pin(m)}
                    onReport={() => setReporting(m)}
                    seen={seenBy(m, members)}
                    {...(m.thread_root_id
                      ? { inThreadLink: () => openThread(m.thread_root_id!, m.id) }
                      : (() => { const t = summaryOf(m.id); return { thread: t, threadAuthors: t.authors.map((a) => memberMap.get(a)).filter((x): x is Member => !!x), onOpenThread: () => openThread(m.id) }; })())}
                  />
                </Fragment>
              );
            })}
          </div>
          <Composer groupId={groupId} members={activeMembers} quote={quote} onClearQuote={() => setQuote(null)} onSend={(b) => send(b)} onUpload={upload} droppedFile={dropped} onDroppedHandled={() => setDropped(null)} />
          {dragging && (
            <div className="pointer-events-none absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-accent/80 text-accent-foreground">
              <Upload className="size-8" /> שחררו כאן כדי להעלות
            </div>
          )}
        </main>

        <aside className="hidden w-[340px] flex-none overflow-hidden rounded-[20px] bg-card xl:block">{panel}</aside>
      </div>

      <Sheet open={sideOpen} onOpenChange={setSideOpen}>
        <SheetContent side="right" className="w-[300px] p-0" dir="rtl"><SheetTitle className="sr-only">הגדרות הקבוצה</SheetTitle>{sidebar}</SheetContent>
      </Sheet>
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="left" className="w-[340px] p-0 xl:hidden" dir="rtl"><SheetTitle className="sr-only">לוח צד</SheetTitle>{panel}</SheetContent>
      </Sheet>

      <Dialog open={!!reporting} onOpenChange={(o) => !o && setReporting(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>דיווח למנהל</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">הכותב לא יידע מי דיווח.</p>
          <Textarea placeholder="סיבה (לא חובה)" value={reportReason} onChange={(e) => setReportReason(e.target.value)} />
          <DialogFooter><Button onClick={submitReport}>שליחת דיווח</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
