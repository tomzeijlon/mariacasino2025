-- Prevent duplicate votes: one voter token per session
ALTER TABLE votes
  ADD CONSTRAINT votes_voter_token_session_id_key
  UNIQUE (voter_token, session_id);
