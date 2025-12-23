import { Button } from '@/components/ui/button';
import { Participant } from '@/hooks/useVoting';
import { Gift, Check, Scale } from 'lucide-react';

interface VotingPanelProps {
  participants: Participant[];
  currentParticipant: Participant | null;
  currentVote: { voted_for_participant_id: string } | undefined;
  onVote: (participantId: string) => Promise<{ error: Error | null }>;
  tiebreakerCandidates?: string[] | null;
}

export function VotingPanel({
  participants,
  currentParticipant,
  currentVote,
  onVote,
  tiebreakerCandidates,
}: VotingPanelProps) {
  // If tiebreaker mode, only show those candidates
  const votableParticipants = tiebreakerCandidates
    ? participants.filter(p => tiebreakerCandidates.includes(p.id))
    : participants.filter(p => !p.is_locked);

  if (!currentParticipant) {
    return (
      <div className="text-center py-16">
        <Gift className="w-16 h-16 mx-auto text-muted-foreground mb-4 animate-float" />
        <h2 className="font-display text-2xl text-foreground mb-2">
          Väntar på omröstning...
        </h2>
        <p className="text-muted-foreground">
          Värden startar snart en omröstning
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tiebreaker indicator */}
      {tiebreakerCandidates && (
        <div className="text-center p-3 rounded-lg bg-gold/20 border border-gold">
          <div className="flex items-center justify-center gap-2 text-gold font-medium">
            <Scale className="w-5 h-5" />
            <span>Omröstning! Rösta igen mellan dessa {tiebreakerCandidates.length}.</span>
          </div>
        </div>
      )}

      {/* Current voting target */}
      <div className="text-center">
        <p className="text-gold text-sm uppercase tracking-widest mb-2">
          Vems paket borde det vara?
        </p>
        <h2 className="font-display text-2xl md:text-3xl text-gradient-gold">
          {currentParticipant.name}s paket
        </h2>
      </div>

      {/* Voting buttons - compact 2-column grid for mobile */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        {votableParticipants.map((participant) => {
          const isVotedFor = currentVote?.voted_for_participant_id === participant.id;
          
          return (
            <Button
              key={participant.id}
              variant={isVotedFor ? 'festive' : 'vote'}
              size="sm"
              className="h-auto py-3 px-2 flex-col gap-1 relative text-sm"
              onClick={() => onVote(participant.id)}
            >
              {isVotedFor && (
                <Check className="absolute top-1 right-1 w-4 h-4" />
              )}
              <Gift className="w-5 h-5" />
              <span className="font-display text-sm truncate w-full">{participant.name}</span>
            </Button>
          );
        })}
      </div>

      {currentVote && (
        <p className="text-center text-muted-foreground text-sm">
          Du har röstat. Klicka på en annan person för att ändra.
        </p>
      )}
    </div>
  );
}
