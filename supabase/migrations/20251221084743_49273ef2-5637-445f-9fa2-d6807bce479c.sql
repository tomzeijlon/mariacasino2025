-- Create participants table (people who can be voted on)
CREATE TABLE public.participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create voting sessions table (tracks which participant we're voting on)
CREATE TABLE public.voting_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  current_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create votes table
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.voting_sessions(id) ON DELETE CASCADE,
  voted_for_participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  voter_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create voting history table (to save results)
CREATE TABLE public.voting_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_history ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (this is a game app, no auth needed)
CREATE POLICY "Allow public read participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Allow public insert participants" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update participants" ON public.participants FOR UPDATE USING (true);
CREATE POLICY "Allow public delete participants" ON public.participants FOR DELETE USING (true);

CREATE POLICY "Allow public read voting_sessions" ON public.voting_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert voting_sessions" ON public.voting_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update voting_sessions" ON public.voting_sessions FOR UPDATE USING (true);

CREATE POLICY "Allow public read votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Allow public insert votes" ON public.votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete votes" ON public.votes FOR DELETE USING (true);

CREATE POLICY "Allow public read voting_history" ON public.voting_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert voting_history" ON public.voting_history FOR INSERT WITH CHECK (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voting_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voting_history;