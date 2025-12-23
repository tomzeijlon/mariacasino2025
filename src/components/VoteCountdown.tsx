import { useState, useEffect } from 'react';

interface VoteCountdownProps {
  isActive: boolean;
  duration?: number;
}

export function VoteCountdown({ isActive, duration = 30 }: VoteCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(duration);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, duration]);

  if (!isActive) return null;

  const isUrgent = timeLeft <= 10;

  return (
    <div className={`text-center py-3 px-4 rounded-xl border ${
      isUrgent 
        ? 'bg-destructive/20 border-destructive animate-pulse' 
        : 'bg-gold/20 border-gold'
    }`}>
      <p className={`text-sm ${isUrgent ? 'text-destructive' : 'text-gold'}`}>
        ⏱️ Väntar på sista rösten...
      </p>
      <p className={`font-display text-2xl ${isUrgent ? 'text-destructive' : 'text-gold'}`}>
        {timeLeft}s
      </p>
    </div>
  );
}
