import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Trash2, History, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface HistoryEntry {
  id: string;
  participant_id: string | null;
  results: unknown;
  created_at: string;
  participant_name?: string;
  move_count?: number;
}

interface VoteCount {
  participantId: string;
  participantName: string;
  count: number;
}

export function VotingHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantMap, setParticipantMap] = useState<Map<string, string>>(new Map());

  const fetchHistory = async () => {
    const { data: historyData } = await supabase
      .from('voting_history')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: participants } = await supabase
      .from('participants')
      .select('id, name');

    const pMap = new Map(participants?.map(p => [p.id, p.name]) || []);
    setParticipantMap(pMap);

    if (historyData) {
      const enriched = historyData.map(entry => ({
        ...entry,
        participant_name: entry.participant_id ? pMap.get(entry.participant_id) || 'Okänd' : 'Okänd',
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
    return <p className="text-muted-foreground text-center py-2 text-sm">Laddar...</p>;
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-4">
        <History className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">Ingen historik ännu</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => {
        const results = parseResults(entry.results);
        const winner = results[0];
        const fromName = entry.participant_name || 'Okänd';
        const toName = winner?.participantName || 'Okänd';
        const isMoved = fromName !== toName;
        
        return (
          <div
            key={entry.id}
            className="p-2 rounded-lg bg-card/50 border border-border text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 font-display text-sm">
                  <span className="truncate">{fromName}</span>
                  {isMoved && (
                    <>
                      <ArrowRight className="w-3 h-3 text-gold flex-shrink-0" />
                      <span className="truncate text-gold">{toName}</span>
                    </>
                  )}
                  {!isMoved && (
                    <span className="text-forest ml-1">✓</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {winner?.count || 0} röster
                </p>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteEntry(entry.id)}
                className="text-muted-foreground hover:text-destructive w-6 h-6"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
