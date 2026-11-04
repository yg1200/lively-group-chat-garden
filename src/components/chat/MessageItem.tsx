import { useEffect, useState } from "react";
import { Pin, Reply, Pencil, Trash2, Flag, SmilePlus, MessagesSquare, MoreVertical, Eye, Copy, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pushRecent } from "@/lib/emoji";
import { Avatar } from "./Avatar";
import { EmojiPicker } from "./EmojiPicker";
import { deletedLabel, formatMsgTime, formatSize, type Member, type Message, type Quote, type Reaction, type ThreadSummary } from "@/lib/chat";

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

const QUICK_REACTIONS = ["😜", "🤣", "👍"];
const MENTION_CLASS = "rounded-md bg-accent px-1 font-medium text-accent-foreground";

/**
 * Message text → React nodes: @mentions, `code`, *bold*, _italic_, ~strike~ and links.
 * Built from React elements (never raw HTML), so message text can't inject markup.
 */
export function renderBody(body: string, names: string[], _myName?: string): React.ReactNode[] {
  void _myName;
  const nm = names.length ? [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") : "(?!)";
  const suf = "(?=$|[\\s.,!?:;)])";
  const re = new RegExp(
    `@(${nm})|\`([^\`\\n]+)\`|(https?:\\/\\/[^\\s<]+)|(^|[\\s(])\\*([^*\\n]+)\\*${suf}|(^|[\\s(])_([^_\\n]+)_${suf}|(^|[\\s(])~([^~\\n]+)~${suf}`,
    "g",
  );
  let key = 0;
  const walk = (text: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      if (m[1] !== undefined) {
        out.push(text.slice(last, at), <span key={key++} className={MENTION_CLASS}>@{m[1]}</span>);
      } else if (m[2] !== undefined) {
        out.push(text.slice(last, at), <code key={key++} className="rounded bg-field px-1 font-mono text-[13px] [direction:ltr] [unicode-bidi:embed]">{m[2]}</code>);
      } else if (m[3] !== undefined) {
        const href = m[3].replace(/[.,!?:;)]+$/, "");
        out.push(text.slice(last, at), <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{href}</a>, m[3].slice(href.length));
      } else {
        const [pre, inner, Tag]: [string, string, "b" | "i" | "s"] =
          m[5] !== undefined ? [m[4] ?? "", m[5], "b"] : m[7] !== undefined ? [m[6] ?? "", m[7], "i"] : [m[8] ?? "", m[9] ?? "", "s"];
        out.push(text.slice(last, at), pre, <Tag key={key++}>{walk(inner)}</Tag>);
      }
      last = at + m[0].length;
    }
    out.push(text.slice(last));
    return out;
  };
  return walk(body);
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

async function copyText(text: string, done = "הועתק") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("לא ניתן להעתיק כאן");
  }
}

export function MessageItem(p: Props) {
  const { msg } = p;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.body);
  const [tapped, setTapped] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const url = useSignedUrl(msg.attachment_path);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (msg.kind === "system") {
    return (
      <div id={`m-${msg.id}`} className="px-3 py-2 text-center text-xs text-muted-foreground md:px-6">
        {msg.body} · {formatMsgTime(msg.created_at)}
      </div>
    );
  }

  const name = p.author?.profile?.display_name ?? "משתמש";
  const deleted = !!msg.deleted_by;
  const mine = msg.author_id === p.userId;
  const quote = msg.quote as Quote | null;
  const showHeader = p.showHeader && !deleted;

  const grouped = new Map<string, string[]>();
  p.reactions.forEach((r) => grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.user_id]));

  const saveEdit = async () => {
    if (await p.onEdit(draft)) setEditing(false);
  };
  const react = (e: string) => {
    pushRecent(e);
    p.onReact(e);
  };

  const isImage = !!msg.attachment_type?.startsWith("image/");
  const isVideo = !!msg.attachment_type?.startsWith("video/");
  const ext = (msg.attachment_name?.split(".").pop() ?? "").toUpperCase().slice(0, 4);
  const copyName = (
    <button aria-label="העתקת שם הקובץ" title="העתקת שם הקובץ" onClick={() => copyText(msg.attachment_name ?? "", "שם הקובץ הועתק")} className="flex size-7 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-field">
      <Copy className="size-[18px]" />
    </button>
  );

  const toolbarVisible = tapped || pickerOpen || moreOpen;

  return (
    <div
      id={`m-${msg.id}`}
      onClick={(e) => {
        if (!window.matchMedia("(hover: none)").matches) return;
        if ((e.target as HTMLElement).closest("a,button,textarea,video,img,input")) return;
        setTapped((t) => !t);
      }}
      className={cn("group relative flex items-start gap-3 px-3 py-1.5 md:px-6", mine && "flex-row-reverse", p.highlighted && "msg-flash")}
    >
      {!mine && <div className="w-9 flex-none">{showHeader && <Avatar profile={p.author?.profile} size={36} />}</div>}
      <div className={cn("relative min-w-0 max-w-[min(100%,720px)]", mine && "flex flex-col items-end", editing && "w-full flex-1")}>
        {showHeader && (
          <div className={cn("flex flex-wrap items-baseline gap-2", mine && "justify-end")}>
            <b className="text-sm font-medium">{mine ? "אני" : name}</b>
            {p.author?.role === "admin" && <span className="rounded bg-accent px-1.5 text-[11px] text-accent-foreground">מנהל</span>}
            <small className="text-xs text-muted-foreground">{formatMsgTime(msg.created_at)}</small>
            {msg.edited_at && <small className="text-xs text-muted-foreground">· נערכה</small>}
          </div>
        )}
        {p.inThreadLink && (
          <button onClick={p.inThreadLink} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><MessagesSquare className="size-3" /> תגובה בשרשור · פתיחה</button>
        )}
        {quote && !deleted && (
          <button
            onClick={() => p.onJump(quote.id)}
            aria-label="מעבר להודעה המצוטטת"
            className="my-1 block w-full max-w-[520px] rounded-xl border-s-[3px] border-primary bg-quote px-3 py-1.5 text-start"
          >
            <b className="block text-xs font-medium text-accent-foreground">{quote.author}</b>
            <span className="block truncate text-[13px] text-muted-foreground">{quote.body}</span>
          </button>
        )}
        {deleted ? (
          <p className="mt-0.5 text-sm italic text-muted-foreground">{deletedLabel(msg)}</p>
        ) : editing ? (
          <div className="mt-1 flex max-w-[560px] flex-col gap-2 py-1">
            <Textarea
              value={draft}
              autoFocus
              aria-label="עריכת הודעה"
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
              <p
                className={cn(
                  "mt-0.5 inline-block max-w-[min(100%,680px)] whitespace-pre-wrap rounded-[18px] px-4 py-2.5 text-start text-[15px] leading-normal [overflow-wrap:anywhere]",
                  mine ? "bg-accent text-accent-foreground" : "bg-bubble",
                )}
                dir="auto"
              >
                {renderBody(msg.body, p.memberNames, p.myName)}
              </p>
            )}
            {msg.attachment_path && isVideo && url && (
              <video src={url} controls preload="metadata" className="mt-1.5 block max-w-[min(360px,100%)] rounded-2xl bg-black" />
            )}
            {msg.attachment_path && !(isVideo && url) && (
              <div className="mt-1.5 block w-[min(400px,100%)] overflow-hidden rounded-[18px] border bg-bubble text-start">
                {isImage && url && (
                  <button onClick={() => setLightbox(true)} aria-label="פתיחת התמונה בגודל מלא" className="block w-full bg-field p-0">
                    <img src={url} alt={msg.attachment_name ?? ""} className="block max-h-[260px] w-full object-cover" />
                  </button>
                )}
                <div className="flex items-center gap-2.5 px-3 py-2">
                  {isImage ? (
                    <span className="flex size-8 flex-none items-center justify-center rounded-lg text-destructive"><ImageIcon className="size-[22px]" /></span>
                  ) : (
                    <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-accent text-[11px] font-bold text-accent-foreground">{ext || "FILE"}</span>
                  )}
                  {isImage ? (
                    <button onClick={() => setLightbox(true)} className="min-w-0 flex-1 text-start text-primary"><span className="block truncate text-sm font-medium [direction:ltr]">{msg.attachment_name}</span></button>
                  ) : (
                    <a href={url ?? "#"} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-start text-primary">
                      <span className="block truncate text-sm font-medium [direction:ltr]">{msg.attachment_name}</span>
                      <small className="block text-xs text-muted-foreground">{formatSize(msg.attachment_size)}</small>
                    </a>
                  )}
                  {copyName}
                </div>
              </div>
            )}
          </>
        )}
        {grouped.size > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[...grouped].map(([emoji, users]) => {
              const me = users.includes(p.userId);
              return (
                <button
                  key={emoji}
                  title={users.map((u) => (u === p.userId ? "את/ה" : p.nameOf(u))).join(", ")}
                  aria-pressed={me}
                  aria-label={`${emoji}, ${users.length} תגובות${me ? ", כולל שלך" : ""}`}
                  onClick={() => p.onReact(emoji)}
                  className={cn("flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px]", me ? "border-primary bg-accent text-accent-foreground" : "bg-card")}
                >
                  <span>{emoji}</span> <b className="font-medium">{users.length}</b>
                </button>
              );
            })}
          </div>
        )}
        {p.thread && p.thread.count > 0 && p.onOpenThread && (
          <button onClick={p.onOpenThread} className="mt-0.5 flex h-7 items-center gap-2.5 rounded-2xl px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <span className="flex -space-x-1.5 rtl:space-x-reverse">
              {(p.threadAuthors ?? []).map((a) => <span key={a.user_id} className="rounded-full ring-2 ring-card"><Avatar profile={a.profile} size={18} /></span>)}
            </span>
            <b className="font-medium">{p.thread.count === 1 ? "תשובה אחת" : `${p.thread.count} תשובות`}</b>
          </button>
        )}

        {!editing && (deleted ? !!p.onOpenThread : true) && (
          <div className={cn("absolute -top-[30px] end-0 z-10 items-center gap-2", toolbarVisible ? "flex" : "hidden group-focus-within:flex group-hover:flex")}>
            {!deleted && (
              <div className="flex h-9 items-center rounded-full bg-card px-1 shadow-md">
                {QUICK_REACTIONS.map((e) => (
                  <button key={e} aria-label={`תגובה ${e}`} onClick={() => react(e)} className="flex size-8 items-center justify-center rounded-full text-[19px] leading-none hover:bg-field">{e}</button>
                ))}
              </div>
            )}
            <div className="flex h-9 items-center rounded-full bg-card px-1 shadow-md">
              {!deleted && (
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <IconAction label="הוספת תגובת אמוג'י"><SmilePlus /></IconAction>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[min(332px,calc(100vw-16px))] p-3">
                    <EmojiPicker onPick={(e) => { p.onReact(e); setPickerOpen(false); }} />
                  </PopoverContent>
                </Popover>
              )}
              {p.onOpenThread && <IconAction label="תגובה בשרשור" onClick={p.onOpenThread}><MessagesSquare /></IconAction>}
              {!deleted && <IconAction label="ציטוט והשבה" onClick={() => p.onQuote({ id: msg.id, author: name, body: msg.body || msg.attachment_name || "" })}><Reply /></IconAction>}
              {!deleted && (
                <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
                  <DropdownMenuTrigger asChild>
                    <IconAction label="עוד פעולות"><MoreVertical /></IconAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[220px]" dir="rtl">
                    {p.seen.length > 0 && (
                      <>
                        <DropdownMenuLabel className="flex items-center gap-3 text-[13px] font-normal text-muted-foreground"><Eye className="size-[18px]" /> נקראה על ידי {p.seen.length}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {mine && msg.body && <DropdownMenuItem className="h-10 gap-3" onClick={() => { setDraft(msg.body); setEditing(true); }}><Pencil className="size-[18px]" /> עריכה</DropdownMenuItem>}
                    {p.isAdmin && !msg.thread_root_id && <DropdownMenuItem className="h-10 gap-3" onClick={p.onPin}><Pin className="size-[18px]" /> {msg.pinned_at ? "הסרת הצמדה" : "הצמדת ההודעה"}</DropdownMenuItem>}
                    <DropdownMenuItem className="h-10 gap-3" onClick={() => copyText(msg.body || msg.attachment_name || "")}><Copy className="size-[18px]" /> העתקת טקסט</DropdownMenuItem>
                    {!mine && <DropdownMenuItem className="h-10 gap-3" onClick={p.onReport}><Flag className="size-[18px]" /> דיווח למנהלים</DropdownMenuItem>}
                    {(mine || p.isAdmin) && <DropdownMenuItem className="h-10 gap-3 text-destructive focus:text-destructive" onClick={p.onDelete}><Trash2 className="size-[18px]" /> מחיקה</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}
      </div>

      {lightbox && url && (
        <div role="dialog" aria-modal="true" aria-label={msg.attachment_name ?? "תמונה"} onClick={() => setLightbox(false)} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-6">
          <img src={url} alt={msg.attachment_name ?? ""} className="max-h-full max-w-full rounded-lg" />
          <button aria-label="סגירה" onClick={() => setLightbox(false)} className="absolute end-4 top-4 rounded-full bg-black/50 p-2 text-white"><X className="size-5" /></button>
        </div>
      )}
    </div>
  );
}

function IconAction({ label, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-field [&_svg]:size-5"
    >
      {children}
    </button>
  );
}
