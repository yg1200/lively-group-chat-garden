import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { MessageItem } from "./MessageItem";
import { Composer } from "./Composer";
import { seenBy, type Member, type Message, type Quote, type Reaction } from "@/lib/chat";

type Actions = {
  onReact: (m: Message, emoji: string) => void;
  onEdit: (m: Message, body: string) => Promise<boolean>;
  onDelete: (m: Message) => void;
  onPin: (m: Message) => void;
  onReport: (m: Message) => void;
};

type Props = Actions & {
  root: Message;
  replies: Message[];
  focusId: string | null;
  groupId: string;
  userId: string;
  isAdmin: boolean;
  members: Member[];
  memberMap: Map<string, Member>;
  reactions: Reaction[];
  memberNames: string[];
  myName: string;
  nameOf: (id: string) => string;
  onClose: () => void;
  onSend: (body: string, quote: Quote | null) => Promise<boolean>;
  onUpload: (file: File, body: string, signal: { cancelled: boolean }, quote: Quote | null) => Promise<boolean>;
};

export function ThreadPanel(p: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeMembers = p.members.filter((m) => m.status === "active");

  const jump = (id: string) => {
    const el = scrollRef.current?.querySelector(`#t-${CSS.escape(id)}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(id);
    setTimeout(() => setHighlight(null), 2000);
  };

  useEffect(() => {
    if (p.focusId) setTimeout(() => jump(p.focusId!), 80);
    else if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [p.focusId, p.root.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevLen = useRef(p.replies.length);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && p.replies.length > prevLen.current && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
    prevLen.current = p.replies.length;
  }, [p.replies.length]);

  const item = (m: Message) => (
    <div id={`t-${m.id}`} key={m.id}>
      <MessageItem
        msg={m}
        author={m.author_id ? p.memberMap.get(m.author_id) : undefined}
        reactions={p.reactions.filter((r) => r.message_id === m.id)}
        userId={p.userId}
        isAdmin={p.isAdmin}
        showHeader
        highlighted={highlight === m.id}
        memberNames={p.memberNames}
        myName={p.myName}
        nameOf={p.nameOf}
        onQuote={setQuote}
        onJump={jump}
        onReact={(e) => p.onReact(m, e)}
        onEdit={(b) => p.onEdit(m, b)}
        onDelete={() => p.onDelete(m)}
        onPin={() => p.onPin(m)}
        onReport={() => p.onReport(m)}
        seen={seenBy(m, p.members)}
      />
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none items-center justify-between border-b px-4 py-3">
        <b className="font-medium">שרשור</b>
        <button aria-label="סגירת השרשור" onClick={p.onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {item(p.root)}
        <div className="my-2 flex items-center gap-3 px-3 text-xs text-muted-foreground">
          {p.replies.length === 1 ? "תגובה אחת" : `${p.replies.length} תגובות`}<div className="h-px flex-1 bg-border" />
        </div>
        {p.replies.map((m) => item(m))}
      </div>
      <Composer
        groupId={p.groupId}
        draftKey={`gc.draft.thread.${p.root.id}`}
        placeholder="שליחת תשובה"
        small
        members={activeMembers}
        quote={quote}
        onClearQuote={() => setQuote(null)}
        onSend={async (b) => { const ok = await p.onSend(b, quote); if (ok) setQuote(null); return ok; }}
        onUpload={async (f, b, s) => { const ok = await p.onUpload(f, b, s, quote); if (ok) setQuote(null); return ok; }}
        droppedFile={null}
        onDroppedHandled={() => {}}
      />
    </div>
  );
}
