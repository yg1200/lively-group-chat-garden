
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text,
  avatar_url text,
  last_seen_at timestamptz default now(),
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create or replace function public.handle_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'))
  on conflict (id) do update set display_name = excluded.display_name, email = excluded.email, avatar_url = excluded.avatar_url;
  return new;
end $$;
create trigger on_auth_user_profile after insert or update of raw_user_meta_data, email on auth.users
for each row execute function public.handle_user_profile();

-- GROUPS
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.groups to authenticated;
grant all on public.groups to service_role;
alter table public.groups enable row level security;

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'pending' check (status in ('pending','active','rejected','removed','left')),
  invited_by uuid references public.profiles(id) on delete set null,
  last_read_at timestamptz default now(),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (group_id, user_id)
);
grant select on public.group_members to authenticated;
grant all on public.group_members to service_role;
alter table public.group_members enable row level security;

create or replace function public.is_active_member(_g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from group_members where group_id=_g and user_id=auth.uid() and status='active') $$;
create or replace function public.is_group_admin(_g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from group_members where group_id=_g and user_id=auth.uid() and status='active' and role='admin') $$;
create or replace function public.has_any_membership(_g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from group_members where group_id=_g and user_id=auth.uid()) $$;
create or replace function public.shares_group(_u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select _u = auth.uid() or exists(
    select 1 from group_members me join group_members o on o.group_id=me.group_id
    where me.user_id=auth.uid() and me.status='active' and o.user_id=_u) $$;

create policy "profiles visible to group mates" on public.profiles for select to authenticated using (public.shares_group(id));
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "groups visible to members" on public.groups for select to authenticated using (public.has_any_membership(id));
create policy "see own membership" on public.group_members for select to authenticated using (user_id = auth.uid() or public.is_active_member(group_id));

-- INVITES
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(12),'hex'),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.invites to authenticated;
grant all on public.invites to service_role;
alter table public.invites enable row level security;
create policy "members read invites" on public.invites for select to authenticated using (public.is_active_member(group_id));
create policy "members create invites" on public.invites for insert to authenticated with check (public.is_active_member(group_id) and created_by = auth.uid());

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'user' check (kind in ('user','system')),
  body text not null default '',
  quote jsonb,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint,
  edited_at timestamptz,
  deleted_by text check (deleted_by in ('author','admin')),
  pinned_at timestamptz,
  pinned_by uuid,
  created_at timestamptz not null default now()
);
create index on public.messages (group_id, created_at desc);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "members read messages" on public.messages for select to authenticated using (public.is_active_member(group_id));
create policy "members send messages" on public.messages for insert to authenticated
  with check (public.is_active_member(group_id) and author_id = auth.uid() and kind = 'user' and deleted_by is null and pinned_at is null and edited_at is null);

-- REACTIONS
create table public.reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
grant select, insert, delete on public.reactions to authenticated;
grant all on public.reactions to service_role;
alter table public.reactions enable row level security;
create policy "members read reactions" on public.reactions for select to authenticated using (public.is_active_member(group_id));
create policy "members react" on public.reactions for insert to authenticated with check (
  user_id = auth.uid() and public.is_active_member(group_id)
  and exists(select 1 from public.messages m where m.id = message_id and m.group_id = reactions.group_id and m.kind='user'));
create policy "remove own reaction" on public.reactions for delete to authenticated using (user_id = auth.uid());

-- REPORTS
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  reporter_id uuid not null,
  reason text not null default '',
  status text not null default 'open' check (status in ('open','resolved_deleted','resolved_removed','dismissed')),
  resolved_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "members report" on public.reports for insert to authenticated with check (
  reporter_id = auth.uid() and public.is_active_member(group_id)
  and exists(select 1 from public.messages m where m.id = message_id and m.group_id = reports.group_id));
create policy "admins read reports" on public.reports for select to authenticated using (public.is_group_admin(group_id));

-- AUDIT LOG
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid,
  action text not null,
  subject_user_id uuid,
  subject_message_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admins read audit" on public.audit_log for select to authenticated using (public.is_group_admin(group_id));

-- HELPERS
create or replace function public._name(_u uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from profiles where id=_u), '') $$;
create or replace function public._sys(_g uuid, _body text) returns void language sql security definer set search_path = public as $$
  insert into messages(group_id, kind, body) values (_g, 'system', _body) $$;
create or replace function public._audit(_g uuid, _action text, _subj uuid, _msg uuid, _meta jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into audit_log(group_id, actor_id, action, subject_user_id, subject_message_id, metadata) values (_g, auth.uid(), _action, _subj, _msg, _meta) $$;
revoke execute on function public._sys(uuid,text) from public, anon, authenticated;
revoke execute on function public._audit(uuid,text,uuid,uuid,jsonb) from public, anon, authenticated;

-- RPCs
create or replace function public.create_group(_name text, _description text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(trim(_name),'') = '' then raise exception 'name required'; end if;
  insert into groups(name, description, created_by) values (trim(_name), coalesce(_description,''), auth.uid()) returning id into g;
  insert into group_members(group_id, user_id, role, status, decided_at) values (g, auth.uid(), 'admin', 'active', now());
  perform _sys(g, _name(auth.uid()) || ' יצר/ה את הקבוצה');
  return g;
end $$;

create or replace function public.request_join(_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv invites%rowtype; existing group_members%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from invites where token = _token;
  if not found then raise exception 'invalid invite'; end if;
  select * into existing from group_members where group_id = inv.group_id and user_id = auth.uid();
  if found then
    if existing.status = 'left' then
      update group_members set status='pending', role='member', invited_by=inv.created_by, created_at=now(), decided_at=null
      where group_id=inv.group_id and user_id=auth.uid();
    end if;
    return inv.group_id;
  end if;
  insert into group_members(group_id, user_id, status, invited_by) values (inv.group_id, auth.uid(), 'pending', inv.created_by);
  return inv.group_id;
end $$;

create or replace function public.decide_request(_g uuid, _u uuid, _approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  if not is_group_admin(_g) then raise exception 'forbidden'; end if;
  select invited_by into inviter from group_members where group_id=_g and user_id=_u and status='pending';
  if not found then raise exception 'no pending request'; end if;
  update group_members set status = case when _approve then 'active' else 'rejected' end, decided_at=now(), last_read_at=now()
  where group_id=_g and user_id=_u;
  if _approve then perform _sys(_g, _name(_u) || ' הצטרף/ה לקבוצה'); end if;
  perform _audit(_g, case when _approve then 'join_approved' else 'join_rejected' end, _u, null, jsonb_build_object('inviter', inviter));
end $$;

create or replace function public.remove_member(_g uuid, _u uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(_g) then raise exception 'forbidden'; end if;
  if _u = auth.uid() then raise exception 'use leave'; end if;
  update group_members set status='removed', decided_at=now() where group_id=_g and user_id=_u and status='active';
  if not found then raise exception 'not an active member'; end if;
  perform _sys(_g, _name(_u) || ' הוסר/ה מהקבוצה על ידי מנהל');
  perform _audit(_g, 'member_removed', _u, null);
end $$;

create or replace function public.promote_member(_g uuid, _u uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(_g) then raise exception 'forbidden'; end if;
  update group_members set role='admin' where group_id=_g and user_id=_u and status='active';
  if not found then raise exception 'not an active member'; end if;
  perform _sys(_g, _name(_u) || ' מונה/תה למנהל/ת');
  perform _audit(_g, 'member_promoted', _u, null);
end $$;

create or replace function public.leave_group(_g uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me group_members%rowtype; admins int;
begin
  select * into me from group_members where group_id=_g and user_id=auth.uid() and status='active';
  if not found then raise exception 'not a member'; end if;
  if me.role='admin' then
    select count(*) into admins from group_members where group_id=_g and status='active' and role='admin';
    if admins <= 1 then raise exception 'sole admin must promote another admin first'; end if;
  end if;
  update group_members set status='left', role='member' where group_id=_g and user_id=auth.uid();
  perform _sys(_g, _name(auth.uid()) || ' עזב/ה את הקבוצה');
end $$;

create or replace function public.update_group(_g uuid, _name text, _description text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(_g) then raise exception 'forbidden'; end if;
  if coalesce(trim(_name),'') = '' then raise exception 'name required'; end if;
  update groups set name=trim(_name), description=coalesce(_description,'') where id=_g;
  perform _audit(_g, 'group_updated', null, null, jsonb_build_object('name', _name));
end $$;

create or replace function public.edit_message(_m uuid, _body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(_body),'') = '' then raise exception 'empty'; end if;
  update messages set body=_body, edited_at=now()
  where id=_m and author_id=auth.uid() and kind='user' and deleted_by is null and is_active_member(group_id);
  if not found then raise exception 'forbidden'; end if;
end $$;

create or replace function public.delete_message(_m uuid) returns text
language plpgsql security definer set search_path = public as $$
declare msg messages%rowtype; who text; path text;
begin
  select * into msg from messages where id=_m and kind='user' and deleted_by is null;
  if not found then raise exception 'not found'; end if;
  if msg.author_id = auth.uid() and is_active_member(msg.group_id) then who := 'author';
  elsif is_group_admin(msg.group_id) then who := 'admin';
  else raise exception 'forbidden'; end if;
  path := msg.attachment_path;
  update messages set body='', deleted_by=who, attachment_path=null, attachment_name=null, attachment_type=null, attachment_size=null, pinned_at=null, pinned_by=null
  where id=_m;
  if who='admin' and msg.author_id is distinct from auth.uid() then perform _audit(msg.group_id, 'message_deleted', msg.author_id, _m); end if;
  return path;
end $$;

create or replace function public.toggle_pin(_m uuid) returns void
language plpgsql security definer set search_path = public as $$
declare msg messages%rowtype;
begin
  select * into msg from messages where id=_m and kind='user' and deleted_by is null;
  if not found or not is_group_admin(msg.group_id) then raise exception 'forbidden'; end if;
  if msg.pinned_at is null then
    update messages set pinned_at=now(), pinned_by=auth.uid() where id=_m;
    perform _audit(msg.group_id, 'message_pinned', msg.author_id, _m);
  else
    update messages set pinned_at=null, pinned_by=null where id=_m;
    perform _audit(msg.group_id, 'message_unpinned', msg.author_id, _m);
  end if;
end $$;

create or replace function public.resolve_report(_r uuid, _action text) returns void
language plpgsql security definer set search_path = public as $$
declare rep reports%rowtype; author uuid;
begin
  select * into rep from reports where id=_r and status='open';
  if not found or not is_group_admin(rep.group_id) then raise exception 'forbidden'; end if;
  select author_id into author from messages where id=rep.message_id;
  if _action = 'delete' then
    perform delete_message(rep.message_id);
    update reports set status='resolved_deleted', resolved_by=auth.uid() where id=_r;
  elsif _action = 'remove' then
    perform remove_member(rep.group_id, author);
    update reports set status='resolved_removed', resolved_by=auth.uid() where id=_r;
  else
    update reports set status='dismissed', resolved_by=auth.uid() where id=_r;
  end if;
  perform _audit(rep.group_id, 'report_' || _action, author, rep.message_id);
end $$;

create or replace function public.mark_read(_g uuid) returns void
language sql security definer set search_path = public as $$
  update group_members set last_read_at=now() where group_id=_g and user_id=auth.uid();
  update profiles set last_seen_at=now() where id=auth.uid(); $$;

-- STORAGE policies (bucket created separately)
create policy "members read attachments" on storage.objects for select to authenticated
  using (bucket_id='attachments' and public.is_active_member(((storage.foldername(name))[1])::uuid));
create policy "members upload attachments" on storage.objects for insert to authenticated
  with check (bucket_id='attachments' and public.is_active_member(((storage.foldername(name))[1])::uuid) and owner = auth.uid());
create policy "owner or admin delete attachments" on storage.objects for delete to authenticated
  using (bucket_id='attachments' and (owner = auth.uid() or public.is_group_admin(((storage.foldername(name))[1])::uuid)));

-- REALTIME
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.group_members;
alter table public.messages replica identity full;
