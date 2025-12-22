-- Add sort_order to participants
ALTER TABLE public.participants 
ADD COLUMN sort_order integer;

-- Add has_received_package to track who has a package voted to them
ALTER TABLE public.participants 
ADD COLUMN has_received_package boolean NOT NULL DEFAULT false;

-- Add last_voted_at to track when voting ended for this person
ALTER TABLE public.participants
ADD COLUMN last_voted_at timestamp with time zone;

-- Update existing participants with sort order based on created_at
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.participants
)
UPDATE public.participants p
SET sort_order = n.rn
FROM numbered n
WHERE p.id = n.id;

-- Add voter_name to votes table
ALTER TABLE public.votes
ADD COLUMN voter_name text;

-- Add package_owner_id to voting_history to track whose package it originally was
ALTER TABLE public.voting_history
ADD COLUMN package_owner_id uuid;

-- Add move_count to track how many times a package has been moved
ALTER TABLE public.voting_history
ADD COLUMN move_count integer NOT NULL DEFAULT 0;

-- Add correct_voter_ids to track who voted correctly
ALTER TABLE public.voting_history
ADD COLUMN correct_voters jsonb;