import { useState, useEffect } from 'react';
import { useVoting } from '@/hooks/useVoting';
import { Snowfall } from '@/components/Snowfall';
import { VotingPanel } from '@/components/VotingPanel';
import { VoterNameGate } from '@/components/VoterNameGate';
import { Gift } from 'lucide-react';
import { toast } from 'sonner';

export default function Vote() {
  const [voterName, setVoterName] = useState<string | null>(() => {
    return localStorage.getItem('voter_name');
  });

  const {
    participants,
    loading,
    castVote,
    getCurrentParticipant,
    getCurrentVote,
    votes,
  } = useVoting();

  const currentParticipant = getCurrentParticipant();
  const currentVote = getCurrentVote();
  
  // Calculate if we're one vote away from complete
  const totalVotersExpected = participants.filter(p => !p.is_locked).length;
  const currentVoteCount = votes.length;
  const isOneVoteAway = currentVoteCount === totalVotersExpected - 1 && totalVotersExpected > 1;

  const handleVote = async (participantId: string): Promise<{ error: Error | null }> => {
    const result = await castVote(participantId);
    if (result.error) {
      toast.error('Kunde inte registrera röst');
    } else {
      toast.success('Din röst har registrerats!');
    }
    return { error: result.error instanceof Error ? result.error : null };
  };

  if (!voterName) {
    return <VoterNameGate onSuccess={setVoterName} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-festive flex items-center justify-center">
        <Snowfall />
        <div className="text-center">
          <Gift className="w-16 h-16 mx-auto text-gold animate-float mb-4" />
          <p className="text-foreground font-display text-xl">Laddar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-festive relative">
      <Snowfall speed={isOneVoteAway ? 'fast' : 'normal'} />
      
      <div className="relative z-10 container mx-auto px-4 py-6">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl text-gradient-gold mb-2">
            🎰 Maria Casino
          </h1>
          <p className="text-muted-foreground">
            Hej {voterName}! Vem borde ha paketet?
          </p>
          {isOneVoteAway && (
            <p className="text-gold text-sm mt-2 animate-pulse">
              ⏳ Bara en röst kvar!
            </p>
          )}
        </header>

        {/* Voting panel */}
        <div className="max-w-md mx-auto">
          <VotingPanel
            participants={participants}
            currentParticipant={currentParticipant}
            currentVote={currentVote}
            onVote={handleVote}
          />
        </div>
      </div>
    </div>
  );
}
