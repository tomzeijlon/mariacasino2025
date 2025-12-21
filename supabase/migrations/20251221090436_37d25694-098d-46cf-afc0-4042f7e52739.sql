-- Add UPDATE policy for votes table so users can change their vote
CREATE POLICY "Allow public update votes"
ON public.votes
FOR UPDATE
USING (true)
WITH CHECK (true);