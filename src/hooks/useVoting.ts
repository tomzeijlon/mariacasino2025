import { useState, useEffect, useCallback } from 'react';
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

  // Set up realtime subscriptions
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
        if (session?.id) {
          supabase.from('votes').select('*').eq('session_id', session.id).then(({ data }) => {
            if (data) setVotes(data);
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, session?.id]);

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

  // Lock participant (correct answer found)
  const lockParticipant = useCallback(async (id: string) => {
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

  // Reset current voting (clear votes, keep session)
  const resetVoting = useCallback(async () => {
    if (session?.id) {
      // Calculate vote counts from current votes BEFORE clearing
      const counts: Record<string, number> = {};
      const voterNames: string[] = [];
      
      for (const vote of votes) {
        counts[vote.voted_for_participant_id] = (counts[vote.voted_for_participant_id] || 0) + 1;
      }
      
      // Get correct voters - people who voted for the current participant
      const { data: votesWithNames } = await supabase
        .from('votes')
        .select('voter_name, voted_for_participant_id')
        .eq('session_id', session.id);
      
      if (votesWithNames) {
        votesWithNames.forEach(v => {
          if (v.voted_for_participant_id === session.current_participant_id && v.voter_name) {
            voterNames.push(v.voter_name);
          }
        });
      }

      const voteCounts = participants
        .filter(p => !p.is_locked)
        .map(p => ({
          participantId: p.id,
          participantName: p.name,
          count: counts[p.id] || 0,
        }))
        .sort((a, b) => b.count - a.count);

      const currentParticipant = participants.find(p => p.id === session.current_participant_id);
      
      if (currentParticipant && voteCounts.length > 0) {
        await supabase.from('voting_history').insert({
          participant_id: session.current_participant_id,
          package_owner_id: session.current_participant_id,
          results: JSON.stringify(voteCounts),
          correct_voters: JSON.stringify(voterNames),
          move_count: 0,
        });
      }

      // Delete votes
      await supabase.from('votes').delete().eq('session_id', session.id);
      setVotes([]);
    }
  }, [session, participants, votes]);

  // End voting session
  const endVoting = useCallback(async () => {
    if (session?.id) {
      await resetVoting();
      await supabase.from('voting_sessions').update({ is_active: false }).eq('id', session.id);
      setSession(null);
    }
  }, [session, resetVoting]);

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
  const getNextParticipant = useCallback(() => {
    // Find the last voted participant
    const sortedParticipants = [...participants].sort((a, b) => 
      (a.sort_order || 0) - (b.sort_order || 0)
    );
    
    // Find participants who can be voted on
    const eligible = sortedParticipants.filter(p => 
      !p.is_locked && !p.has_received_package
    );
    
    if (eligible.length === 0) return null;
    
    // Find the last one that had voting
    const lastVotedIndex = sortedParticipants.findIndex(p => 
      p.last_voted_at && eligible.some(e => e.id !== p.id)
    );
    
    // Simple: just get the first eligible one by sort order
    return eligible[0] || null;
  }, [participants]);

  // Mark participant as having finished voting
  const markVotingComplete = useCallback(async (participantId: string, winnerId: string) => {
    // Update winner to have received package
    await supabase
      .from('participants')
      .update({ has_received_package: true })
      .eq('id', winnerId);
    
    // Mark participant as having finished voting
    await supabase
      .from('participants')
      .update({ last_voted_at: new Date().toISOString() })
      .eq('id', participantId);
  }, []);

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
    resetGame,
  };
}
