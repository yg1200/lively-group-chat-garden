import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "צ'אט הקבוצה" },
      { name: "description", content: "צ'אט קבוצתי בעברית עם אישור מנהל, ציטוטים, תגובות, הצמדות וחיפוש." },
      { property: "og:title", content: "צ'אט הקבוצה" },
      { property: "og:description", content: "צ'אט קבוצתי בעברית עם אישור מנהל, ציטוטים, תגובות, הצמדות וחיפוש." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/group-chat.html"
      title="צ'אט הקבוצה"
      className="fixed inset-0 h-screen w-screen border-0"
    />
  );
}
