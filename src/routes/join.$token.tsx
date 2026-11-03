import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { INVITE_KEY } from "@/lib/chat";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "הזמנה לקבוצה · צ'אט הקבוצה" },
      { name: "description", content: "הוזמנת להצטרף לקבוצה. התחברו עם Google ושלחו בקשת הצטרפות למנהל." },
      { property: "og:title", content: "הזמנה לקבוצה · צ'אט הקבוצה" },
      { property: "og:description", content: "הוזמנת להצטרף לקבוצה. התחברו עם Google ושלחו בקשת הצטרפות למנהל." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    localStorage.setItem(INVITE_KEY, token);
    navigate({ to: "/", replace: true });
  }, [token, navigate]);
  return <div className="flex min-h-screen items-center justify-center text-muted-foreground">טוען הזמנה…</div>;
}
