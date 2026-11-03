import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "./Avatar";
import { MAX_FILE_BYTES, isBlockedFile, type Member, type Quote } from "@/lib/chat";

type Props = {
  groupId: string;
  members: Member[];
  quote: Quote | null;
  onClearQuote: () => void;
  onSend: (body: string) => Promise<boolean>;
  onUpload: (file: File, body: string, signal: { cancelled: boolean }) => Promise<boolean>;
  droppedFile: File | null;
  onDroppedHandled: () => void;
};

export function Composer(p: Props) {
  const draftKey = `gc.draft.${p.groupId}`;
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState<{ name: string; signal: { cancelled: boolean } } | null>(null);
  const [mention, setMention] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(localStorage.getItem(draftKey) ?? ""); }, [draftKey]);
  useEffect(() => { localStorage.setItem(draftKey, text); }, [text, draftKey]);
  useEffect(() => { if (p.quote) ref.current?.focus(); }, [p.quote]);
  useEffect(() => {
    if (p.droppedFile) { upload(p.droppedFile); p.onDroppedHandled(); }
  }, [p.droppedFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (file: File) => {
    if (isBlockedFile(file.name)) return toast.error("סוג הקובץ הזה חסום");
    if (file.size > MAX_FILE_BYTES) return toast.error("הקובץ גדול מ-100MB");
    const signal = { cancelled: false };
    setUploading({ name: file.name, signal });
    const ok = await p.onUpload(file, text.trim(), signal);
    setUploading(null);
    if (ok) setText("");
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    if (!(await p.onSend(body))) setText(body);
  };

  const onChange = (v: string) => {
    setText(v);
    const caret = ref.current?.selectionStart ?? v.length;
    const m = /(^|\s)@([^\s@]*)$/.exec(v.slice(0, caret));
    setMention(m ? m[2] : null);
  };

  const suggestions = mention === null ? [] : p.members.filter((m) => m.profile?.display_name.toLowerCase().includes(mention.toLowerCase())).slice(0, 6);

  const pickMention = (name: string) => {
    const caret = ref.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([^\s@]*)$/, `@${name} `);
    setText(before + text.slice(caret));
    setMention(null);
    ref.current?.focus();
  };

  return (
    <div className="relative flex-none px-4 pb-4">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full start-4 mb-2 w-64 overflow-hidden rounded-xl border bg-popover shadow-lg">
          {suggestions.map((m) => (
            <button key={m.user_id} onMouseDown={(e) => { e.preventDefault(); pickMention(m.profile!.display_name); }} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted">
              <Avatar profile={m.profile} size={24} /> {m.profile?.display_name}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-3xl bg-secondary px-2 py-1.5">
        {p.quote && (
          <div className="m-1 flex items-start gap-2 rounded-xl border-s-4 border-primary bg-card px-3 py-1.5 text-sm">
            <div className="min-w-0 flex-1">
              <b className="block text-xs text-primary">מצטט את {p.quote.author}</b>
              <span className="line-clamp-1 text-muted-foreground">{p.quote.body}</span>
            </div>
            <button aria-label="ביטול ציטוט" onClick={p.onClearQuote} className="text-muted-foreground"><X className="size-4" /></button>
          </div>
        )}
        {uploading && (
          <div className="m-1 flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span className="min-w-0 flex-1 truncate">מעלה את {uploading.name}…</span>
            <button className="text-xs text-destructive" onClick={() => { uploading.signal.cancelled = true; setUploading(null); }}>ביטול</button>
          </div>
        )}
        <div className="flex items-end gap-1">
          <button aria-label="צירוף קובץ" onClick={() => fileRef.current?.click()} className="flex size-10 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-card">
            <Paperclip className="size-5" />
          </button>
          <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <textarea
            ref={ref}
            value={text}
            rows={1}
            dir="auto"
            placeholder="כתבו הודעה… (@ לאזכור)"
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => { const f = e.clipboardData.files?.[0]; if (f) { e.preventDefault(); upload(f); } }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (suggestions.length) pickMention(suggestions[0].profile!.display_name);
                else send();
              }
              if (e.key === "Escape") { setMention(null); p.onClearQuote(); }
            }}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button aria-label="שליחה" onClick={send} disabled={!text.trim()} className="flex size-10 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
            <Send className="size-5 -scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}
