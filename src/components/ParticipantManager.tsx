import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Participant } from '@/hooks/useVoting';
import { Plus, Trash2, Lock, Unlock, Gift } from 'lucide-react';
import { toast } from 'sonner';

interface ParticipantManagerProps {
  participants: Participant[];
  onAdd: (name: string) => Promise<{ error: Error | null }>;
  onRemove: (id: string) => Promise<{ error: Error | null }>;
  onLock: (id: string) => Promise<{ error: Error | null }>;
  onUnlock: (id: string) => Promise<{ error: Error | null }>;
  onStartVoting: (id: string) => Promise<{ error: Error | null }>;
  currentVotingId: string | null;
}

export function ParticipantManager({
  participants,
  onAdd,
  onRemove,
  onLock,
  onUnlock,
  onStartVoting,
  currentVotingId,
}: ParticipantManagerProps) {
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Add participant form */}
      <div className="flex gap-3">
        <Input
          placeholder="Lägg till deltagare..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 bg-muted border-border focus:border-gold"
        />
        <Button
          onClick={handleAdd}
          disabled={isAdding || !newName.trim()}
          variant="festive"
        >
          <Plus className="w-4 h-4" />
          Lägg till
        </Button>
      </div>

      {/* Participant list */}
      <div className="space-y-3">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
              participant.is_locked
                ? 'bg-forest/20 border-forest/50'
                : currentVotingId === participant.id
                ? 'bg-primary/20 border-primary glow-primary'
                : 'bg-card border-border hover:border-gold/30'
            }`}
          >
            <Gift className={`w-5 h-5 ${participant.is_locked ? 'text-forest' : 'text-gold'}`} />
            
            <span className={`flex-1 font-display text-lg ${participant.is_locked ? 'line-through text-muted-foreground' : ''}`}>
              {participant.name}
              {participant.is_locked && (
                <span className="ml-2 text-sm text-forest font-sans">✓ Rätt svar</span>
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
                  onClick={() => handleStartVoting(participant)}
                  disabled={currentVotingId === participant.id}
                >
                  Rösta
                </Button>
              )}
              
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleLockToggle(participant)}
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
                onClick={() => handleRemove(participant)}
                className="hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        {participants.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Inga deltagare ännu. Lägg till personer som deltar i leken!
          </p>
        )}
      </div>
    </div>
  );
}
