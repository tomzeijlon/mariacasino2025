import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User } from 'lucide-react';
import { Snowfall } from '@/components/Snowfall';

interface VoterNameGateProps {
  onSuccess: (name: string) => void;
}

export function VoterNameGate({ onSuccess }: VoterNameGateProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      localStorage.setItem('voter_name', name.trim());
      onSuccess(name.trim());
    }
  };

  return (
    <div className="min-h-screen gradient-festive flex items-center justify-center">
      <Snowfall />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-card/80 backdrop-blur border border-border rounded-2xl p-8">
          <div className="text-center mb-6">
            <User className="w-12 h-12 mx-auto text-gold mb-4" />
            <h1 className="font-display text-2xl text-gradient-gold">
              🎰 Maria Casino
            </h1>
            <p className="text-muted-foreground mt-2">
              Vad heter du?
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Ditt namn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted border-border"
              autoFocus
            />

            <Button type="submit" variant="festive" className="w-full" disabled={!name.trim()}>
              Gå vidare
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
