-- Add column to track which participant was finally locked as the correct owner
ALTER TABLE public.voting_history 
ADD COLUMN locked_participant_id uuid REFERENCES public.participants(id);

COMMENT ON COLUMN public.voting_history.locked_participant_id IS 'The participant who was finally locked as correct owner of this package';