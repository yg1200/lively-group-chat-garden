<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Group chat permissions are enforced in the database (row rules + security-definer functions like decide_request, delete_message); the client only calls them. Why: the spec requires server-side enforcement.
- Thread replies are messages with thread_root_id (one level, enforced by trigger); thread notifications are created by a DB trigger. Why: keeps threads searchable/editable like any message and server-enforced.
