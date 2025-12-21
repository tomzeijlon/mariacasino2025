import { VoteCount } from '@/hooks/useVoting';

interface VoteChartProps {
  voteCounts: VoteCount[];
  totalVotes: number;
}

export function VoteChart({ voteCounts, totalVotes }: VoteChartProps) {
  const maxCount = Math.max(...voteCounts.map(v => v.count), 1);

  return (
    <div className="space-y-4">
      {voteCounts.map((vote, index) => {
        const percentage = totalVotes > 0 ? (vote.count / totalVotes) * 100 : 0;
        const widthPercent = maxCount > 0 ? (vote.count / maxCount) * 100 : 0;
        
        return (
          <div key={vote.participantId} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-display text-lg text-foreground">
                {index === 0 && vote.count > 0 && '👑 '}
                {vote.participantName}
              </span>
              <span className="text-gold font-semibold">
                {vote.count} {vote.count === 1 ? 'röst' : 'röster'} ({percentage.toFixed(0)}%)
              </span>
            </div>
            <div className="h-8 bg-muted rounded-lg overflow-hidden">
              <div
                className="h-full gradient-gold animate-bar-grow rounded-lg flex items-center justify-end pr-3"
                style={{ width: `${widthPercent}%` }}
              >
                {vote.count > 0 && (
                  <span className="text-accent-foreground font-bold text-sm">
                    {vote.count}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      
      {voteCounts.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Inga röstbara deltagare. Lägg till deltagare och starta en omröstning.
        </p>
      )}
    </div>
  );
}
