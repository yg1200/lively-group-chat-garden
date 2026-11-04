import { useEffect, useRef, useState } from "react";
import { FileText, Mic, Plus, Send, Smile, Sticker, Type, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { EmojiPicker } from "./EmojiPicker";
import { MAX_FILE_BYTES, formatSize, isBlockedFile, type Member, type Quote } from "@/lib/chat";

type Props = {
  groupId: string;
  members: Member[];
  quote: Quote | null;
  onClearQuote: () => void;
  onSend: (body: string) => Promise<boolean>;
  onUpload: (file: File, body: string, signal: { cancelled: boolean }) => Promise<boolean>;
  droppedFile: File | null;
  onDroppedHandled: () => void;
  draftKey?: string;
  placeholder?: string;
  /** Compact variant for the thread panel. */
  small?: boolean;
};

type FormatKey = "b" | "i" | "s" | "c" | "l";
const FORMATS: { k: FormatKey; label: string; node: React.ReactNode }[] = [
  { k: "b", label: "מודגש", node: <b>B</b> },
  { k: "i", label: "נטוי", node: <i>I</i> },
  { k: "s", label: "קו חוצה", node: <s>S</s> },
  { k: "c", label: "קוד", node: "</>" },
  { k: "l", label: "רשימה", node: "•" },
];

function readDraft(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function Composer(p: Props) {
  const draftKey = p.draftKey ?? `gc.draft.${p.groupId}`;
  const small = !!p.small;
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<File | null>(null);
  const [uploading, setUploading] = useState<{ signal: { cancelled: boolean } } | null>(null);
  const [mention, setMention] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [fmtOpen, setFmtOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(readDraft(draftKey)); }, [draftKey]);
  useEffect(() => {
    try { localStorage.setItem(draftKey, text); } catch { /* storage unavailable: no draft saving */ }
  }, [text, draftKey]);
  useEffect(() => { if (p.quote) ref.current?.focus(); }, [p.quote]);
  useEffect(() => {
    if (p.droppedFile) { stage(p.droppedFile); p.onDroppedHandled(); }
  }, [p.droppedFile]); // eslint-disable-line react-hooks/exhaustive-deps

  /** One file per message: choosing a file stages it; it is uploaded when the message is sent. */
  const stage = (file: File) => {
    if (isBlockedFile(file.name)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      return void toast.error(`סוג הקובץ ".${ext}" חסום מטעמי אבטחה ולא ניתן להעלות אותו.`);
    }
    if (file.size > MAX_FILE_BYTES) return void toast.error("הקובץ גדול מ-100MB. בחרו קובץ קטן יותר.");
    if (staged) toast("אפשר לשלוח קובץ אחד בכל הודעה. הקובץ הקודם הוחלף.");
    setStaged(file);
  };

  const canSend = !!text.trim() || !!staged;

  const send = async () => {
    if (uploading || !canSend) return;
    const body = text.trim();
    if (staged) {
      const signal = { cancelled: false };
      setUploading({ signal });
      const ok = await p.onUpload(staged, body, signal);
      setUploading(null);
      if (ok) { setText(""); setStaged(null); }
      return;
    }
    setText("");
    if (!(await p.onSend(body))) setText(body);
  };

  const cancelFile = () => {
    if (uploading) uploading.signal.cancelled = true;
    setUploading(null);
    setStaged(null);
  };

  const onChange = (v: string) => {
    setText(v);
    const caret = ref.current?.selectionStart ?? v.length;
    const m = /(^|\s)@([^\s@]*)$/.exec(v.slice(0, caret));
    setMention(m ? m[2] ?? "" : null);
    setMentionIdx(0);
  };

  const suggestions = mention === null ? [] : p.members.filter((m) => m.profile?.display_name.toLowerCase().includes(mention.toLowerCase())).slice(0, 6);

  const pickMention = (name: string) => {
    const caret = ref.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([^\s@]*)$/, `@${name} `);
    setText(before + text.slice(caret));
    setMention(null);
    ref.current?.focus();
  };

  const select = (a: number, b: number) => requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(a, b); });

  const insertText = (s: string) => {
    const a = ref.current?.selectionStart ?? text.length;
    const b = ref.current?.selectionEnd ?? a;
    setText(text.slice(0, a) + s + text.slice(b));
    select(a + s.length, a + s.length);
  };

  const wrap = (k: FormatKey) => {
    const s = ref.current?.selectionStart ?? text.length;
    const e = ref.current?.selectionEnd ?? s;
    if (k === "l") {
      const ls = text.lastIndexOf("\n", s - 1) + 1;
      setText(text.slice(0, ls) + "• " + text.slice(ls));
      select(s + 2, e + 2);
      return;
    }
    const mark = { b: "*", i: "_", s: "~", c: "`" }[k];
    const sel = text.slice(s, e) || "טקסט";
    setText(text.slice(0, s) + mark + sel + mark + text.slice(e));
    select(s + 1, s + 1 + sel.length);
  };

  const iconBtn = cn("flex flex-none items-center justify-center rounded-full text-foreground hover:bg-card/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent", small ? "size-[34px]" : "size-10");
  const roundBtn = small ? "size-11" : "size-14";

  return (
    <div className={cn("relative flex-none", small ? "px-3 pb-3.5 pt-2" : "px-2 pb-2 md:px-5 md:pb-3.5")}>
      {suggestions.length > 0 && (
        <div role="listbox" aria-label="אזכור חבר" className="absolute bottom-full start-4 z-20 mb-2 w-64 overflow-hidden rounded-[14px] border bg-popover p-1.5 shadow-lg">
          {suggestions.map((m, i) => (
            <button
              key={m.user_id}
              role="option"
              aria-selected={i === mentionIdx}
              onMouseDown={(e) => { e.preventDefault(); pickMention(m.profile!.display_name); }}
              className={cn("flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-start text-sm hover:bg-field", i === mentionIdx && "bg-field")}
            >
              <Avatar profile={m.profile} size={28} /> <span className="truncate">{m.profile?.display_name}</span>
            </button>
          ))}
        </div>
      )}
      {p.quote && (
        <div className={cn("mb-1.5 flex items-center gap-2.5 rounded-2xl border-s-[3px] border-primary bg-quote px-3 py-2", !small && "mx-4 mb-0 rounded-b-none")}>
          <div className="min-w-0 flex-1">
            <b className="block text-xs font-medium text-accent-foreground">תגובה ל{p.quote.author}</b>
            <span className="block truncate text-[13px] text-muted-foreground">{p.quote.body}</span>
          </div>
          <button aria-label="ביטול ציטוט" onClick={p.onClearQuote} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-field"><X className="size-4" /></button>
        </div>
      )}
      {staged && (
        <div className="mb-2 flex w-[min(380px,100%)] items-center gap-3 rounded-[14px] border bg-card px-3 py-2">
          <FileText className="size-[22px] flex-none text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium [direction:ltr] text-start">{staged.name}</div>
            {uploading && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-sm bg-border" role="progressbar" aria-label="מעלה את הקובץ">
                <i className="block h-full w-full animate-pulse bg-primary" />
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{uploading ? "מעלה…" : formatSize(staged.size)}</span>
          <button aria-label="ביטול העלאה" onClick={cancelFile} className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-field"><X className="size-4" /></button>
        </div>
      )}
      <div className={cn("flex items-end", small ? "gap-2" : "gap-3")}>
        {!small && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="הוספה" className={cn("flex flex-none items-center justify-center rounded-full bg-accent text-accent-foreground hover:brightness-95", roundBtn)}>
                <Plus className="size-[26px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]" dir="rtl">
              <DropdownMenuItem className="h-10 gap-3" onClick={() => fileRef.current?.click()}><Upload className="size-[18px]" /> העלאת קובץ</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) stage(f); e.target.value = ""; }} />
        <div className={cn("flex min-w-0 flex-1 flex-col bg-field py-1.5 ps-3 pe-3", small ? "rounded-3xl py-0.5" : "rounded-[28px] ps-5")}>
          {fmtOpen && !small && (
            <div className="mb-1 flex gap-0.5 border-b py-1">
              {FORMATS.map((f) => (
                <button key={f.k} aria-label={f.label} title={f.label} onClick={() => wrap(f.k)} className="size-8 rounded-lg text-sm hover:bg-card">{f.node}</button>
              ))}
            </div>
          )}
          <div className={cn("flex items-center gap-0.5", small ? "min-h-10" : "min-h-11")}>
            <textarea
              ref={ref}
              value={text}
              rows={1}
              dir="auto"
              aria-label="כתיבת הודעה"
              placeholder={p.placeholder ?? "ההיסטוריה פועלת"}
              onChange={(e) => onChange(e.target.value)}
              onPaste={(e) => { const f = e.clipboardData.files?.[0]; if (f) { e.preventDefault(); stage(f); } }}
              onKeyDown={(e) => {
                if (suggestions.length) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % suggestions.length); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
                  if ((e.key === "Enter" && !e.nativeEvent.isComposing) || e.key === "Tab") { e.preventDefault(); pickMention(suggestions[mentionIdx]!.profile!.display_name); return; }
                }
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
                if (e.key === "Escape") { setMention(null); p.onClearQuote(); }
              }}
              className="max-h-[140px] min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-snug outline-none placeholder:text-muted-foreground"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            {!small && (
              <button aria-label="אפשרויות עיצוב" aria-pressed={fmtOpen} title="אפשרויות עיצוב" onClick={() => { setFmtOpen((o) => !o); ref.current?.focus(); }} className={cn(iconBtn, fmtOpen && "bg-card")}><Type className="size-[22px]" /></button>
            )}
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <button aria-label="הוספת אמוג'י" title="הוספת אמוג'י" className={iconBtn}><Smile className="size-[22px]" /></button>
              </PopoverTrigger>
              <PopoverContent align="end" side="top" className="w-[min(332px,calc(100vw-16px))] p-3">
                <EmojiPicker onPick={(e) => { insertText(e); setEmojiOpen(false); }} />
              </PopoverContent>
            </Popover>
            {!small && <button disabled aria-label="GIF וסטיקרים (בקרוב)" title="GIF וסטיקרים (בקרוב)" className={iconBtn}><Sticker className="size-[22px]" /></button>}
            <button aria-label="העלאת קובץ" title="העלאת קובץ" onClick={() => fileRef.current?.click()} className={iconBtn}><Upload className="size-[22px]" /></button>
            {!small && <button disabled aria-label="הקלטה קולית (בקרוב)" title="הקלטה קולית (בקרוב)" className={iconBtn}><Mic className="size-[22px]" /></button>}
          </div>
        </div>
        <button
          aria-label="שליחה"
          onClick={send}
          disabled={!canSend || !!uploading}
          className={cn("flex flex-none items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-55", roundBtn)}
        >
          <Send className="size-5 -scale-x-100" />
        </button>
      </div>
    </div>
  );
}
