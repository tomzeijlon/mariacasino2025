import { useState } from 'react';
import { useVoting } from '@/hooks/useVoting';
import { Snowfall } from '@/components/Snowfall';
import { VoteChart } from '@/components/VoteChart';
import { ParticipantManager } from '@/components/ParticipantManager';
import { VotingHistory } from '@/components/VotingHistory';
import { AdminPasswordGate } from '@/components/AdminPasswordGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, StopCircle, Gift, Users, BarChart3, History, RotateCcw, Trophy, Package } from 'lucide-react';
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
    // Get winner before ending
    const winner = voteCounts[0];
    if (winner && currentParticipant) {
      await markVotingComplete(currentParticipant.id, winner.participantId);
    }
    await endVoting();
    toast.success('Omröstningen har avslutats');
  };

  const handleStartNextVoting = async () => {
    const next = getNextParticipant();
    if (next) {
      await startVoting(next.id);
      toast.success(`Omröstning för ${next.name}s paket har startat!`);
    } else {
      toast.info('Ingen fler deltagare att rösta om');
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
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-6xl text-gradient-gold mb-4">
            🎰 Maria Casino Admin
          </h1>
          <p className="text-muted-foreground text-lg">
            Hantera deltagare och kontrollera omröstningar
          </p>
          <div className="flex gap-4 justify-center mt-4">
            <Link to="/vote">
              <Button variant="outline" size="sm">
                Öppna röstningssidan →
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleResetGame}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Återställ spel
            </Button>
            <Button variant="festive" size="sm" onClick={handleEndGame}>
              <Trophy className="w-4 h-4 mr-2" />
              Avsluta spelet
            </Button>
          </div>
        </header>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Participants Management */}
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <Users className="w-6 h-6 text-gold" />
                Deltagare
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <BarChart3 className="w-6 h-6 text-gold" />
                Röstningsresultat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current voting info */}
              {currentParticipant ? (
                <div className="p-4 rounded-xl bg-primary/20 border border-primary">
                  <p className="text-sm text-muted-foreground mb-1">Pågående omröstning:</p>
                  <p className="font-display text-2xl text-gradient-gold">
                    {currentParticipant.name}s paket
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {totalVotes} {totalVotes === 1 ? 'röst' : 'röster'} hittills
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted border border-border">
                  <p className="text-muted-foreground text-center">
                    Ingen omröstning pågår. Välj en deltagare att rösta om.
                  </p>
                </div>
              )}

              {/* Results chart */}
              {session?.is_active && (
                <>
                  <VoteChart voteCounts={voteCounts} totalVotes={totalVotes} />
                  
                  {/* Control buttons */}
                  <div className="flex gap-4 pt-4">
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="flex-1"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Nollställ röster
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleEnd}
                      className="flex-1"
                    >
                      <StopCircle className="w-4 h-4 mr-2" />
                      Avsluta
                    </Button>
                  </div>
                </>
              )}

              {/* Package status */}
              {!session?.is_active && (
                <div className="border-t border-border pt-4 mt-4">
                  <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Klicka på "Har paket" för att markera/avmarkera
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {participants.filter(p => !p.is_locked).map(p => (
                      <Button
                        key={p.id}
                        variant={p.has_received_package ? "festive" : "outline"}
                        size="sm"
                        onClick={() => handleTogglePackage(p.id, p.has_received_package)}
                      >
                        {p.name}
                        {p.has_received_package && " ✓"}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Voting History */}
        <div className="max-w-6xl mx-auto mt-8">
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <History className="w-6 h-6 text-gold" />
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
