import { Button } from '@/components/ui/button';
import { Participant } from '@/hooks/useVoting';
import { Gift, Check } from 'lucide-react';

interface VotingPanelProps {
  participants: Participant[];
  currentParticipant: Participant | null;
  currentVote: { voted_for_participant_id: string } | undefined;
  onVote: (participantId: string) => Promise<{ error: Error | null }>;
}

export function VotingPanel({
  participants,
  currentParticipant,
  currentVote,
  onVote,
}: VotingPanelProps) {
  const votableParticipants = participants.filter(p => !p.is_locked);

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
    <div className="space-y-8">
      {/* Current voting target */}
      <div className="text-center">
        <p className="text-gold text-sm uppercase tracking-widest mb-2">
          Vems paket borde det vara?
        </p>
        <h2 className="font-display text-3xl md:text-4xl text-gradient-gold">
          {currentParticipant.name}s paket
        </h2>
      </div>

      {/* Voting buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {votableParticipants.map((participant) => {
          const isVotedFor = currentVote?.voted_for_participant_id === participant.id;
          
          return (
            <Button
              key={participant.id}
              variant={isVotedFor ? 'festive' : 'vote'}
              size="lg"
              className="h-auto py-6 flex-col gap-2 relative"
              onClick={() => onVote(participant.id)}
            >
              {isVotedFor && (
                <Check className="absolute top-2 right-2 w-5 h-5" />
              )}
              <Gift className="w-6 h-6" />
              <span className="font-display text-lg">{participant.name}</span>
            </Button>
          );
        })}
      </div>

      {currentVote && (
        <p className="text-center text-muted-foreground text-sm">
          Du har röstat. Du kan ändra din röst genom att klicka på en annan person.
        </p>
      )}
    </div>
  );
}
