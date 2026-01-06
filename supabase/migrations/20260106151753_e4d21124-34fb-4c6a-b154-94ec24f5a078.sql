-- Add original_package_owner_id to track the original owner of a package across voting rounds
ALTER TABLE public.voting_history 
ADD COLUMN original_package_owner_id uuid REFERENCES public.participants(id);

-- Add a comment explaining the column
COMMENT ON COLUMN public.voting_history.original_package_owner_id IS 'The original owner of the package being voted on. This stays constant even as the package moves between participants.';