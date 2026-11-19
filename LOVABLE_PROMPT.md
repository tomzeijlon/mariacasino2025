# Lovable prompt — lock down database writes (Nov 2026)

Paste everything between the lines into Lovable as **one** prompt, then publish. Delete this file afterwards.

**Order:** merge this branch into `main` first (Lovable needs the three edge functions in `supabase/functions/`), then send the prompt, then publish. Between the prompt and the publish the old site can't write anymore, so don't run a game in between.

---

Please do the following in one go, without changing any other application code:

1. Deploy the edge functions in `supabase/functions/`: `verify-admin` (updated), `admin-write` (new) and `cast-vote` (new). They read the default `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables plus the existing `ADMIN_PASSWORD` secret. If `SUPABASE_SERVICE_ROLE_KEY` is not available to edge functions in this project, tell me instead of changing the code.
2. Run the SQL below as a single migration, exactly as written (it is idempotent).
3. Regenerate `src/integrations/supabase/types.ts` (the `votes` table loses `voter_token` and gains `voter_token_hash`).

```sql
-- Lock down public write access (Nov 2026). Idempotent.
-- After this, browsers (anon key) can only READ the game tables. All writes go through
-- the edge functions `admin-write` (admin, signed token) and `cast-vote` (voters),
-- which use the service role.

-- 1) Votes: store only a SHA-256 hash of each device's secret token
DELETE FROM public.votes;  -- in-progress votes only; history is kept in voting_history
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS voter_token_hash TEXT;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_voter_token_session_id_key;
ALTER TABLE public.votes DROP COLUMN IF EXISTS voter_token;
ALTER TABLE public.votes ALTER COLUMN voter_token_hash SET NOT NULL;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_voter_token_hash_session_id_key;
ALTER TABLE public.votes ADD CONSTRAINT votes_voter_token_hash_session_id_key UNIQUE (voter_token_hash, session_id);

-- 2) Remove every non-SELECT policy on the game tables
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('participants', 'voting_sessions', 'votes', 'voting_history', 'archived_games')
      AND cmd <> 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3) Keep public read access (all screens read these tables; realtime needs SELECT)
DROP POLICY IF EXISTS "Allow public read participants" ON public.participants;
DROP POLICY IF EXISTS "Allow public read voting_sessions" ON public.voting_sessions;
DROP POLICY IF EXISTS "Allow public read votes" ON public.votes;
DROP POLICY IF EXISTS "Allow public read voting_history" ON public.voting_history;
DROP POLICY IF EXISTS "Allow public read archived_games" ON public.archived_games;
CREATE POLICY "Allow public read participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Allow public read voting_sessions" ON public.voting_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public read votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Allow public read voting_history" ON public.voting_history FOR SELECT USING (true);
CREATE POLICY "Allow public read archived_games" ON public.archived_games FOR SELECT USING (true);

-- 4) Table privileges: read-only for public roles, full for the service role (edge functions)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.participants, public.voting_sessions, public.votes, public.voting_history, public.archived_games
  FROM anon, authenticated;
GRANT SELECT
  ON public.participants, public.voting_sessions, public.votes, public.voting_history, public.archived_games
  TO anon, authenticated;
GRANT ALL
  ON public.participants, public.voting_sessions, public.votes, public.voting_history, public.archived_games
  TO service_role;
```

---
