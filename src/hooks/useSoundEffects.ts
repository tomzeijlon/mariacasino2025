import { useCallback, useRef } from 'react';

// Sound URLs (using free sound effects)
const SOUNDS = {
  allVoted: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Pling
  locked: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Fanfare
};

export function useSoundEffects() {
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const playSound = useCallback((soundType: keyof typeof SOUNDS) => {
    const url = SOUNDS[soundType];
    
    // Reuse or create audio element
    if (!audioRefs.current[soundType]) {
      audioRefs.current[soundType] = new Audio(url);
    }
    
    const audio = audioRefs.current[soundType];
    audio.currentTime = 0;
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore autoplay errors
    });
  }, []);

  const playAllVoted = useCallback(() => playSound('allVoted'), [playSound]);
  const playLocked = useCallback(() => playSound('locked'), [playSound]);

  return {
    playAllVoted,
    playLocked,
  };
}
