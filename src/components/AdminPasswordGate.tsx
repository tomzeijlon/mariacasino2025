import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';
import { Snowfall } from '@/components/Snowfall';
import { supabase } from '@/integrations/supabase/client';

interface AdminPasswordGateProps {
  onSuccess: () => void;
}

export function AdminPasswordGate({ onSuccess }: AdminPasswordGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-admin', {
        body: { password },
      });

      if (fnError || !data?.success) {
        setError(true);
        setPassword('');
      } else {
        sessionStorage.setItem('admin_authenticated', 'true');
        onSuccess();
      }
    } catch {
      setError(true);
      setPassword('');
    } finally {
      setIsLoading(false);
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
              disabled={isLoading}
            />

            {error && (
              <p className="text-destructive text-sm text-center">
                Fel lösenord. Försök igen.
              </p>
            )}

            <Button type="submit" variant="festive" className="w-full" disabled={isLoading}>
              {isLoading ? 'Kontrollerar...' : 'Logga in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
