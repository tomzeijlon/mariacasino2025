import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Trash2, History } from 'lucide-react';
import { toast } from 'sonner';

interface HistoryEntry {
  id: string;
  participant_id: string | null;
  results: unknown;
  created_at: string;
  participant_name?: string;
}

interface VoteCount {
  participantId: string;
  participantName: string;
  count: number;
}

export function VotingHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    const { data: historyData } = await supabase
      .from('voting_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (historyData) {
      // Fetch participant names
      const { data: participants } = await supabase
        .from('participants')
        .select('id, name');

      const participantMap = new Map(participants?.map(p => [p.id, p.name]) || []);

      const enriched = historyData.map(entry => ({
        ...entry,
        participant_name: entry.participant_id ? participantMap.get(entry.participant_id) || 'Okänd' : 'Okänd',
      }));

      setHistory(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();

    const channel = supabase
      .channel('history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voting_history' }, () => {
        fetchHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from('voting_history').delete().eq('id', id);
    if (error) {
      toast.error('Kunde inte ta bort historikpost');
    } else {
      toast.success('Historikpost borttagen');
    }
  };

  const parseResults = (results: unknown): VoteCount[] => {
    try {
      if (typeof results === 'string') {
        return JSON.parse(results) as VoteCount[];
      }
      if (Array.isArray(results)) {
        return results as VoteCount[];
      }
      return [];
    } catch {
      return [];
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-4">Laddar historik...</p>;
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Ingen röstningshistorik ännu</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => {
        const results = parseResults(entry.results);
        const winner = results[0];
        
        return (
          <div
            key={entry.id}
            className="p-4 rounded-xl bg-card/50 border border-border"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-display text-lg text-foreground">
                  {entry.participant_name}s paket
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  {new Date(entry.created_at).toLocaleString('sv-SE')}
                </p>
                
                {winner && (
                  <p className="text-sm">
                    <span className="text-gold">Vinnare:</span>{' '}
                    <span className="font-medium">{winner.participantName}</span>{' '}
                    <span className="text-muted-foreground">({winner.count} röster)</span>
                  </p>
                )}
                
                {results.length > 1 && (
                  <details className="mt-2">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      Visa alla resultat
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm">
                      {results.map((r) => (
                        <li key={r.participantId} className="flex justify-between">
                          <span>{r.participantName}</span>
                          <span className="text-muted-foreground">{r.count} röster</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteEntry(entry.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
