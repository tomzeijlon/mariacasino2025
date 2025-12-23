import { useState } from 'react';
import { useVoting } from '@/hooks/useVoting';
import { Snowfall } from '@/components/Snowfall';
import { VoteChart } from '@/components/VoteChart';
import { ParticipantManager } from '@/components/ParticipantManager';
import { VotingHistory } from '@/components/VotingHistory';
import { AdminPasswordGate } from '@/components/AdminPasswordGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, StopCircle, Gift, Users, BarChart3, History, RotateCcw, Trophy, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });
  const navigate = useNavigate();

  const {
    participants,
    session,
    loading,
    addParticipant,
    removeParticipant,
    lockParticipant,
    unlockParticipant,
    startVoting,
    resetVoting,
    endVoting,
    getVoteCounts,
    getCurrentParticipant,
    votes,
    updateParticipantOrder,
    setHasReceivedPackage,
    getNextParticipant,
    markVotingComplete,
    endAndProceedToNext,
    resetGame,
  } = useVoting();

  const currentParticipant = getCurrentParticipant();
  const voteCounts = getVoteCounts();
  const totalVotes = votes.length;

  const handleReset = async () => {
    await resetVoting();
    toast.success('Röstningen har nollställts');
  };

  const handleEnd = async () => {
    const winner = voteCounts[0];
    if (winner && currentParticipant) {
      await markVotingComplete(currentParticipant.id, winner.participantId);
    }
    await endVoting(true, winner?.participantId);
    toast.success('Omröstningen har avslutats');
  };

  const handleStartNextVoting = async () => {
    if (session?.is_active && currentParticipant) {
      // End current voting first with the winner
      const winner = voteCounts[0];
      if (winner) {
        await endAndProceedToNext(winner.participantId);
        toast.success('Gick vidare till nästa röstning');
      } else {
        toast.error('Ingen röster att basera vinnare på');
      }
    } else {
      // No active session, just start with first eligible
      const next = getNextParticipant();
      if (next) {
        await startVoting(next.id);
        toast.success(`Omröstning för ${next.name}s paket har startat!`);
      } else {
        toast.info('Ingen fler deltagare att rösta om');
      }
    }
  };

  const handleResetGame = async () => {
    if (window.confirm('Är du säker på att du vill återställa hela spelet? Detta tar bort all historik men behåller deltagarnamnen.')) {
      await resetGame();
      toast.success('Spelet har återställts');
    }
  };

  const handleEndGame = () => {
    navigate('/summary');
  };

  const handleTogglePackage = async (participantId: string, hasPackage: boolean) => {
    await setHasReceivedPackage(participantId, !hasPackage);
  };

  if (!isAuthenticated) {
    return <AdminPasswordGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-festive flex items-center justify-center">
        <Snowfall />
        <div className="text-center">
          <Gift className="w-16 h-16 mx-auto text-gold animate-float mb-4" />
          <p className="text-foreground font-display text-xl">Laddar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-festive relative">
      <Snowfall />
      
      <div className="relative z-10 container mx-auto px-4 py-6">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-5xl text-gradient-gold mb-3">
            🎰 Maria Casino Admin
          </h1>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link to="/vote">
              <Button variant="outline" size="sm">
                Röstningssidan →
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleResetGame}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Återställ
            </Button>
            <Button variant="festive" size="sm" onClick={handleEndGame}>
              <Trophy className="w-4 h-4 mr-1" />
              Avsluta spelet
            </Button>
          </div>
        </header>

        <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Participants Management */}
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Users className="w-5 h-5 text-gold" />
                Deltagare ({participants.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ParticipantManager
                participants={participants}
                onAdd={addParticipant}
                onRemove={removeParticipant}
                onLock={lockParticipant}
                onUnlock={unlockParticipant}
                onStartVoting={startVoting}
                onUpdateOrder={updateParticipantOrder}
                onStartNextVoting={handleStartNextVoting}
                currentVotingId={session?.current_participant_id || null}
              />
            </CardContent>
          </Card>

          {/* Voting Results */}
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <BarChart3 className="w-5 h-5 text-gold" />
                Röstningsresultat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current voting info */}
              {currentParticipant ? (
                <div className="p-3 rounded-xl bg-primary/20 border border-primary">
                  <p className="text-xs text-muted-foreground mb-1">Pågående omröstning:</p>
                  <p className="font-display text-xl text-gradient-gold">
                    {currentParticipant.name}s paket
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {totalVotes} {totalVotes === 1 ? 'röst' : 'röster'}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-muted border border-border">
                  <p className="text-muted-foreground text-center text-sm">
                    Ingen omröstning pågår
                  </p>
                </div>
              )}

              {/* Results chart */}
              {session?.is_active && (
                <>
                  <VoteChart voteCounts={voteCounts} totalVotes={totalVotes} />
                  
                  {/* Control buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="flex-1"
                      size="sm"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Nollställ
                    </Button>
                    <Button
                      variant="festive"
                      onClick={handleStartNextVoting}
                      className="flex-1"
                      size="sm"
                    >
                      <SkipForward className="w-4 h-4 mr-1" />
                      Nästa
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleEnd}
                      className="flex-1"
                      size="sm"
                    >
                      <StopCircle className="w-4 h-4 mr-1" />
                      Avsluta
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Voting History */}
        <div className="max-w-6xl mx-auto mt-6">
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <History className="w-5 h-5 text-gold" />
                Röstningshistorik
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VotingHistory />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
