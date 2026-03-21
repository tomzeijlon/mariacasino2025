import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface VoteCount {
  participantId: string;
  participantName: string;
  count: number;
}

function isVoteCount(v: unknown): v is VoteCount {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as VoteCount).participantId === 'string' &&
    typeof (v as VoteCount).participantName === 'string' &&
    typeof (v as VoteCount).count === 'number'
  );
}

export function parseVoteResults(results: unknown): VoteCount[] {
  try {
    const parsed = typeof results === 'string' ? JSON.parse(results) : results;
    if (Array.isArray(parsed) && parsed.every(isVoteCount)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}
