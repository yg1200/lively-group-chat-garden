ALTER TABLE public.messages ADD COLUMN thread_root_id uuid REFERENCES public.messages(id);
CREATE INDEX messages_thread_root_idx ON public.messages(thread_root_id, created_at);

CREATE OR REPLACE FUNCTION public.validate_thread_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r messages%rowtype;
BEGIN
  IF NEW.thread_root_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO r FROM messages WHERE id = NEW.thread_root_id;
  IF NOT FOUND OR r.group_id <> NEW.group_id OR r.kind <> 'user' OR r.thread_root_id IS NOT NULL OR NEW.kind <> 'user' THEN
    RAISE EXCEPTION 'invalid thread';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_validate_thread BEFORE INSERT OR UPDATE OF thread_root_id ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.validate_thread_reply();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  thread_root_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  actor_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "mark own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_thread_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.thread_root_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO notifications(user_id, group_id, message_id, thread_root_id, actor_id)
  SELECT DISTINCT u.uid, NEW.group_id, NEW.id, NEW.thread_root_id, NEW.author_id
  FROM (
    SELECT author_id AS uid FROM messages WHERE id = NEW.thread_root_id
    UNION SELECT author_id FROM messages WHERE thread_root_id = NEW.thread_root_id AND id <> NEW.id
  ) u
  JOIN group_members gm ON gm.group_id = NEW.group_id AND gm.user_id = u.uid AND gm.status = 'active'
  WHERE u.uid IS NOT NULL AND u.uid IS DISTINCT FROM NEW.author_id;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_notify_thread AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_thread_reply();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;