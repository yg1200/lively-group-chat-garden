/** Emoji data + small persistence helpers for the picker (no external library). */

export type EmojiItem = [emoji: string, keywords: string, skinTone?: 1];
export type EmojiCategory = { id: string; icon: string; name: string; items?: EmojiItem[] };

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: "recent", icon: "🕘", name: "נפוצים לאחרונה" },
  { id: "smile", icon: "😀", name: "פרצופים", items: [["😀", "חיוך שמח smile"], ["😃", "חיוך"], ["😄", "צוחק"], ["😁", "מחייך"], ["😆", "צוחק בקול"], ["😅", "זיעה הקלה"], ["😂", "דמעות צחוק laugh"], ["🙂", "חיוך קל"], ["😉", "קריצה wink"], ["😊", "מאושר"], ["😍", "אוהב love"], ["🥰", "אהבה"], ["😘", "נשיקה kiss"], ["😎", "מגניב cool"], ["🤩", "מתרגש wow"], ["🥳", "חגיגה party"], ["😢", "עצוב sad"], ["😭", "בוכה cry"], ["😮", "מופתע"], ["😡", "כועס angry"], ["🤔", "חושב think"], ["🙄", "גלגול עיניים"], ["😴", "ישן sleep"], ["🤗", "חיבוק hug"]] },
  { id: "hand", icon: "👍", name: "ידיים", items: [["👍", "אגודל למעלה כן like", 1], ["👎", "אגודל למטה לא", 1], ["👏", "מחיאות כפיים clap", 1], ["🙌", "ידיים למעלה הידד", 1], ["👋", "שלום מנופף wave", 1], ["🙏", "תודה בבקשה pray", 1], ["💪", "חזק שריר", 1], ["👌", "בסדר ok", 1], ["✋", "עצור יד", 1], ["🤙", "התקשרו", 1]] },
  { id: "heart", icon: "❤️", name: "לבבות וסמלים", items: [["❤️", "לב אהבה heart"], ["🧡", "לב כתום"], ["💛", "לב צהוב"], ["💚", "לב ירוק"], ["💙", "לב כחול"], ["💜", "לב סגול"], ["🔥", "אש fire"], ["✨", "נצנוץ"], ["🎉", "חגיגה מזל טוב"], ["💯", "מאה"], ["✅", "בוצע וי"], ["❌", "לא"], ["⭐", "כוכב"], ["⚡", "ברק"]] },
  { id: "food", icon: "🍕", name: "אוכל וחיות", items: [["🍕", "פיצה"], ["🍔", "המבורגר"], ["🍎", "תפוח"], ["☕", "קפה coffee"], ["🍰", "עוגה"], ["🍫", "שוקולד"], ["🐶", "כלב"], ["🐱", "חתול"], ["🦊", "שועל"], ["🐼", "פנדה"]] },
  { id: "obj", icon: "💡", name: "חפצים", items: [["💡", "רעיון"], ["📎", "סיכה קובץ"], ["📌", "נעץ"], ["🔔", "פעמון"], ["🎯", "מטרה"], ["🚀", "טיל השקה"], ["📈", "גרף עלייה"], ["💻", "מחשב"], ["📅", "יומן"], ["🕘", "שעה"]] },
];

/** Skin tone swatches (index 0 = default yellow). */
export const SKIN_TONES = ["#FFCC33", "#F7D7C4", "#E8B992", "#C98F5E", "#9A6338", "#5C3A22"];

export function withTone(emoji: string, tone: number) {
  return tone > 0 ? emoji + String.fromCodePoint(0x1f3fa + tone) : emoji;
}

export function searchEmoji(query: string, tone: number): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: string[] = [];
  for (const c of EMOJI_CATEGORIES) {
    for (const [e, kw, skin] of c.items ?? []) if (kw.toLowerCase().includes(q)) out.push(withTone(e, skin ? tone : 0));
  }
  return out;
}

const RECENT_KEY = "gc.recentEmoji";
const TONE_KEY = "gc.emojiTone";
const DEFAULT_RECENTS = ["👍", "🙏", "❤️", "😂", "🎉"];

export function getRecents(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "null");
    if (Array.isArray(v) && v.length) return v.filter((x): x is string => typeof x === "string").slice(0, 16);
  } catch {
    /* fall through */
  }
  return DEFAULT_RECENTS;
}

export function pushRecent(emoji: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...getRecents().filter((x) => x !== emoji)].slice(0, 16)));
  } catch {
    /* storage unavailable: recents just won't persist */
  }
}

export function getTone(): number {
  try {
    const n = Number(localStorage.getItem(TONE_KEY));
    return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 0;
  } catch {
    return 0;
  }
}

export function setTone(n: number) {
  try {
    localStorage.setItem(TONE_KEY, String(n));
  } catch {
    /* ignore */
  }
}
