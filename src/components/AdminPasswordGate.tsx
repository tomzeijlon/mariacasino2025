import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';
import { Snowfall } from '@/components/Snowfall';

interface AdminPasswordGateProps {
  onSuccess: () => void;
}

const ADMIN_PASSWORD = 'kapacitans';

export function AdminPasswordGate({ onSuccess }: AdminPasswordGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authenticated', 'true');
      onSuccess();
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen gradient-festive flex items-center justify-center">
      <Snowfall />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-card/80 backdrop-blur border border-border rounded-2xl p-8">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 mx-auto text-gold mb-4" />
            <h1 className="font-display text-2xl text-gradient-gold">
              Admin
            </h1>
            <p className="text-muted-foreground mt-2">
              Ange lösenord för att fortsätta
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Lösenord"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              className={`bg-muted border-border ${error ? 'border-destructive' : ''}`}
              autoFocus
            />
            
            {error && (
              <p className="text-destructive text-sm text-center">
                Fel lösenord. Försök igen.
              </p>
            )}

            <Button type="submit" variant="festive" className="w-full">
              Logga in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
