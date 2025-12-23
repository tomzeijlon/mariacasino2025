import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Participant } from '@/hooks/useVoting';
import { Trash2, Lock, Unlock, Gift, GripVertical, Target } from 'lucide-react';

interface SortableParticipantProps {
  participant: Participant;
  currentVotingId: string | null;
  onRemove: (participant: Participant) => void;
  onLockToggle: (participant: Participant) => void;
  onStartVoting: (participant: Participant) => void;
}

export function SortableParticipant({
  participant,
  currentVotingId,
  onRemove,
  onLockToggle,
  onStartVoting,
}: SortableParticipantProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: participant.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg border transition-all duration-300 ${
        participant.is_locked
          ? 'bg-forest/20 border-forest/50'
          : currentVotingId === participant.id
          ? 'bg-primary/20 border-primary glow-primary'
          : 'bg-card border-border hover:border-gold/30'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground flex-shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <Gift className={`w-4 h-4 flex-shrink-0 ${participant.is_locked ? 'text-forest' : 'text-gold'}`} />
      
      <span className={`flex-1 font-display text-base min-w-0 ${participant.is_locked ? 'line-through text-muted-foreground' : ''}`}>
        <span className="truncate">{participant.name}</span>
        {participant.is_locked && (
          <span className="ml-1 text-xs text-forest font-sans">✓</span>
        )}
        {participant.has_received_package && !participant.is_locked && (
          <span title="Har framröstat paket">
            <Target className="inline-block ml-1 w-4 h-4 text-gold" />
          </span>
        )}
        {currentVotingId === participant.id && (
          <span className="ml-1 text-xs text-primary font-sans animate-pulse">●</span>
        )}
      </span>

      <div className="flex gap-1 flex-shrink-0">
        {!participant.is_locked && (
          <Button
            size="sm"
            variant="vote"
            onClick={() => onStartVoting(participant)}
            disabled={currentVotingId === participant.id}
            className="px-2 py-1 h-7 text-xs"
          >
            Rösta
          </Button>
        )}
        
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onLockToggle(participant)}
          title={participant.is_locked ? 'Lås upp' : 'Lås (rätt svar)'}
          className="w-7 h-7"
        >
          {participant.is_locked ? (
            <Unlock className="w-3.5 h-3.5 text-forest" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => onRemove(participant)}
          className="hover:text-destructive w-7 h-7"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
