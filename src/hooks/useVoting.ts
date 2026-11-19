import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { adminDb, adminWrite } from '@/lib/adminDb';
import { entriesForPackage, packageHeldBy, replayPackages } from '@/lib/gameStats';

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
  /** Set while a tiebreaker vote runs: only these participants can be voted for */
  tiebreaker_candidate_ids?: string[] | null;
}

export interface Vote {
  id: string;
  session_id: string;
  voted_for_participant_id: string;
  /** SHA-256 of the voting device's secret token (the token itself is never stored) */
  voter_token_hash: string;
  voter_name: string | null;
  created_at: string;
}

export interface VoteCount {
  participantId: string;
  participantName: string;
  count: number;
}

export interface ArchivedGame {
  id: string;
  year: number;
  label: string;
  created_at: string;
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

  // Hash of this device's token, used to recognise its own vote among everyone's votes
  const [voterTokenHash, setVoterTokenHash] = useState<string | null>(null);
  useEffect(() => {
    const bytes = new TextEncoder().encode(getVoterToken());
    crypto.subtle.digest('SHA-256', bytes).then(digest => {
      setVoterTokenHash([...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join(''));
    });
  }, [getVoterToken]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    
    const [participantsRes, sessionRes] = await Promise.all([
      supabase.from('participants').select('*').order('sort_order', { ascending: true, nullsFirst: false }),
      supabase.from('voting_sessions').select('*').eq('is_active', true).maybeSingle(),
    ]);

    if (participantsRes.data) setParticipants(participantsRes.data);
    if (sessionRes.data) {
      setSession(sessionRes.data);
      const { data: votesData } = await supabase.from('votes').select('*').eq('session_id', sessionRes.data.id);
      if (votesData) setVotes(votesData);
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
    const { error } = await adminDb.from('participants').insert({ name, sort_order: maxOrder + 1 });
    return { error };
  }, [participants]);

  // Remove participant
  const removeParticipant = useCallback(async (id: string) => {
    const { error } = await adminDb.from('participants').delete().eq('id', id);
    return { error };
  }, []);

  // Fetch the current (unarchived) game's history in a form the package replay understands
  const fetchCurrentHistoryForReplay = useCallback(async () => {
    const { data } = await supabase
      .from('voting_history')
      .select('id, participant_id, package_owner_id, results, created_at')
      .is('archived_game_id', null);
    return data ?? [];
  }, []);

  // Lock participant (correct answer found) - saves locked_participant_id for "best voter" stats.
  // Packages swap when voted away (A's package goes to B, A gets B's old package), so the history
  // is replayed to find which package X holds now; every round of that package gets X as its
  // confirmed correct owner.
  const lockParticipant = useCallback(async (id: string) => {
    const history = await fetchCurrentHistoryForReplay();
    const packageKey = packageHeldBy(history, id);
    const idsToUpdate = entriesForPackage(history, packageKey);

    if (idsToUpdate.length > 0) {
      const { error: historyError } = await adminDb
        .from('voting_history')
        .update({ locked_participant_id: id })
        .in('id', idsToUpdate);

      if (historyError) {
        console.error('Error updating voting_history with locked_participant_id:', historyError);
      }
    }

    const { error } = await adminDb.from('participants').update({ is_locked: true }).eq('id', id);
    return { error };
  }, [fetchCurrentHistoryForReplay]);

  // Unlock participant
  const unlockParticipant = useCallback(async (id: string) => {
    const { error } = await adminDb.from('participants').update({ is_locked: false }).eq('id', id);
    return { error };
  }, []);

  // Start voting for a participant
  const startVoting = useCallback(async (participantId: string) => {
    // Deactivate any existing session
    await adminDb.from('voting_sessions').update({ is_active: false }).eq('is_active', true);
    
    // Delete old votes
    if (session?.id) {
      await adminDb.from('votes').delete().eq('session_id', session.id);
    }

    // Create new session
    const { data, error } = await adminDb
      .from('voting_sessions')
      .insert({ current_participant_id: participantId, is_active: true })
      .select()
      .single<VotingSession>();
    
    if (data) setSession(data);
    setVotes([]);
    
    return { error };
  }, [session?.id]);

  // Reset current voting (clear votes, keep session) - simplified, no history save here
  const resetVoting = useCallback(async () => {
    if (session?.id) {
      // Just delete votes, no history save - history is saved when locking
      await adminDb.from('votes').delete().eq('session_id', session.id);
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

          // Replay this game's rounds to find which package the holder has now and how often it has moved
          const history = await fetchCurrentHistoryForReplay();
          const replay = replayPackages(history);
          const holderId = session.current_participant_id;
          const originalPackageOwnerId = replay.holdings.get(holderId) ?? holderId;
          const isMoved = winnerId !== holderId;
          const moveCount = (replay.movesByPackage.get(originalPackageOwnerId) ?? 0) + (isMoved ? 1 : 0);

          // Save vote data per voter for later "best voter" calculation
          // We store who each person voted for - will be compared to locked_participant_id at game end
          const voterVotes: Record<string, string> = {};
          votesData.forEach(v => {
            if (v.voter_name && v.voted_for_participant_id) {
              voterVotes[v.voter_name] = v.voted_for_participant_id;
            }
          });

          await adminDb.from('voting_history').insert({
            participant_id: session.current_participant_id,
            package_owner_id: session.current_participant_id,
            original_package_owner_id: originalPackageOwnerId,
            results: JSON.stringify(voteCounts),
            correct_voters: JSON.stringify(voterVotes),
            move_count: moveCount,
          });
        }
      }
      
      await adminDb.from('votes').delete().eq('session_id', session.id);
      await adminDb.from('voting_sessions').update({ is_active: false }).eq('id', session.id);
      setSession(null);
      setVotes([]);
    }
  }, [session, participants, fetchCurrentHistoryForReplay]);

  // Start a tiebreaker vote with only specific candidates
  const startTiebreaker = useCallback(async (participantId: string, candidateIds: string[]) => {
    // Deactivate any existing session
    await adminDb.from('voting_sessions').update({ is_active: false }).eq('is_active', true);
    
    // Delete old votes
    if (session?.id) {
      await adminDb.from('votes').delete().eq('session_id', session.id);
    }

    // Create new session; candidates are stored on the session so every device sees them
    const { data, error } = await adminDb
      .from('voting_sessions')
      .insert({ current_participant_id: participantId, is_active: true, tiebreaker_candidate_ids: candidateIds })
      .select()
      .single<VotingSession>();
    
    if (data) setSession(data);
    setVotes([]);
    
    return { error };
  }, [session?.id]);

  // Get tiebreaker candidates if the active session is a tiebreaker
  const getTiebreakerCandidates = useCallback((): string[] | null => {
    const ids = session?.tiebreaker_candidate_ids;
    return ids && ids.length > 0 ? ids : null;
  }, [session]);

  // Cast or change this device's vote (validated and stored by the cast-vote edge function)
  const castVote = useCallback(async (participantId: string) => {
    if (!session?.id) return { error: new Error('No active session') };

    const { error } = await supabase.functions.invoke('cast-vote', {
      body: {
        voterToken: getVoterToken(),
        sessionId: session.id,
        participantId,
        voterName: localStorage.getItem('voter_name') || null,
      },
    });
    return { error: error as Error | null };
  }, [session, getVoterToken]);

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
    return !!voterTokenHash && votes.some(v => v.voter_token_hash === voterTokenHash);
  }, [votes, voterTokenHash]);

  // Get current user's vote
  const getCurrentVote = useCallback(() => {
    return voterTokenHash ? votes.find(v => v.voter_token_hash === voterTokenHash) : undefined;
  }, [votes, voterTokenHash]);

  // Get current participant being voted on
  const getCurrentParticipant = useCallback(() => {
    if (!session?.current_participant_id) return null;
    return participants.find(p => p.id === session.current_participant_id) || null;
  }, [session, participants]);

  // Update participant order
  const updateParticipantOrder = useCallback(async (orderedIds: string[]) => {
    // One request for the whole new order
    await adminWrite(orderedIds.map((id, index) =>
      adminDb.from('participants').update({ sort_order: index + 1 }).eq('id', id).toOp()
    ));
  }, []);

  // Set has_received_package
  const setHasReceivedPackage = useCallback(async (id: string, hasPackage: boolean) => {
    const { error } = await adminDb
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
      await adminDb
        .from('participants')
        .update({ has_received_package: true })
        .eq('id', winnerId);
      
      // Previous holder loses their marker (they get a random package, not voted)
      await adminDb
        .from('participants')
        .update({ has_received_package: false })
        .eq('id', participantId);
    }
    
    // Mark participant as having finished voting
    await adminDb
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
      const allEligible = freshParticipants.filter(p =>
        !p.is_locked && !p.has_received_package
      );

      if (allEligible.length === 1) {
        // Only one person left - auto-mark their package as voted
        // since there's no one else to vote on it (Bug 5 fix)
        await adminDb
          .from('participants')
          .update({ has_received_package: true })
          .eq('id', allEligible[0].id);
        // Don't start voting - game is effectively done
      } else if (allEligible.length > 1) {
        // Bug 4 fix: prefer someone other than the current participant
        // (they just had their package voted on; give priority to others)
        const others = allEligible.filter(p => p.id !== currentParticipantId);
        const next = others.length > 0 ? others[0] : allEligible[0];
        await startVoting(next.id);
      }
    }
  }, [session, markVotingComplete, endVoting, startVoting]);

  // Archive current game (tag all current history with an archived_game_id) then reset
  const archiveGame = useCallback(async (year: number, label: string): Promise<{ error: Error | null }> => {
    // 1. Create the archive record
    const { data: archiveData, error: insertError } = await adminDb
      .from('archived_games')
      .insert({ year, label })
      .select()
      .single<ArchivedGame>();

    if (insertError || !archiveData) {
      return { error: insertError as Error };
    }

    // 2. Tag all current (unarchived) history rows
    const { error: tagError } = await adminDb
      .from('voting_history')
      .update({ archived_game_id: archiveData.id })
      .is('archived_game_id', null);

    if (tagError) return { error: tagError as Error };

    // 3. Reset participant flags
    await adminDb
      .from('participants')
      .update({ is_locked: false, has_received_package: false, last_voted_at: null })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // 4. End any active session
    await adminDb
      .from('voting_sessions')
      .update({ is_active: false })
      .eq('is_active', true);

    // 5. Delete all votes
    await adminDb
      .from('votes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    setSession(null);
    setVotes([]);

    return { error: null };
  }, []);

  // Fetch all archived games, newest first
  const fetchArchivedGames = useCallback(async (): Promise<ArchivedGame[]> => {
    const { data } = await supabase
      .from('archived_games')
      .select('*')
      .order('year', { ascending: false });
    return (data as ArchivedGame[]) ?? [];
  }, []);

  // Fetch voting history for a specific game (null = current unarchived game)
  const fetchHistoryForGame = useCallback(async (gameId: string | null) => {
    const query = supabase
      .from('voting_history')
      .select('*')
      .order('created_at', { ascending: true });

    const { data } = gameId
      ? await query.eq('archived_game_id', gameId)
      : await query.is('archived_game_id', null);

    return data ?? [];
  }, []);

  // Reset all game state except names
  const resetGame = useCallback(async () => {
    // Reset all participants
    await adminDb
      .from('participants')
      .update({ 
        is_locked: false, 
        has_received_package: false, 
        last_voted_at: null 
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Delete the current game's history (archived games are kept)
    await adminDb
      .from('voting_history')
      .delete()
      .is('archived_game_id', null);
    
    // End any active session
    await adminDb
      .from('voting_sessions')
      .update({ is_active: false })
      .eq('is_active', true);
    
    // Delete all votes
    await adminDb
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
    archiveGame,
    fetchArchivedGames,
    fetchHistoryForGame,
    startTiebreaker,
    getTiebreakerCandidates,
  };
}
