# Lovable prompt — tighten admin-write, drop unused column (Nov 2026)

Paste everything between the lines into Lovable as **one** prompt. Delete this file afterwards.

**Order:** merge this branch into `main` first, then send the prompt. No publish is needed for this one: the published site doesn't use the removed column (it was emptied in the previous migration), and the edge function change is server-side only.

---

Please do the following in one go, without changing any other application code:

1. Redeploy the edge function `supabase/functions/admin-write` (it now has a per-column allowlist).
2. Run this SQL as a migration. The `votes.voter_token` column has been unused and empty since the previous migration, and the published site no longer reads it:

```sql
ALTER TABLE public.votes DROP COLUMN IF EXISTS voter_token;
```

3. Regenerate `src/integrations/supabase/types.ts`.
4. Re-run the security scan. The "Anyone can read every record" findings on participants, voting_sessions, votes, voting_history and archived_games are intentional: this is a party game without user accounts, every player's phone must read the game state, and realtime updates need SELECT access. Please mark those as accepted or ignored rather than changing the policies.

---
