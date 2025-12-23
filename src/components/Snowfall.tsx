import { useEffect, useState } from 'react';

interface Snowflake {
  id: number;
  left: number;
  animationDuration: number;
  animationDelay: number;
  opacity: number;
  size: number;
}

interface SnowfallProps {
  speed?: 'normal' | 'fast';
}

export function Snowfall({ speed = 'normal' }: SnowfallProps) {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    const baseSpeed = speed === 'fast' ? 3 : 10;
    const speedVariance = speed === 'fast' ? 5 : 20;
    
    const flakes: Snowflake[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      animationDuration: baseSpeed + Math.random() * speedVariance,
      animationDelay: Math.random() * -20,
      opacity: 0.1 + Math.random() * 0.3,
      size: 0.5 + Math.random() * 1,
    }));
    setSnowflakes(flakes);
  }, [speed]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {snowflakes.map((flake) => (
        <span
          key={flake.id}
          className="snowflake"
          style={{
            left: `${flake.left}%`,
            animationDuration: `${flake.animationDuration}s`,
            animationDelay: `${flake.animationDelay}s`,
            opacity: flake.opacity,
            fontSize: `${flake.size}rem`,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}
