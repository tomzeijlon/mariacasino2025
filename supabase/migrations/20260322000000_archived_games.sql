-- Create archived_games table to group completed game seasons
CREATE TABLE public.archived_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Link voting_history rows to an archived game.
-- NULL = current (active) game. Non-null = archived.
ALTER TABLE public.voting_history
  ADD COLUMN archived_game_id UUID REFERENCES public.archived_games(id) ON DELETE SET NULL;

-- RLS for archived_games (same open policy as other tables)
ALTER TABLE public.archived_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read archived_games"   ON public.archived_games FOR SELECT USING (true);
CREATE POLICY "Allow public insert archived_games" ON public.archived_games FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update archived_games" ON public.archived_games FOR UPDATE USING (true);
CREATE POLICY "Allow public delete archived_games" ON public.archived_games FOR DELETE USING (true);

-- voting_history was missing an UPDATE policy (lockParticipant already calls UPDATE on it;
-- this also enables archiveGame to set archived_game_id)
CREATE POLICY "Allow public update voting_history" ON public.voting_history FOR UPDATE USING (true);
