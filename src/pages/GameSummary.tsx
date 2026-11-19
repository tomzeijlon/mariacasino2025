import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Snowfall } from '@/components/Snowfall';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, TrendingUp, TrendingDown, Package, Award, ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { computeGameStats, type GameStats, type HistoryEntry, type ParticipantStat, type PackageStat, type VoterStat } from '@/lib/gameStats';
import { useVoting, type ArchivedGame } from '@/hooks/useVoting';
import { exportHTML } from '@/lib/exportHTML';
import { exportExcel } from '@/lib/exportExcel';

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

      const pMap = new Map(participants.map(p => [p.id, p.name]));
      const stats = computeGameStats(history, pMap, '');
      setParticipantMap(pMap);
      setRawHistory(history);
      setEasiest(stats.easiest);
      setHardest(stats.hardest);
      setMostMovedPackage(stats.mostMovedPackage);
      setTopVoters(stats.topVoters);
      setLoading(false);
    };

    fetchStats();
  }, [gameId, fetchHistoryForGame]);

  const buildExportStats = (): GameStats => computeGameStats(rawHistory, participantMap, currentGameLabel);

  const handleExportHTML = () => exportHTML(buildExportStats());

  const handleExportExcel = () => exportExcel(buildExportStats());

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
