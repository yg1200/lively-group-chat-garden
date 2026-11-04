import { useEffect, useState } from "react";
import { Pin, Reply, Pencil, Trash2, Flag, SmilePlus, FileText, Download, MessagesSquare, MoreVertical, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { QUICK_EMOJI, deletedLabel, formatSize, formatTime, type Member, type Message, type Quote, type Reaction, type ThreadSummary } from "@/lib/chat";

const urlCache = new Map<string, string>();

function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(path ? urlCache.get(path) ?? null : null);
  useEffect(() => {
    if (!path || urlCache.has(path)) return;
    supabase.storage.from("attachments").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) {
        urlCache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      }
    });
  }, [path]);
  return url;
}

export function renderBody(body: string, names: string[], myName: string) {
  if (!names.length) return body;
  const sorted = [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(${sorted.join("|")})`, "g");
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    parts.push(body.slice(last, m.index));
    parts.push(
      <span key={m.index} className={cn("rounded px-0.5 font-medium text-primary", m[1] === myName && "bg-mark")}>@{m[1]}</span>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(body.slice(last));
  return parts;
}

type Props = {
  msg: Message;
  author: Member | undefined;
  reactions: Reaction[];
  userId: string;
  isAdmin: boolean;
  showHeader: boolean;
  highlighted: boolean;
  memberNames: string[];
  myName: string;
  nameOf: (id: string) => string;
  onQuote: (q: Quote) => void;
  onJump: (id: string) => void;
  onReact: (emoji: string) => void;
  onEdit: (body: string) => Promise<boolean>;
  onDelete: () => void;
  onPin: () => void;
  onReport: () => void;
  seen: Member[];
  thread?: ThreadSummary;
  threadAuthors?: Member[];
  onOpenThread?: () => void;
  inThreadLink?: () => void;
};

export function MessageItem(p: Props) {
  const { msg } = p;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.body);
  const url = useSignedUrl(msg.attachment_path);

  if (msg.kind === "system") {
    return (
      <div id={`m-${msg.id}`} className="my-3 text-center text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-3 py-1">{msg.body} · {formatTime(msg.created_at)}</span>
      </div>
    );
  }

  const name = p.author?.profile?.display_name ?? "משתמש";
  const deleted = !!msg.deleted_by;
  const mine = msg.author_id === p.userId;
  const quote = msg.quote as Quote | null;

  const grouped = new Map<string, string[]>();
  p.reactions.forEach((r) => grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.user_id]));

  const saveEdit = async () => {
    if (await p.onEdit(draft)) setEditing(false);
  };

  return (
    <div
      id={`m-${msg.id}`}
      className={cn("group relative flex gap-3 rounded-xl px-3 py-1 transition-colors hover:bg-muted", p.showHeader && "mt-3", p.highlighted && "bg-mark hover:bg-mark")}
    >
      <div className="w-9 flex-none">{p.showHeader && <Avatar profile={p.author?.profile} size={36} />}</div>
      <div className="min-w-0 flex-1">
        {p.showHeader && (
          <div className="flex items-baseline gap-2">
            <b className="text-sm font-medium">{name}</b>
            {p.author?.role === "admin" && <span className="rounded bg-accent px-1.5 text-[11px] text-accent-foreground">מנהל</span>}
            <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
          </div>
        )}
        {p.inThreadLink && (
          <button onClick={p.inThreadLink} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><MessagesSquare className="size-3" /> תגובה בשרשור · פתיחה</button>
        )}
        {msg.pinned_at && !deleted && (
          <div className="flex items-center gap-1 text-xs text-primary"><Pin className="size-3" /> הודעה נעוצה</div>
        )}
        {quote && (
          <button
            onClick={() => p.onJump(quote.id)}
            className="my-1 block w-full max-w-md rounded-lg border-s-4 border-primary bg-quote px-3 py-1.5 text-start text-sm"
          >
            <b className="block text-xs font-medium text-primary">{quote.author}</b>
            <span className="line-clamp-2 text-muted-foreground">{quote.body}</span>
          </button>
        )}
        {deleted ? (
          <p className="text-sm italic text-muted-foreground">{deletedLabel(msg)}</p>
        ) : editing ? (
          <div className="space-y-2 py-1">
            <Textarea
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" className="rounded-full" onClick={saveEdit}>שמירה</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>ביטול</Button>
            </div>
          </div>
        ) : (
          <>
            {msg.body && (
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed" dir="auto">
                {renderBody(msg.body, p.memberNames, p.myName)}
                {msg.edited_at && <span className="ms-1 text-xs text-muted-foreground">(נערך)</span>}
              </p>
            )}
            {msg.attachment_path && (
              <div className="mt-1">
                {msg.attachment_type?.startsWith("image/") && url ? (
                  <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={msg.attachment_name ?? ""} className="max-h-72 rounded-xl border" /></a>
                ) : msg.attachment_type?.startsWith("video/") && url ? (
                  <video src={url} controls className="max-h-72 rounded-xl border" />
                ) : (
                  <a href={url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex max-w-sm items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm hover:bg-muted">
                    <FileText className="size-5 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{msg.attachment_name}</span>
                    <span className="text-xs text-muted-foreground">{formatSize(msg.attachment_size)}</span>
                    <Download className="size-4 text-muted-foreground" />
                  </a>
                )}
              </div>
            )}
          </>
        )}
        {grouped.size > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {[...grouped].map(([emoji, users]) => (
              <button
                key={emoji}
                title={users.map(p.nameOf).join(", ")}
                onClick={() => p.onReact(emoji)}
                className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm", users.includes(p.userId) ? "border-primary bg-accent text-accent-foreground" : "bg-card")}
              >
                {emoji} <span className="text-xs">{users.length}</span>
              </button>
            ))}
          </div>
        )}
        {p.thread && p.thread.count > 0 && p.onOpenThread && (
          <button onClick={p.onOpenThread} className="mt-1 flex items-center gap-2 rounded-lg px-1 py-0.5 text-sm font-medium text-primary hover:bg-accent">
            <span className="flex -space-x-1.5 rtl:space-x-reverse">
              {(p.threadAuthors ?? []).map((a) => <span key={a.user_id} className="rounded-full ring-2 ring-card"><Avatar profile={a.profile} size={20} /></span>)}
            </span>
            {p.thread.count === 1 ? "תגובה אחת" : `${p.thread.count} תגובות`}
          </button>
        )}
      </div>

      {!editing && (deleted ? !!p.onOpenThread : true) && (
        <div className="absolute -top-3 end-3 hidden items-center gap-0.5 rounded-full border bg-card p-0.5 shadow-sm group-hover:flex group-focus-within:flex">
          {!deleted && <Popover>
            <PopoverTrigger asChild>
              <IconAction label="תגובה באימוג'י"><SmilePlus /></IconAction>
            </PopoverTrigger>
            <PopoverContent className="flex w-auto gap-1 p-1">
              {QUICK_EMOJI.map((e) => (
                <button key={e} className="rounded-md p-1 text-xl hover:bg-muted" onClick={() => p.onReact(e)}>{e}</button>
              ))}
            </PopoverContent>
          </Popover>}
          {p.onOpenThread && <IconAction label="תגובה בשרשור" onClick={p.onOpenThread}><MessagesSquare /></IconAction>}
          {!deleted && <IconAction label="ציטוט" onClick={() => p.onQuote({ id: msg.id, author: name, body: msg.body || msg.attachment_name || "" })}><Reply /></IconAction>}
          {!deleted && mine && msg.body && <IconAction label="עריכה" onClick={() => { setDraft(msg.body); setEditing(true); }}><Pencil /></IconAction>}
          {!deleted && p.isAdmin && !msg.thread_root_id && <IconAction label={msg.pinned_at ? "ביטול הצמדה" : "הצמדה"} onClick={p.onPin}><Pin /></IconAction>}
          {!deleted && !mine && <IconAction label="דיווח למנהל" onClick={p.onReport}><Flag /></IconAction>}
          {!deleted && (mine || p.isAdmin) && <IconAction label="מחיקה" onClick={p.onDelete} danger><Trash2 /></IconAction>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconAction label="עוד"><MoreVertical /></IconAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto" dir="rtl">
              <DropdownMenuLabel className="flex items-center gap-2"><Eye className="size-4" /> נצפתה על ידי {p.seen.length}</DropdownMenuLabel>
              {p.seen.length > 0 && <DropdownMenuSeparator />}
              {p.seen.map((m) => (
                <DropdownMenuItem key={m.user_id} className="gap-2" onSelect={(e) => e.preventDefault()}>
                  <Avatar profile={m.profile} size={20} /> <span className="truncate">{m.profile?.display_name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function IconAction({ label, children, danger, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={cn("flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted [&_svg]:size-4", danger && "hover:text-destructive")}
    >
      {children}
    </button>
  );
}
