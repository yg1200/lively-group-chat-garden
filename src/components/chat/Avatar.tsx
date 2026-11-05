import { initials, type Profile } from "@/lib/chat";

export function Avatar({ profile, size = 32 }: { profile: Pick<Profile, "display_name" | "avatar_url"> | null | undefined; size?: number }) {
  const name = profile?.display_name ?? "";
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={name}
        referrerPolicy="no-referrer"
        className="flex-none rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-accent font-medium text-accent-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}
