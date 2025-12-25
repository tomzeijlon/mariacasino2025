import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Participant {
  id: string;
  name: string;
  is_locked: boolean;
  has_received_package: boolean;
  sort_order: number | null;
  last_voted_at: string | null;
  created_at: string;
}

export interface VotingSession {
  id: string;
  current_participant_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Vote {
  id: string;
  session_id: string;
  voted_for_participant_id: string;
  voter_token: string;
  voter_name: string | null;
  created_at: string;
}

export interface VoteCount {
  participantId: string;
  participantName: string;
  count: number;
}

export function useVoting() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [session, setSession] = useState<VotingSession | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);

  // Get or create voter token
  const getVoterToken = useCallback(() => {
    let token = localStorage.getItem('voter_token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('voter_token', token);
    }
    return token;
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    
    const [participantsRes, sessionRes, votesRes] = await Promise.all([
      supabase.from('participants').select('*').order('sort_order', { ascending: true, nullsFirst: false }),
      supabase.from('voting_sessions').select('*').eq('is_active', true).maybeSingle(),
      supabase.from('votes').select('*'),
    ]);

    if (participantsRes.data) setParticipants(participantsRes.data);
    if (sessionRes.data) {
      setSession(sessionRes.data);
      // Filter votes for current session
      if (votesRes.data) {
        setVotes(votesRes.data.filter(v => v.session_id === sessionRes.data.id));
      }
    } else {
      setVotes([]);
    }
    
    setLoading(false);
  }, []);

  // Use ref to track session ID for realtime without causing re-subscriptions
  const sessionIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    sessionIdRef.current = session?.id || null;
  }, [session?.id]);

  // Set up realtime subscriptions - only subscribe once
  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('voting-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        supabase.from('participants').select('*').order('sort_order', { ascending: true, nullsFirst: false }).then(({ data }) => {
          if (data) setParticipants(data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voting_sessions' }, () => {
        supabase.from('voting_sessions').select('*').eq('is_active', true).maybeSingle().then(({ data }) => {
          setSession(data);
          if (data) {
            supabase.from('votes').select('*').eq('session_id', data.id).then(({ data: votesData }) => {
              if (votesData) setVotes(votesData);
            });
          } else {
            setVotes([]);
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => {
        // Use ref to get current session ID without re-subscribing
        const currentSessionId = sessionIdRef.current;
        if (currentSessionId) {
          supabase.from('votes').select('*').eq('session_id', currentSessionId).then(({ data }) => {
            if (data) setVotes(data);
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]); // Removed session?.id dependency to prevent re-subscription

  // Add participant
  const addParticipant = useCallback(async (name: string) => {
    // Get max sort_order
    const maxOrder = participants.reduce((max, p) => Math.max(max, p.sort_order || 0), 0);
    const { error } = await supabase.from('participants').insert({ name, sort_order: maxOrder + 1 });
    return { error };
  }, [participants]);

  // Remove participant
  const removeParticipant = useCallback(async (id: string) => {
    const { error } = await supabase.from('participants').delete().eq('id', id);
    return { error };
  }, []);

  // Lock participant (correct answer found) - saves locked_participant_id for "best voter" stats
  const lockParticipant = useCallback(async (id: string) => {
    // When locking participant X, we need to update all voting_history entries where X was voted as the winner
    // This is tricky because voting_history stores participant_id (package owner), not winner
    // The winner is stored in results JSON as the top vote-getter
    
    // Update all voting_history where this participant was the package owner (voted about)
    // This covers the case where someone keeps their own package
    await supabase
      .from('voting_history')
      .update({ locked_participant_id: id })
      .eq('participant_id', id)
      .is('locked_participant_id', null);
    
    // Also update entries where this participant was voted to receive the package
    // We need to find entries where the results show this person as the winner
    // and the package then moved to them
    const { data: allHistory } = await supabase
      .from('voting_history')
      .select('*')
      .is('locked_participant_id', null);
    
    if (allHistory) {
      for (const entry of allHistory) {
        try {
          const results = typeof entry.results === 'string' 
            ? JSON.parse(entry.results) 
            : entry.results;
          
          if (Array.isArray(results) && results.length > 0) {
            // Check if this person was the winner (top vote getter)
            const winner = results[0];
            if (winner.participantId === id) {
              await supabase
                .from('voting_history')
                .update({ locked_participant_id: id })
                .eq('id', entry.id);
            }
          }
        } catch {
          // Skip entries with invalid results
        }
      }
    }
    
    const { error } = await supabase.from('participants').update({ is_locked: true }).eq('id', id);
    return { error };
  }, []);

  // Unlock participant
  const unlockParticipant = useCallback(async (id: string) => {
    const { error } = await supabase.from('participants').update({ is_locked: false }).eq('id', id);
    return { error };
  }, []);

  // Start voting for a participant
  const startVoting = useCallback(async (participantId: string) => {
    // Deactivate any existing session
    await supabase.from('voting_sessions').update({ is_active: false }).eq('is_active', true);
    
    // Delete old votes
    if (session?.id) {
      await supabase.from('votes').delete().eq('session_id', session.id);
    }

    // Create new session
    const { data, error } = await supabase
      .from('voting_sessions')
      .insert({ current_participant_id: participantId, is_active: true })
      .select()
      .single();
    
    if (data) setSession(data);
    setVotes([]);
    
    return { error };
  }, [session?.id]);

  // Reset current voting (clear votes, keep session) - simplified, no history save here
  const resetVoting = useCallback(async () => {
    if (session?.id) {
      // Just delete votes, no history save - history is saved when locking
      await supabase.from('votes').delete().eq('session_id', session.id);
      setVotes([]);
    }
  }, [session]);

  // End voting session and optionally save history
  const endVoting = useCallback(async (saveToHistory: boolean = false, winnerId?: string, tiebreakCandidates?: string[]) => {
    if (session?.id) {
      if (saveToHistory && winnerId && session.current_participant_id) {
        // Get votes for history
        const { data: votesData } = await supabase
          .from('votes')
          .select('voter_name, voted_for_participant_id')
          .eq('session_id', session.id);
        
        if (votesData) {
          const counts: Record<string, number> = {};
          for (const vote of votesData) {
            counts[vote.voted_for_participant_id || ''] = (counts[vote.voted_for_participant_id || ''] || 0) + 1;
          }

          const voteCounts = participants
            .filter(p => !p.is_locked)
            .map(p => ({
              participantId: p.id,
              participantName: p.name,
              count: counts[p.id] || 0,
            }))
            .sort((a, b) => b.count - a.count);

          // Get previous move count for this package
          const { data: existingHistory } = await supabase
            .from('voting_history')
            .select('move_count')
            .eq('package_owner_id', session.current_participant_id)
            .order('created_at', { ascending: false })
            .limit(1);

          const previousMoveCount = existingHistory?.[0]?.move_count || 0;
          const isFirstVoting = !existingHistory || existingHistory.length === 0;
          const isMoved = winnerId !== session.current_participant_id;

          // Save vote data per voter for later "best voter" calculation
          // We store who each person voted for - will be compared to locked_participant_id at game end
          const voterVotes: Record<string, string> = {};
          votesData.forEach(v => {
            if (v.voter_name && v.voted_for_participant_id) {
              voterVotes[v.voter_name] = v.voted_for_participant_id;
            }
          });

          await supabase.from('voting_history').insert({
            participant_id: session.current_participant_id,
            package_owner_id: session.current_participant_id,
            results: JSON.stringify(voteCounts),
            correct_voters: JSON.stringify(voterVotes), // Changed to store {voterName: votedForId}
            move_count: isFirstVoting && isMoved ? 1 : (isMoved ? previousMoveCount + 1 : previousMoveCount),
          });
        }
      }
      
      await supabase.from('votes').delete().eq('session_id', session.id);
      await supabase.from('voting_sessions').update({ is_active: false }).eq('id', session.id);
      setSession(null);
      setVotes([]);
    }
  }, [session, participants]);

  // Start a tiebreaker vote with only specific candidates
  const startTiebreaker = useCallback(async (participantId: string, candidateIds: string[]) => {
    // Deactivate any existing session
    await supabase.from('voting_sessions').update({ is_active: false }).eq('is_active', true);
    
    // Delete old votes
    if (session?.id) {
      await supabase.from('votes').delete().eq('session_id', session.id);
    }

    // Create new session - store tiebreaker candidates in localStorage for the voting page
    localStorage.setItem('tiebreaker_candidates', JSON.stringify(candidateIds));

    const { data, error } = await supabase
      .from('voting_sessions')
      .insert({ current_participant_id: participantId, is_active: true })
      .select()
      .single();
    
    if (data) setSession(data);
    setVotes([]);
    
    return { error };
  }, [session?.id]);

  // Clear tiebreaker mode
  const clearTiebreaker = useCallback(() => {
    localStorage.removeItem('tiebreaker_candidates');
  }, []);

  // Get tiebreaker candidates if in tiebreaker mode
  const getTiebreakerCandidates = useCallback((): string[] | null => {
    const stored = localStorage.getItem('tiebreaker_candidates');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  // Cast a vote
  const castVote = useCallback(async (participantId: string) => {
    if (!session?.id) return { error: new Error('No active session') };

    const voterToken = getVoterToken();
    const voterName = localStorage.getItem('voter_name') || null;
    
    // Check if already voted in this session
    const existingVote = votes.find(v => v.voter_token === voterToken);
    
    if (existingVote) {
      // Update existing vote
      const { error } = await supabase
        .from('votes')
        .update({ voted_for_participant_id: participantId, voter_name: voterName })
        .eq('id', existingVote.id);
      return { error };
    } else {
      // Insert new vote
      const { error } = await supabase.from('votes').insert({
        session_id: session.id,
        voted_for_participant_id: participantId,
        voter_token: voterToken,
        voter_name: voterName,
      });
      return { error };
    }
  }, [session, votes, getVoterToken]);

  // Get vote counts
  const getVoteCounts = useCallback((): VoteCount[] => {
    const counts: Record<string, number> = {};
    
    votes.forEach(vote => {
      counts[vote.voted_for_participant_id] = (counts[vote.voted_for_participant_id] || 0) + 1;
    });

    return participants
      .filter(p => !p.is_locked)
      .map(p => ({
        participantId: p.id,
        participantName: p.name,
        count: counts[p.id] || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [votes, participants]);

  // Check if current user has voted
  const hasVoted = useCallback(() => {
    const voterToken = getVoterToken();
    return votes.some(v => v.voter_token === voterToken);
  }, [votes, getVoterToken]);

  // Get current user's vote
  const getCurrentVote = useCallback(() => {
    const voterToken = getVoterToken();
    return votes.find(v => v.voter_token === voterToken);
  }, [votes, getVoterToken]);

  // Get current participant being voted on
  const getCurrentParticipant = useCallback(() => {
    if (!session?.current_participant_id) return null;
    return participants.find(p => p.id === session.current_participant_id) || null;
  }, [session, participants]);

  // Update participant order
  const updateParticipantOrder = useCallback(async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, index) => 
      supabase.from('participants').update({ sort_order: index + 1 }).eq('id', id)
    );
    await Promise.all(updates);
  }, []);

  // Set has_received_package
  const setHasReceivedPackage = useCallback(async (id: string, hasPackage: boolean) => {
    const { error } = await supabase
      .from('participants')
      .update({ has_received_package: hasPackage })
      .eq('id', id);
    return { error };
  }, []);

  // Get next participant in order (skip locked and those with packages)
  const getNextParticipant = useCallback((excludeId?: string) => {
    const sortedParticipants = [...participants].sort((a, b) => 
      (a.sort_order || 0) - (b.sort_order || 0)
    );
    
    // Find participants who can be voted on (not locked, not has package)
    const eligible = sortedParticipants.filter(p => 
      !p.is_locked && !p.has_received_package && p.id !== excludeId
    );
    
    if (eligible.length === 0) {
      // If no eligible except possibly the excluded one, check if excluded is valid
      if (excludeId) {
        const excluded = sortedParticipants.find(p => p.id === excludeId);
        if (excluded && !excluded.is_locked && !excluded.has_received_package) {
          return excluded;
        }
      }
      return null;
    }
    
    return eligible[0];
  }, [participants]);

  // Mark participant as having finished voting and handle package swap
  const markVotingComplete = useCallback(async (participantId: string, winnerId: string) => {
    // If the winner is different from the current package holder:
    // - Winner gets marked with has_received_package = true
    // - Previous package holder (participantId) LOSES their has_received_package marker
    //   because they now receive winner's old package randomly, not via voting
    
    if (participantId !== winnerId) {
      // Winner gets the package - marked with has_received_package
      await supabase
        .from('participants')
        .update({ has_received_package: true })
        .eq('id', winnerId);
      
      // Previous holder loses their marker (they get a random package, not voted)
      await supabase
        .from('participants')
        .update({ has_received_package: false })
        .eq('id', participantId);
    }
    
    // Mark participant as having finished voting
    await supabase
      .from('participants')
      .update({ last_voted_at: new Date().toISOString() })
      .eq('id', participantId);
  }, []);

  // End voting and proceed to next (used by "Nästa röstning" button)
  const endAndProceedToNext = useCallback(async (winnerId: string) => {
    if (!session?.current_participant_id) return;
    
    const currentParticipantId = session.current_participant_id;
    
    // Save history and mark winner
    await markVotingComplete(currentParticipantId, winnerId);
    
    // End current session (with history save)
    await endVoting(true, winnerId);
    
    // Fetch fresh participant data to get updated has_received_package status
    const { data: freshParticipants } = await supabase
      .from('participants')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false });
    
    if (freshParticipants) {
      // Find eligible participants (not locked, no voted package yet)
      const eligible = freshParticipants.filter(p => 
        !p.is_locked && !p.has_received_package
      );
      
      if (eligible.length === 1) {
        // Only one person left - auto-mark their package as voted
        // since there's no one else to vote on it
        await supabase
          .from('participants')
          .update({ has_received_package: true })
          .eq('id', eligible[0].id);
        // Don't start voting - game is effectively done
      } else if (eligible.length > 1) {
        await startVoting(eligible[0].id);
      }
    }
  }, [session, markVotingComplete, endVoting, startVoting]);

  // Reset all game state except names
  const resetGame = useCallback(async () => {
    // Reset all participants
    await supabase
      .from('participants')
      .update({ 
        is_locked: false, 
        has_received_package: false, 
        last_voted_at: null 
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Delete all history
    await supabase
      .from('voting_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    // End any active session
    await supabase
      .from('voting_sessions')
      .update({ is_active: false })
      .eq('is_active', true);
    
    // Delete all votes
    await supabase
      .from('votes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    setSession(null);
    setVotes([]);
  }, []);

  return {
    participants,
    session,
    votes,
    loading,
    addParticipant,
    removeParticipant,
    lockParticipant,
    unlockParticipant,
    startVoting,
    resetVoting,
    endVoting,
    castVote,
    getVoteCounts,
    hasVoted,
    getCurrentVote,
    getCurrentParticipant,
    updateParticipantOrder,
    setHasReceivedPackage,
    getNextParticipant,
    markVotingComplete,
    endAndProceedToNext,
    resetGame,
    startTiebreaker,
    clearTiebreaker,
    getTiebreakerCandidates,
  };
}
