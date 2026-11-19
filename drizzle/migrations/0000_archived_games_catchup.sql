-- One-shot catch-up migration for Maria Casino (idempotent; safe to run once on live DB)

-- 1) Multi-year archive (from 20260322000000_archived_games.sql, never applied live)
CREATE TABLE IF NOT EXISTS public.archived_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_games TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_games TO authenticated;
GRANT ALL ON public.archived_games TO service_role;
ALTER TABLE public.archived_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read archived_games" ON public.archived_games;
DROP POLICY IF EXISTS "Allow public insert archived_games" ON public.archived_games;
DROP POLICY IF EXISTS "Allow public update archived_games" ON public.archived_games;
DROP POLICY IF EXISTS "Allow public delete archived_games" ON public.archived_games;
CREATE POLICY "Allow public read archived_games"   ON public.archived_games FOR SELECT USING (true);
CREATE POLICY "Allow public insert archived_games" ON public.archived_games FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update archived_games" ON public.archived_games FOR UPDATE USING (true);
CREATE POLICY "Allow public delete archived_games" ON public.archived_games FOR DELETE USING (true);

ALTER TABLE public.voting_history
  ADD COLUMN IF NOT EXISTS archived_game_id UUID REFERENCES public.archived_games(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "Allow public update voting_history" ON public.voting_history;
CREATE POLICY "Allow public update voting_history" ON public.voting_history FOR UPDATE USING (true);

-- 2) One vote per voter per session (from 20260321000000, never applied live)
DELETE FROM public.votes a USING public.votes b
  WHERE a.session_id = b.session_id AND a.voter_token = b.voter_token AND a.created_at < b.created_at;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_voter_token_session_id_key;
ALTER TABLE public.votes ADD CONSTRAINT votes_voter_token_session_id_key UNIQUE (voter_token, session_id);

-- 3) At most one active voting session (double-clicking "Nästa" created two and froze the game)
CREATE UNIQUE INDEX IF NOT EXISTS voting_sessions_single_active
  ON public.voting_sessions ((true)) WHERE is_active;

-- 4) Tiebreaker candidates shared with all devices (was only in admin's localStorage)
ALTER TABLE public.voting_sessions
  ADD COLUMN IF NOT EXISTS tiebreaker_candidate_ids UUID[];

-- 5) Deleting a participant must not wipe (archived) history or fail on FK
ALTER TABLE public.voting_history DROP CONSTRAINT IF EXISTS voting_history_participant_id_fkey;
ALTER TABLE public.voting_history ADD CONSTRAINT voting_history_participant_id_fkey
  FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE SET NULL;
ALTER TABLE public.voting_history DROP CONSTRAINT IF EXISTS voting_history_locked_participant_id_fkey;
ALTER TABLE public.voting_history ADD CONSTRAINT voting_history_locked_participant_id_fkey
  FOREIGN KEY (locked_participant_id) REFERENCES public.participants(id) ON DELETE SET NULL;
ALTER TABLE public.voting_history DROP CONSTRAINT IF EXISTS voting_history_original_package_owner_id_fkey;
ALTER TABLE public.voting_history ADD CONSTRAINT voting_history_original_package_owner_id_fkey
  FOREIGN KEY (original_package_owner_id) REFERENCES public.participants(id) ON DELETE SET NULL;