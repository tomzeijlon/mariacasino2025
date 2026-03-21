import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Snowfall } from '@/components/Snowfall';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, TrendingUp, TrendingDown, Package, Award, ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { parseVoteResults, type VoteCount } from '@/lib/utils';
import { useVoting, type ArchivedGame } from '@/hooks/useVoting';
import { exportHTML } from '@/lib/exportHTML';
import { exportExcel } from '@/lib/exportExcel';

interface HistoryEntry {
  id: string;
  participant_id: string | null;
  package_owner_id: string | null;
  locked_participant_id: string | null;
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

export interface GameStats {
  easiest: ParticipantStat | null;
  hardest: ParticipantStat | null;
  mostMovedPackage: PackageStat | null;
  topVoters: VoterStat[];
  history: HistoryEntry[];
  participantMap: Map<string, string>;
  label: string;
}

export default function GameSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId');

  const { fetchArchivedGames, fetchHistoryForGame } = useVoting();

  const [easiest, setEasiest] = useState<ParticipantStat | null>(null);
  const [hardest, setHardest] = useState<ParticipantStat | null>(null);
  const [mostMovedPackage, setMostMovedPackage] = useState<PackageStat | null>(null);
  const [topVoters, setTopVoters] = useState<VoterStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedGames, setArchivedGames] = useState<ArchivedGame[]>([]);
  const [currentGameLabel, setCurrentGameLabel] = useState('Aktuellt spel');
  const [rawHistory, setRawHistory] = useState<HistoryEntry[]>([]);
  const [participantMap, setParticipantMap] = useState<Map<string, string>>(new Map());

  // Load archived games list for selector
  useEffect(() => {
    fetchArchivedGames().then(setArchivedGames);
  }, [fetchArchivedGames]);

  // Set label when gameId changes
  useEffect(() => {
    if (gameId && archivedGames.length > 0) {
      const found = archivedGames.find(g => g.id === gameId);
      if (found) setCurrentGameLabel(`${found.year} — ${found.label}`);
    } else if (!gameId) {
      setCurrentGameLabel('Aktuellt spel');
    }
  }, [gameId, archivedGames]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);

      const history = await fetchHistoryForGame(gameId) as HistoryEntry[];

      // Fetch participants
      const { data: participants } = await supabase
        .from('participants')
        .select('*');

      if (!history || !participants) {
        setEasiest(null);
        setHardest(null);
        setMostMovedPackage(null);
        setTopVoters([]);
        setLoading(false);
        return;
      }

      // Reset stats before computing
      setEasiest(null);
      setHardest(null);
      setMostMovedPackage(null);

      const pMap = new Map(participants.map(p => [p.id, p.name]));
      setParticipantMap(pMap);
      setRawHistory(history);

      // Calculate participant stats (easiest/hardest to guess)
      const participantStats = new Map<string, ParticipantStat>();

      history.forEach((entry: HistoryEntry) => {
        const correctOwnerId = entry.locked_participant_id;
        if (!correctOwnerId) return;

        const name = pMap.get(correctOwnerId) || 'Okänd';
        const results = parseVoteResults(entry.results);
        const totalVotes = results.reduce((sum, r) => sum + r.count, 0);
        const correctVotes = results.find(r => r.participantId === correctOwnerId)?.count || 0;
        const wrongVotes = totalVotes - correctVotes;

        const existing = participantStats.get(correctOwnerId);
        if (existing) {
          existing.totalVotes += totalVotes;
          existing.wrongVotes += wrongVotes;
          existing.roundCount += 1;
        } else {
          participantStats.set(correctOwnerId, {
            id: correctOwnerId,
            name,
            totalVotes,
            wrongVotes,
            roundCount: 1,
          });
        }
      });

      const statsArray = Array.from(participantStats.values()).filter(s => s.roundCount > 0);

      if (statsArray.length > 0) {
        statsArray.sort((a, b) => {
          if (a.wrongVotes !== b.wrongVotes) return a.wrongVotes - b.wrongVotes;
          return a.roundCount - b.roundCount;
        });
        setEasiest(statsArray[0]);

        statsArray.sort((a, b) => {
          if (b.wrongVotes !== a.wrongVotes) return b.wrongVotes - a.wrongVotes;
          return b.roundCount - a.roundCount;
        });
        setHardest(statsArray[0]);
      }

      // Most moved package
      const packageMoves = new Map<string, PackageStat>();
      history.forEach((entry: HistoryEntry) => {
        const ownerId = entry.package_owner_id || entry.participant_id;
        if (!ownerId) return;

        const existing = packageMoves.get(ownerId);
        const moveCount = entry.move_count || 0;

        if (existing) {
          if (moveCount > existing.moveCount) existing.moveCount = moveCount;
        } else {
          packageMoves.set(ownerId, {
            ownerId,
            ownerName: pMap.get(ownerId) || 'Okänd',
            moveCount,
          });
        }
      });

      const packageArray = Array.from(packageMoves.values());
      if (packageArray.length > 0) {
        packageArray.sort((a, b) => b.moveCount - a.moveCount);
        if (packageArray[0].moveCount > 0) setMostMovedPackage(packageArray[0]);
      }

      // Best voters
      const packageToCorrectOwner = new Map<string, string>();
      history.forEach((entry: HistoryEntry) => {
        if (entry.package_owner_id && entry.locked_participant_id) {
          packageToCorrectOwner.set(entry.package_owner_id, entry.locked_participant_id);
        }
      });

      const voterCorrectCount = new Map<string, number>();
      const voterTotalCount = new Map<string, number>();

      history.forEach((entry: HistoryEntry) => {
        const packageOwnerId = entry.package_owner_id;
        if (!packageOwnerId) return;

        const correctOwnerId = packageToCorrectOwner.get(packageOwnerId);
        if (!correctOwnerId) return;

        const packageOwnerName = pMap.get(packageOwnerId);

        let voterVotes: Record<string, string> = {};
        try {
          if (typeof entry.correct_voters === 'string') {
            voterVotes = JSON.parse(entry.correct_voters);
          } else if (entry.correct_voters && typeof entry.correct_voters === 'object') {
            voterVotes = entry.correct_voters as Record<string, string>;
          }
        } catch {
          voterVotes = {};
        }

        Object.entries(voterVotes).forEach(([voterName, votedForId]) => {
          if (packageOwnerName && voterName === packageOwnerName) return;
          voterTotalCount.set(voterName, (voterTotalCount.get(voterName) || 0) + 1);
          if (votedForId === correctOwnerId) {
            voterCorrectCount.set(voterName, (voterCorrectCount.get(voterName) || 0) + 1);
          }
        });
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
          if (b.percentage !== a.percentage) return b.percentage - a.percentage;
          return b.correctVotes - a.correctVotes;
        });
        setTopVoters(voterArray.slice(0, 3));
      } else {
        setTopVoters([]);
      }

      setLoading(false);
    };

    fetchStats();
  }, [gameId, fetchHistoryForGame]);

  const handleExportHTML = () => {
    exportHTML({
      easiest,
      hardest,
      mostMovedPackage,
      topVoters,
      history: rawHistory,
      participantMap,
      label: currentGameLabel,
    });
  };

  const handleExportExcel = () => {
    exportExcel({
      easiest,
      hardest,
      mostMovedPackage,
      topVoters,
      history: rawHistory,
      participantMap,
      label: currentGameLabel,
    });
  };

  const handleGameSelect = (value: string) => {
    if (value === 'current') {
      navigate('/summary');
    } else {
      navigate(`/summary?gameId=${value}`);
    }
  };

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
        <header className="text-center mb-8">
          <h1 className="font-display text-4xl md:text-6xl text-gradient-gold mb-4">
            🏆 Spelsammanfattning
          </h1>
          <p className="text-muted-foreground text-lg mb-4">
            {currentGameLabel}
          </p>

          {/* Game selector */}
          {archivedGames.length > 0 && (
            <div className="flex justify-center">
              <Select value={gameId ?? 'current'} onValueChange={handleGameSelect}>
                <SelectTrigger className="w-64 bg-card/80 backdrop-blur border-border">
                  <SelectValue placeholder="Välj spel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Aktuellt spel</SelectItem>
                  {archivedGames.map((game) => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.year} — {game.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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

          {/* Best voters - Top 3 */}
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Award className="w-6 h-6 text-gold" />
                Bästa röstarna
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topVoters.length > 0 ? (
                <div className="space-y-4 py-2">
                  {topVoters.map((voter, index) => (
                    <div key={voter.name} className="flex items-center gap-3">
                      <span className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                      <div className="flex-1">
                        <p className={`font-display ${index === 0 ? 'text-2xl text-gradient-gold' : 'text-lg text-foreground'}`}>
                          {voter.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {voter.correctVotes} rätt av {voter.totalVotes} ({voter.percentage}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Ingen data</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-8">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka till Admin
          </Button>
          <Button variant="outline" onClick={handleExportHTML}>
            <Download className="w-4 h-4 mr-2" />
            Exportera HTML
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportera Excel
          </Button>
        </div>
      </div>
    </div>
  );
}
