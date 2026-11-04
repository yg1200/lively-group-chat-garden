import { initials, spaceColors, type Profile } from "@/lib/chat";

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

/** Square-ish colored letter tile used for spaces (groups), like Google Chat. */
export function SpaceAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const { bg, ink } = spaceColors(name);
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-[30%] font-bold"
      style={{ width: size, height: size, background: bg, color: ink, fontSize: size * 0.45 }}
    >
      {name.trim().charAt(0)}
    </span>
  );
}
