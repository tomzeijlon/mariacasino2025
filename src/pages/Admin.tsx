import { useVoting } from '@/hooks/useVoting';
import { Snowfall } from '@/components/Snowfall';
import { VoteChart } from '@/components/VoteChart';
import { ParticipantManager } from '@/components/ParticipantManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, StopCircle, Gift, Users, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function Admin() {
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
  } = useVoting();

  const currentParticipant = getCurrentParticipant();
  const voteCounts = getVoteCounts();
  const totalVotes = votes.length;

  const handleReset = async () => {
    await resetVoting();
    toast.success('Röstningen har nollställts');
  };

  const handleEnd = async () => {
    await endVoting();
    toast.success('Omröstningen har avslutats');
  };

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
            🎄 Julklappslek Admin
          </h1>
          <p className="text-muted-foreground text-lg">
            Hantera deltagare och kontrollera omröstningar
          </p>
          <Link to="/vote" className="inline-block mt-4">
            <Button variant="outline" size="sm">
              Öppna röstningssidan →
            </Button>
          </Link>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
