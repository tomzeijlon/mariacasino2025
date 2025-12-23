import { useState, useEffect, useRef } from 'react';
import { useVoting } from '@/hooks/useVoting';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { Snowfall } from '@/components/Snowfall';
import { VoteChart } from '@/components/VoteChart';
import { ParticipantManager } from '@/components/ParticipantManager';
import { VotingHistory } from '@/components/VotingHistory';
import { AdminPasswordGate } from '@/components/AdminPasswordGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, StopCircle, Gift, Users, BarChart3, History, RotateCcw, Trophy, SkipForward, UserX, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });
  const [showResults, setShowResults] = useState(false);
  const prevVoteCount = useRef(0);
  const { playAllVoted, playLocked } = useSoundEffects();
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
    getNextParticipant,
    markVotingComplete,
    endAndProceedToNext,
    resetGame,
    startTiebreaker,
    clearTiebreaker,
    getTiebreakerCandidates,
  } = useVoting();

  const currentParticipant = getCurrentParticipant();
  const voteCounts = getVoteCounts();
  const tiebreakerCandidates = getTiebreakerCandidates();
  const totalVotes = votes.length;
  const totalVotersExpected = participants.filter(p => !p.is_locked).length;
  const allVoted = totalVotes >= totalVotersExpected && totalVotersExpected > 0;

  // Check for tie
  const getTopTiedCandidates = () => {
    if (voteCounts.length < 2) return null;
    const topCount = voteCounts[0].count;
    const tied = voteCounts.filter(v => v.count === topCount && v.count > 0);
    if (tied.length > 1) return tied;
    return null;
  };
  const tiedCandidates = allVoted ? getTopTiedCandidates() : null;

  // Get voters who haven't voted yet
  const voterNames = votes.map(v => v.voter_name).filter(Boolean);
  const uniqueVoterNames = [...new Set(voterNames)];
  const missingVoters = totalVotersExpected - uniqueVoterNames.length;

  // Play sound when all voted
  useEffect(() => {
    if (session?.is_active && allVoted && prevVoteCount.current < totalVotersExpected) {
      playAllVoted();
      setShowResults(true);
    }
    prevVoteCount.current = totalVotes;
  }, [allVoted, session?.is_active, playAllVoted, totalVotes, totalVotersExpected]);

  // Reset showResults when new voting starts
  useEffect(() => {
    if (session?.is_active) {
      setShowResults(false);
      prevVoteCount.current = 0;
    }
  }, [session?.id]);

  const handleReset = async () => {
    await resetVoting();
    setShowResults(false);
    toast.success('Röstningen har nollställts');
  };

  const handleEnd = async () => {
    // Don't allow ending if there's a tie - must do tiebreaker first
    if (tiedCandidates) {
      toast.error('Lika röstetal! Starta omröstning mellan de bundna först.');
      return;
    }
    
    const winner = voteCounts[0];
    if (winner && currentParticipant) {
      await markVotingComplete(currentParticipant.id, winner.participantId);
    }
    await endVoting(true, winner?.participantId);
    clearTiebreaker();
    toast.success('Omröstningen har avslutats');
  };

  const handleLockParticipant = async (id: string) => {
    const { error } = await lockParticipant(id);
    if (!error) {
      playLocked();
    }
    return { error };
  };

  const handleStartTiebreaker = async () => {
    if (!currentParticipant || !tiedCandidates) return;
    
    const candidateIds = tiedCandidates.map(c => c.participantId);
    const candidateNames = tiedCandidates.map(c => c.participantName).join(', ');
    
    // Start tiebreaker with only tied candidates
    await startTiebreaker(currentParticipant.id, candidateIds);
    
    toast.success(`Omröstning mellan: ${candidateNames}`);
  };

  const handleStartNextVoting = async () => {
    setShowResults(false);
    clearTiebreaker();
    
    if (session?.is_active && currentParticipant) {
      // Check for tie first
      if (tiedCandidates) {
        toast.error('Lika röstetal! Starta omröstning mellan de bundna först.');
        return;
      }
      
      // End current voting first with the winner
      const winner = voteCounts[0];
      if (winner) {
        await endAndProceedToNext(winner.participantId);
        toast.success('Gick vidare till nästa röstning');
      } else {
        toast.error('Inga röster att basera vinnare på');
      }
    } else {
      // No active session, just start with first eligible
      const next = getNextParticipant();
      if (next) {
        await startVoting(next.id);
        toast.success(`Omröstning för ${next.name}s paket har startat!`);
      } else {
        toast.info('Inga fler deltagare att rösta om');
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

  const voteUrl = `${window.location.origin}/vote`;

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
    <div className="min-h-screen gradient-festive relative overflow-hidden">
      <Snowfall />
      
      <div className="relative z-10 container mx-auto px-4 py-4">
        {/* Header - compact */}
        <header className="text-center mb-4">
          <h1 className="font-display text-2xl md:text-4xl text-gradient-gold mb-2">
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

        <div className="grid lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
          {/* Participants Management */}
          <Card className="bg-card/80 backdrop-blur border-border">
            <CardHeader className="pb-2 py-2">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Users className="w-4 h-4 text-gold" />
                Deltagare ({participants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <ParticipantManager
                participants={participants}
                onAdd={addParticipant}
                onRemove={removeParticipant}
                onLock={handleLockParticipant}
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
            <CardHeader className="pb-2 py-2">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <BarChart3 className="w-4 h-4 text-gold" />
                Röstningsresultat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 py-2">
              {/* Current voting info */}
              {currentParticipant ? (
                <div className="p-2 rounded-lg bg-primary/20 border border-primary">
                  <p className="text-xs text-muted-foreground">
                    {tiebreakerCandidates ? '⚖️ Omröstning (lika):' : 'Pågående omröstning:'}
                  </p>
                  <p className="font-display text-lg text-gradient-gold">
                    {currentParticipant.name}s paket
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {totalVotes}/{totalVotersExpected} röster
                  </p>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-muted border border-border">
                  <p className="text-muted-foreground text-center text-sm">
                    Ingen omröstning pågår
                  </p>
                </div>
              )}

              {/* Who hasn't voted */}
              {session?.is_active && missingVoters > 0 && (
                <div className="p-2 rounded-lg bg-gold/10 border border-gold/30">
                  <div className="flex items-center gap-2 text-gold text-sm">
                    <UserX className="w-4 h-4" />
                    <span>{missingVoters} saknar röst</span>
                  </div>
                  {uniqueVoterNames.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Röstat: {uniqueVoterNames.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Tie warning */}
              {tiedCandidates && showResults && (
                <div className="p-2 rounded-lg bg-gold/20 border border-gold animate-pulse">
                  <div className="flex items-center gap-2 text-gold font-medium text-sm">
                    <Scale className="w-4 h-4" />
                    <span>Lika! {tiedCandidates.map(c => c.participantName).join(' vs ')}</span>
                  </div>
                </div>
              )}

              {/* Results chart - only show when showResults or voting ended */}
              {session?.is_active && (
                <>
                  {showResults ? (
                    <VoteChart voteCounts={voteCounts} totalVotes={totalVotes} />
                  ) : (
                    <div className="py-4 text-center text-muted-foreground text-sm">
                      Resultat visas när alla röstat...
                    </div>
                  )}
                  
                  {/* Control buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="flex-1"
                      size="sm"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Nollställ
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowResults(true)}
                      className="flex-1"
                      size="sm"
                      disabled={showResults}
                    >
                      Visa
                    </Button>
                    {tiedCandidates ? (
                      <Button
                        variant="festive"
                        onClick={handleStartTiebreaker}
                        className="flex-1"
                        size="sm"
                      >
                        <Scale className="w-3 h-3 mr-1" />
                        Omrösta
                      </Button>
                    ) : (
                      <Button
                        variant="festive"
                        onClick={handleStartNextVoting}
                        className="flex-1"
                        size="sm"
                      >
                        <SkipForward className="w-3 h-3 mr-1" />
                        Nästa
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={handleEnd}
                      className="flex-1"
                      size="sm"
                    >
                      <StopCircle className="w-3 h-3" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* QR Code + History */}
          <div className="space-y-4">
            {/* QR Code */}
            <Card className="bg-card/80 backdrop-blur border-border">
              <CardHeader className="pb-2 py-2">
                <CardTitle className="font-display text-lg text-center">
                  📱 Skanna för att rösta
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center py-2">
                <div className="bg-background p-3 rounded-lg">
                  <QRCodeSVG value={voteUrl} size={120} />
                </div>
              </CardContent>
            </Card>

            {/* Voting History */}
            <Card className="bg-card/80 backdrop-blur border-border">
              <CardHeader className="pb-2 py-2">
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <History className="w-4 h-4 text-gold" />
                  Historik
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 max-h-[250px] overflow-y-auto">
                <VotingHistory />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}