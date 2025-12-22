import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Participant } from '@/hooks/useVoting';
import { Trash2, Lock, Unlock, Gift, GripVertical, Package } from 'lucide-react';

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
      className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
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
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <Gift className={`w-5 h-5 ${participant.is_locked ? 'text-forest' : 'text-gold'}`} />
      
      <span className={`flex-1 font-display text-lg ${participant.is_locked ? 'line-through text-muted-foreground' : ''}`}>
        {participant.name}
        {participant.is_locked && (
          <span className="ml-2 text-sm text-forest font-sans">✓ Rätt svar</span>
        )}
        {participant.has_received_package && !participant.is_locked && (
          <span className="ml-2 text-sm text-gold font-sans inline-flex items-center gap-1">
            <Package className="w-3 h-3" /> Har paket
          </span>
        )}
        {currentVotingId === participant.id && (
          <span className="ml-2 text-sm text-primary font-sans animate-pulse">● Röstning pågår</span>
        )}
      </span>

      <div className="flex gap-2">
        {!participant.is_locked && (
          <Button
            size="sm"
            variant="vote"
            onClick={() => onStartVoting(participant)}
            disabled={currentVotingId === participant.id}
          >
            Rösta
          </Button>
        )}
        
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onLockToggle(participant)}
          title={participant.is_locked ? 'Lås upp' : 'Lås (rätt svar)'}
        >
          {participant.is_locked ? (
            <Unlock className="w-4 h-4 text-forest" />
          ) : (
            <Lock className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => onRemove(participant)}
          className="hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
