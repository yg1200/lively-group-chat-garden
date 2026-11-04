import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES, SKIN_TONES, getRecents, getTone, pushRecent, searchEmoji, setTone as saveTone, withTone } from "@/lib/emoji";

/** Full emoji picker: search, category tabs, recents and skin tone. */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("recent");
  const [tone, setToneState] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    setRecents(getRecents());
    setToneState(getTone());
  }, []);

  const category = EMOJI_CATEGORIES.find((c) => c.id === tab) ?? EMOJI_CATEGORIES[0]!;
  const items = q.trim()
    ? searchEmoji(q, tone)
    : tab === "recent"
      ? recents
      : (category.items ?? []).map(([e, , skin]) => withTone(e, skin ? tone : 0));

  const pick = (e: string) => {
    pushRecent(e);
    onPick(e);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <input
        type="search"
        autoFocus
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="חיפוש אמוג'י"
        aria-label="חיפוש אמוג'י"
        className="h-9 rounded-full bg-field px-3.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div role="tablist" className="flex gap-0.5 border-b pb-1">
        {EMOJI_CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-label={c.name}
            aria-pressed={!q && tab === c.id}
            onClick={() => { setQ(""); setTab(c.id); }}
            className={cn("h-[34px] flex-1 rounded-lg text-lg", !q && tab === c.id && "bg-accent")}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="text-xs font-medium text-muted-foreground">{q.trim() ? "תוצאות" : category.name}</div>
      <div className="grid max-h-[168px] grid-cols-8 gap-0.5 overflow-y-auto">
        {items.length ? (
          items.map((e) => (
            <button key={e} aria-label={e} onClick={() => pick(e)} className="h-9 rounded-lg text-[22px] leading-none hover:bg-field">{e}</button>
          ))
        ) : (
          <div className="col-span-full p-4 text-center text-sm text-muted-foreground">לא נמצאו אמוג'ים</div>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        גוון עור:
        {SKIN_TONES.map((c, i) => (
          <button
            key={c}
            aria-label={`גוון ${i + 1}`}
            aria-pressed={tone === i}
            onClick={() => { setToneState(i); saveTone(i); }}
            className={cn("size-5 rounded-full border-2 border-transparent p-0", tone === i && "border-primary")}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
