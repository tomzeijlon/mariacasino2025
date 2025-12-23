import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Snowfall } from '@/components/Snowfall';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, TrendingDown, Package, Award, ArrowLeft } from 'lucide-react';

interface VoteCount {
  participantId: string;
  participantName: string;
  count: number;
}

interface HistoryEntry {
  id: string;
  participant_id: string | null;
  package_owner_id: string | null;
  results: unknown;
  move_count: number;
  correct_voters: unknown;
  created_at: string;
}

interface ParticipantStat {
  id: string;
  name: string;
  totalVotes: number;
  wrongVotes: number;
  roundCount: number;
}

interface VoterStat {
  name: string;
  correctVotes: number;
  totalVotes: number;
  percentage: number;
}

interface PackageStat {
  ownerId: string;
  ownerName: string;
  moveCount: number;
}

export default function GameSummary() {
  const navigate = useNavigate();
  const [easiest, setEasiest] = useState<ParticipantStat | null>(null);
  const [hardest, setHardest] = useState<ParticipantStat | null>(null);
  const [mostMovedPackage, setMostMovedPackage] = useState<PackageStat | null>(null);
  const [bestVoter, setBestVoter] = useState<VoterStat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Fetch all history
      const { data: history } = await supabase
        .from('voting_history')
        .select('*');

      // Fetch participants
      const { data: participants } = await supabase
        .from('participants')
        .select('*');

      // Fetch all votes with their sessions to know which participant was being voted on
      const { data: allVotes } = await supabase
        .from('votes')
        .select('voter_name, voted_for_participant_id, session_id');
      
      const { data: allSessions } = await supabase
        .from('voting_sessions')
        .select('id, current_participant_id');

      if (!history || !participants) {
        setLoading(false);
        return;
      }

      const participantMap = new Map(participants.map(p => [p.id, p.name]));
      const sessionParticipantMap = new Map(
        (allSessions || []).map(s => [s.id, s.current_participant_id])
      );

      // Calculate participant stats (easiest/hardest to guess)
      const participantStats = new Map<string, ParticipantStat>();
      
      history.forEach((entry: HistoryEntry) => {
        const participantId = entry.participant_id;
        if (!participantId) return;

        const name = participantMap.get(participantId) || 'Okänd';
        
        let results: VoteCount[] = [];
        try {
          if (typeof entry.results === 'string') {
            results = JSON.parse(entry.results);
          } else if (Array.isArray(entry.results)) {
            results = entry.results as VoteCount[];
          }
        } catch {
          results = [];
        }

        const totalVotes = results.reduce((sum, r) => sum + r.count, 0);
        const correctVotes = results.find(r => r.participantId === participantId)?.count || 0;
        const wrongVotes = totalVotes - correctVotes;

        const existing = participantStats.get(participantId);
        if (existing) {
          existing.totalVotes += totalVotes;
          existing.wrongVotes += wrongVotes;
          existing.roundCount += 1;
        } else {
          participantStats.set(participantId, {
            id: participantId,
            name,
            totalVotes,
            wrongVotes,
            roundCount: 1,
          });
        }
      });

      // Find easiest (fewest wrong votes + fewest rounds)
      const statsArray = Array.from(participantStats.values()).filter(s => s.roundCount > 0);
      
      if (statsArray.length > 0) {
        statsArray.sort((a, b) => {
          if (a.wrongVotes !== b.wrongVotes) {
            return a.wrongVotes - b.wrongVotes;
          }
          return a.roundCount - b.roundCount;
        });
        setEasiest(statsArray[0]);

        statsArray.sort((a, b) => {
          if (b.wrongVotes !== a.wrongVotes) {
            return b.wrongVotes - a.wrongVotes;
          }
          return b.roundCount - a.roundCount;
        });
        setHardest(statsArray[0]);
      }

      // Find most moved package
      const packageMoves = new Map<string, PackageStat>();
      history.forEach((entry: HistoryEntry) => {
        const ownerId = entry.package_owner_id || entry.participant_id;
        if (!ownerId) return;
        
        const existing = packageMoves.get(ownerId);
        const moveCount = entry.move_count || 0;
        
        if (existing) {
          // Take the max move count for this package
          if (moveCount > existing.moveCount) {
            existing.moveCount = moveCount;
          }
        } else {
          packageMoves.set(ownerId, {
            ownerId,
            ownerName: participantMap.get(ownerId) || 'Okänd',
            moveCount,
          });
        }
      });

      const packageArray = Array.from(packageMoves.values());
      if (packageArray.length > 0) {
        packageArray.sort((a, b) => b.moveCount - a.moveCount);
        if (packageArray[0].moveCount > 0) {
          setMostMovedPackage(packageArray[0]);
        }
      }

      // Find best voter - using correct_voters from history
      // Also need to calculate total votes per person and exclude votes on own package
      const voterCorrectCount = new Map<string, number>();
      const voterTotalCount = new Map<string, number>();
      
      // Count correct votes from history
      history.forEach((entry: HistoryEntry) => {
        let correctVoters: string[] = [];
        try {
          if (typeof entry.correct_voters === 'string') {
            correctVoters = JSON.parse(entry.correct_voters);
          } else if (Array.isArray(entry.correct_voters)) {
            correctVoters = entry.correct_voters as string[];
          }
        } catch {
          correctVoters = [];
        }

        correctVoters.forEach(voterName => {
          voterCorrectCount.set(voterName, (voterCorrectCount.get(voterName) || 0) + 1);
        });
      });

      // Count total votes per person, excluding votes on their own package
      if (allVotes) {
        allVotes.forEach(vote => {
          if (!vote.voter_name) return;
          
          // Get whose package was being voted on
          const sessionParticipantId = sessionParticipantMap.get(vote.session_id || '');
          const packageOwnerName = sessionParticipantId ? participantMap.get(sessionParticipantId) : null;
          
          // Skip if voting on own package
          if (packageOwnerName === vote.voter_name) return;
          
          voterTotalCount.set(vote.voter_name, (voterTotalCount.get(vote.voter_name) || 0) + 1);
        });
      }

      // Also count from history for more accurate totals
      // Each correct vote is also a total vote
      voterCorrectCount.forEach((count, name) => {
        const current = voterTotalCount.get(name) || 0;
        if (current < count) {
          voterTotalCount.set(name, count);
        }
      });

      const voterArray: VoterStat[] = [];
      voterTotalCount.forEach((total, name) => {
        const correct = voterCorrectCount.get(name) || 0;
        if (total > 0) {
          voterArray.push({
            name,
            correctVotes: correct,
            totalVotes: total,
            percentage: Math.round((correct / total) * 100),
          });
        }
      });

      if (voterArray.length > 0) {
        voterArray.sort((a, b) => {
          if (b.percentage !== a.percentage) {
            return b.percentage - a.percentage;
          }
          return b.correctVotes - a.correctVotes;
        });
        
        setBestVoter(voterArray[0]);
      }

      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen gradient-festive flex items-center justify-center">
        <Snowfall />
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto text-gold animate-float mb-4" />
          <p className="text-foreground font-display text-xl">Beräknar resultat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-festive relative">
      <Snowfall />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-6xl text-gradient-gold mb-4">
            🏆 Spelsammanfattning
          </h1>
          <p className="text-muted-foreground text-lg">
            Så gick det för Maria Casino!
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Easiest */}
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <TrendingUp className="w-6 h-6 text-forest" />
                Lättast att gissa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {easiest ? (
                <div className="text-center py-4">
                  <p className="font-display text-3xl text-gradient-gold mb-2">
                    {easiest.name}
                  </p>
                  <p className="text-muted-foreground">
                    {easiest.roundCount} omgång{easiest.roundCount !== 1 ? 'ar' : ''} • {easiest.wrongVotes} felaktiga röster
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Ingen data</p>
              )}
            </CardContent>
          </Card>

          {/* Hardest */}
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <TrendingDown className="w-6 h-6 text-primary" />
                Svårast att gissa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hardest ? (
                <div className="text-center py-4">
                  <p className="font-display text-3xl text-gradient-gold mb-2">
                    {hardest.name}
                  </p>
                  <p className="text-muted-foreground">
                    {hardest.roundCount} omgång{hardest.roundCount !== 1 ? 'ar' : ''} • {hardest.wrongVotes} felaktiga röster
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Ingen data</p>
              )}
            </CardContent>
          </Card>

          {/* Most moved package */}
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Package className="w-6 h-6 text-gold" />
                Mest flyttade paketet
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mostMovedPackage ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-2">Paketet som började hos</p>
                  <p className="font-display text-3xl text-gradient-gold mb-2">
                    {mostMovedPackage.ownerName}
                  </p>
                  <p className="text-muted-foreground">
                    Flyttades {mostMovedPackage.moveCount} gång{mostMovedPackage.moveCount !== 1 ? 'er' : ''}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Inga paket flyttades</p>
              )}
            </CardContent>
          </Card>

          {/* Best voter */}
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Award className="w-6 h-6 text-gold" />
                Bästa röstaren
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bestVoter ? (
                <div className="text-center py-4">
                  <p className="font-display text-3xl text-gradient-gold mb-2">
                    {bestVoter.name}
                  </p>
                  <p className="text-muted-foreground">
                    {bestVoter.correctVotes} rätt av {bestVoter.totalVotes} ({bestVoter.percentage}%)
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Ingen data</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka till Admin
          </Button>
        </div>
      </div>
    </div>
  );
}
