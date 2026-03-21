import { useState, useEffect, useRef } from 'react';

interface VoteCountdownProps {
  isActive: boolean;
  duration?: number;
  gracePeriod?: number;
  onExpire?: () => void;
}

export function VoteCountdown({ isActive, duration = 30, gracePeriod = 5, onExpire }: VoteCountdownProps) {
  // Total ticks = duration + gracePeriod; grace phase starts when timeLeft <= gracePeriod
  const [timeLeft, setTimeLeft] = useState(duration + gracePeriod);
  const expiredCalled = useRef(false);

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(duration + gracePeriod);
      expiredCalled.current = false;
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 0 && !expiredCalled.current) {
          expiredCalled.current = true;
          onExpire?.();
        }
        return Math.max(next, 0);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, duration, gracePeriod, onExpire]);

  if (!isActive) return null;

  const inGrace = timeLeft <= gracePeriod && timeLeft > 0;
  const expired = timeLeft <= 0;
  const isUrgent = timeLeft <= 10;

  return (
    <div className={`text-center py-3 px-4 rounded-xl border ${
      expired
        ? 'bg-destructive/30 border-destructive'
        : isUrgent
          ? 'bg-destructive/20 border-destructive animate-pulse'
          : 'bg-gold/20 border-gold'
    }`}>
      {inGrace ? (
        <>
          <p className="text-sm text-destructive">⏱️ Tid ute — sista sekunder!</p>
          <p className="font-display text-2xl text-destructive">{timeLeft}s</p>
        </>
      ) : expired ? (
        <p className="text-sm text-destructive font-medium">⛔ Röstningen är stängd</p>
      ) : (
        <>
          <p className={`text-sm ${isUrgent ? 'text-destructive' : 'text-gold'}`}>
            ⏱️ Väntar på sista rösten...
          </p>
          <p className={`font-display text-2xl ${isUrgent ? 'text-destructive' : 'text-gold'}`}>
            {timeLeft - gracePeriod}s
          </p>
        </>
      )}
    </div>
  );
}
