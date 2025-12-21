-- Add DELETE policy for voting_history table so admin can remove individual history entries
CREATE POLICY "Allow public delete voting_history"
ON public.voting_history
FOR DELETE
USING (true);