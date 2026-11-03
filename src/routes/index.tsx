import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { MessageSquare, LogOut, Clock, Ban, UserX, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChatApp } from "@/components/chat/ChatApp";
import { ACTIVE_GROUP_KEY, INVITE_KEY, errorText, type Group } from "@/lib/chat";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "צ'אט הקבוצה" },
      { name: "description", content: "צ'אט קבוצתי בעברית: כניסה עם Google, אישור מנהל, קבצים, ציטוטים, תגובות והצמדות." },
      { property: "og:title", content: "צ'אט הקבוצה" },
      { property: "og:description", content: "צ'אט קבוצתי בעברית: כניסה עם Google, אישור מנהל, קבצים, ציטוטים, תגובות והצמדות." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type MyMembership = { group_id: string; status: string; role: string; group: Group | null };

function Index() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [memberships, setMemberships] = useState<MyMembership[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    const token = localStorage.getItem(INVITE_KEY);
    if (token) {
      localStorage.removeItem(INVITE_KEY);
      const { data, error } = await supabase.rpc("request_join", { _token: token });
      if (error) toast.error(errorText(error));
      else if (data) localStorage.setItem(ACTIVE_GROUP_KEY, data);
    }
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from("group_members")
      .select("group_id, status, role, group:groups(*)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as MyMembership[];
    setMemberships(list);
    const saved = localStorage.getItem(ACTIVE_GROUP_KEY);
    const pick = list.find((m) => m.group_id === saved) ?? list.find((m) => m.status === "active") ?? list[0];
    setActiveId(pick?.group_id ?? null);
  }, []);

  useEffect(() => {
    if (session) load();
    else setMemberships(null);
  }, [session?.user.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session === undefined) return <Centered>טוען…</Centered>;
  if (!session) return <Landing />;
  if (!memberships) return <Centered>טוען…</Centered>;

  const active = memberships.find((m) => m.group_id === activeId);
  const switchGroup = (id: string) => {
    localStorage.setItem(ACTIVE_GROUP_KEY, id);
    setActiveId(id);
  };

  if (!active) return <NoGroup onCreated={(id) => { localStorage.setItem(ACTIVE_GROUP_KEY, id); load(); }} />;

  const others = memberships.filter((m) => m.group_id !== active.group_id);
  if (active.status === "pending")
    return <StateScreen icon={<Clock />} title="הבקשה שלך ממתינה לאישור המנהל" text={`ביקשת להצטרף לקבוצה "${active.group?.name ?? ""}". ברגע שהמנהל יאשר, הצ'אט ייפתח כאן.`} others={others} onSwitch={switchGroup} onRefresh={load} />;
  if (active.status === "rejected")
    return <StateScreen icon={<Ban />} title="הבקשה שלך לא אושרה" text="אין לך גישה לקבוצה הזו." others={others} onSwitch={switchGroup} />;
  if (active.status === "removed")
    return <StateScreen icon={<UserX />} title="הוסרת מהקבוצה על ידי המנהל" text="אין לך יותר גישה לתוכן הקבוצה." others={others} onSwitch={switchGroup} />;
  if (active.status === "left")
    return <StateScreen icon={<LogOut />} title="עזבת את הקבוצה" text="כדי לחזור צריך קישור הזמנה חדש ואישור מנהל." others={others} onSwitch={switchGroup} />;

  return (
    <ChatApp
      key={active.group_id}
      groupId={active.group_id}
      userId={session.user.id}
      groups={memberships.filter((m) => m.status === "active").map((m) => m.group!).filter(Boolean)}
      onSwitchGroup={switchGroup}
      onMembershipChanged={load}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-muted-foreground">{children}</div>;
}

async function signIn() {
  const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
  if (r.error) toast.error("ההתחברות נכשלה, נסו שוב");
}

async function signOut() {
  await supabase.auth.signOut();
}

function Logo() {
  return (
    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
      <MessageSquare className="size-6" />
    </div>
  );
}

function Landing() {
  const hasInvite = typeof window !== "undefined" && !!localStorage.getItem(INVITE_KEY);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-card p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 w-fit"><Logo /></div>
        <h1 className="text-3xl font-bold">צ'אט הקבוצה</h1>
        <p className="mt-3 text-muted-foreground">
          {hasInvite ? "הוזמנת לקבוצה. התחברו כדי לשלוח בקשת הצטרפות למנהל." : "שיחה אחת לכל הקבוצה, עם אישור מנהל לכל מצטרף."}
        </p>
        <Button size="lg" className="mt-8 h-12 w-full rounded-full text-base" onClick={signIn}>
          התחברות עם Google
        </Button>
      </div>
    </main>
  );
}

function NoGroup({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_group", { _name: name, _description: desc });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    onCreated(data);
  };
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <Logo />
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4" /> יציאה</Button>
        </div>
        <h1 className="text-2xl font-bold">עוד אין לך קבוצה</h1>
        <p className="mt-2 text-muted-foreground">כדי להצטרף לקבוצה קיימת צריך קישור הזמנה מאחד החברים. אפשר גם לפתוח קבוצה חדשה ולהיות המנהל שלה.</p>
        <div className="mt-6 space-y-3">
          <Input placeholder="שם הקבוצה" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="תיאור (לא חובה)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button className="w-full rounded-full" disabled={!name.trim() || busy} onClick={create}>
            <Plus className="size-4" /> יצירת קבוצה חדשה
          </Button>
        </div>
      </div>
    </main>
  );
}

function StateScreen({ icon, title, text, others, onSwitch, onRefresh }: {
  icon: React.ReactNode; title: string; text: string; others: MyMembership[]; onSwitch: (id: string) => void; onRefresh?: () => void;
}) {
  const switchable = others.filter((o) => o.status === "active");
  useEffect(() => {
    if (!onRefresh) return;
    const t = setInterval(onRefresh, 15000);
    return () => clearInterval(t);
  }, [onRefresh]);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-card p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-7">{icon}</div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-muted-foreground">{text}</p>
        {switchable.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">הקבוצות שלך:</p>
            {switchable.map((o) => (
              <Button key={o.group_id} variant="outline" className="w-full rounded-full" onClick={() => onSwitch(o.group_id)}>{o.group?.name}</Button>
            ))}
          </div>
        )}
        <Button variant="ghost" className="mt-6" onClick={signOut}><LogOut className="size-4" /> יציאה</Button>
      </div>
    </main>
  );
}
