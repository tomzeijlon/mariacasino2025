DELETE FROM public.votes WHERE id IS NOT NULL;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS voter_token_hash TEXT;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_voter_token_session_id_key;
ALTER TABLE public.votes ALTER COLUMN voter_token SET DEFAULT '';
COMMENT ON COLUMN public.votes.voter_token IS 'DEPRECATED: replaced by voter_token_hash';
ALTER TABLE public.votes ALTER COLUMN voter_token_hash SET NOT NULL;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_voter_token_hash_session_id_key;
ALTER TABLE public.votes ADD CONSTRAINT votes_voter_token_hash_session_id_key UNIQUE (voter_token_hash, session_id);

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

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.participants, public.voting_sessions, public.votes, public.voting_history, public.archived_games
  FROM anon, authenticated;
GRANT SELECT
  ON public.participants, public.voting_sessions, public.votes, public.voting_history, public.archived_games
  TO anon, authenticated;
GRANT ALL
  ON public.participants, public.voting_sessions, public.votes, public.voting_history, public.archived_games
  TO service_role;