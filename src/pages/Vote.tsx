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
  } = useVoting();

  const currentParticipant = getCurrentParticipant();
  const currentVote = getCurrentVote();

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
      <Snowfall />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-5xl text-gradient-gold mb-4">
            🎰 Maria Casino
          </h1>
          <p className="text-muted-foreground text-lg">
            Hej {voterName}! Vem borde ha paketet egentligen?
          </p>
        </header>

        {/* Voting panel */}
        <div className="max-w-2xl mx-auto">
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
