import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Participant } from '@/hooks/useVoting';
import { Plus, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { SortableParticipant } from './SortableParticipant';

interface ParticipantManagerProps {
  participants: Participant[];
  onAdd: (name: string) => Promise<{ error: Error | null }>;
  onRemove: (id: string) => Promise<{ error: Error | null }>;
  onLock: (id: string) => Promise<{ error: Error | null }>;
  onUnlock: (id: string) => Promise<{ error: Error | null }>;
  onStartVoting: (id: string) => Promise<{ error: Error | null }>;
  onUpdateOrder: (orderedIds: string[]) => Promise<void>;
  onStartNextVoting: () => void;
  currentVotingId: string | null;
}

export function ParticipantManager({
  participants,
  onAdd,
  onRemove,
  onLock,
  onUnlock,
  onStartVoting,
  onUpdateOrder,
  onStartNextVoting,
  currentVotingId,
}: ParticipantManagerProps) {
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAdd = async () => {
    if (!newName.trim()) return;
    
    setIsAdding(true);
    const { error } = await onAdd(newName.trim());
    setIsAdding(false);
    
    if (error) {
      toast.error('Kunde inte lägga till deltagare');
    } else {
      setNewName('');
      toast.success(`${newName} har lagts till!`);
    }
  };

  const handleRemove = async (participant: Participant) => {
    const { error } = await onRemove(participant.id);
    if (error) {
      toast.error('Kunde inte ta bort deltagare');
    } else {
      toast.success(`${participant.name} har tagits bort`);
    }
  };

  const handleLockToggle = async (participant: Participant) => {
    if (participant.is_locked) {
      const { error } = await onUnlock(participant.id);
      if (!error) toast.success(`${participant.name} är nu olåst`);
    } else {
      const { error } = await onLock(participant.id);
      if (!error) toast.success(`${participant.name} är nu låst (rätt svar)`);
    }
  };

  const handleStartVoting = async (participant: Participant) => {
    const { error } = await onStartVoting(participant.id);
    if (error) {
      toast.error('Kunde inte starta omröstning');
    } else {
      toast.success(`Omröstning för ${participant.name}s paket har startat!`);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = participants.findIndex(p => p.id === active.id);
      const newIndex = participants.findIndex(p => p.id === over.id);
      
      const newOrder = arrayMove(participants, oldIndex, newIndex);
      await onUpdateOrder(newOrder.map(p => p.id));
    }
  };

  // Find next eligible participant
  const nextEligible = participants.find(p => !p.is_locked && !p.has_received_package);

  return (
    <div className="space-y-4">
      {/* Add participant form */}
      <div className="flex gap-2">
        <Input
          placeholder="Lägg till deltagare..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 bg-muted border-border focus:border-gold h-9"
        />
        <Button
          onClick={handleAdd}
          disabled={isAdding || !newName.trim()}
          variant="festive"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Lägg till
        </Button>
      </div>

      {/* Next voting button */}
      {nextEligible && (
        <Button
          onClick={onStartNextVoting}
          variant="festive"
          className="w-full"
          size="default"
        >
          <SkipForward className="w-4 h-4 mr-2" />
          {currentVotingId ? 'Nästa röstning' : `Starta röstning: ${nextEligible.name}`}
        </Button>
      )}

      {/* Participant list with drag and drop - compact for 10 participants */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={participants.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {participants.map((participant) => (
              <SortableParticipant
                key={participant.id}
                participant={participant}
                currentVotingId={currentVotingId}
                onRemove={handleRemove}
                onLockToggle={handleLockToggle}
                onStartVoting={handleStartVoting}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {participants.length === 0 && (
        <p className="text-center text-muted-foreground py-4 text-sm">
          Inga deltagare ännu. Lägg till personer som deltar i leken!
        </p>
      )}
    </div>
  );
}
