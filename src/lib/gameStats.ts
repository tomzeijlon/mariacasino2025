import { parseVoteResults } from '@/lib/utils';

// Pure game-statistics helpers shared by the summary page and the exports.
//
// Package model (confirmed game rule): every participant starts holding their own
// package. When the package held by A is voted to B, A and B swap packages
// (A gets B's old package). A package is identified by the participant who held
// it at the start of the game ("package key").

export interface HistoryEntry {
  id: string;
  participant_id: string | null;
  package_owner_id: string | null;
  locked_participant_id: string | null;
  original_package_owner_id?: string | null;
  results: unknown;
  move_count: number;
  correct_voters: unknown;
  created_at: string;
}

export interface ParticipantStat {
  id: string;
  name: string;
  totalVotes: number;
  wrongVotes: number;
  roundCount: number;
}

export interface VoterStat {
  name: string;
  correctVotes: number;
  totalVotes: number;
  percentage: number;
}

export interface PackageStat {
  ownerId: string;
  ownerName: string;
  moveCount: number;
}

export interface GameStats {
  easiest: ParticipantStat | null;
  hardest: ParticipantStat | null;
  mostMovedPackage: PackageStat | null;
  topVoters: VoterStat[];
  allVoters: VoterStat[];
  history: HistoryEntry[];
  participantMap: Map<string, string>;
  /** history entry id -> participant finally locked as the correct owner of that round's package */
  correctOwnerByEntry: Map<string, string>;
  label: string;
}

type ReplayEntry = Pick<HistoryEntry, 'id' | 'participant_id' | 'package_owner_id' | 'results' | 'created_at'>;

export interface PackageReplay {
  /** history entry id -> package key voted on in that round */
  packageByEntry: Map<string, string>;
  /** history entry id -> number of times that package had moved after the round */
  moveCountByEntry: Map<string, number>;
  /** package key -> total number of moves */
  movesByPackage: Map<string, number>;
  /** participant id -> package key currently held */
  holdings: Map<string, string>;
}

const holderOf = (entry: Pick<HistoryEntry, 'participant_id' | 'package_owner_id'>) =>
  entry.participant_id ?? entry.package_owner_id ?? null;

/** Replays the rounds in chronological order, tracking which package each person holds. */
export function replayPackages(history: ReplayEntry[]): PackageReplay {
  const sorted = [...history].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const holdings = new Map<string, string>();
  const packageByEntry = new Map<string, string>();
  const moveCountByEntry = new Map<string, number>();
  const movesByPackage = new Map<string, number>();
  const held = (person: string) => holdings.get(person) ?? person;

  for (const entry of sorted) {
    const holder = holderOf(entry);
    if (!holder) continue;
    const pkg = held(holder);
    packageByEntry.set(entry.id, pkg);

    const winner = parseVoteResults(entry.results)[0]?.participantId;
    if (winner && winner !== holder) {
      const winnersOldPkg = held(winner);
      holdings.set(winner, pkg);
      holdings.set(holder, winnersOldPkg);
      movesByPackage.set(pkg, (movesByPackage.get(pkg) ?? 0) + 1);
    }
    moveCountByEntry.set(entry.id, movesByPackage.get(pkg) ?? 0);
  }

  return { packageByEntry, moveCountByEntry, movesByPackage, holdings };
}

/** Package key currently held by `participantId` after replaying `history`. */
export function packageHeldBy(history: ReplayEntry[], participantId: string): string {
  return replayPackages(history).holdings.get(participantId) ?? participantId;
}

/** Ids of every history entry in which the given package was voted on. */
export function entriesForPackage(history: ReplayEntry[], packageKey: string): string[] {
  const { packageByEntry } = replayPackages(history);
  return history.filter(e => packageByEntry.get(e.id) === packageKey).map(e => e.id);
}

export function parseVoterVotes(correctVoters: unknown): Record<string, string> {
  try {
    if (typeof correctVoters === 'string') return JSON.parse(correctVoters) ?? {};
    if (correctVoters && typeof correctVoters === 'object') return correctVoters as Record<string, string>;
  } catch {
    // ignore unparseable data
  }
  return {};
}

export function computeGameStats(
  history: HistoryEntry[],
  participantMap: Map<string, string>,
  label: string,
): GameStats {
  const nameOf = (id: string) => participantMap.get(id) || 'Okänd';
  const { packageByEntry, movesByPackage } = replayPackages(history);

  // Correct owner per package: whoever was locked on any round of that package.
  const correctOwnerByPackage = new Map<string, string>();
  for (const entry of history) {
    const pkg = packageByEntry.get(entry.id);
    if (pkg && entry.locked_participant_id) correctOwnerByPackage.set(pkg, entry.locked_participant_id);
  }
  const correctOwnerByEntry = new Map<string, string>();
  for (const entry of history) {
    const pkg = packageByEntry.get(entry.id);
    const owner = pkg ? correctOwnerByPackage.get(pkg) : undefined;
    if (owner) correctOwnerByEntry.set(entry.id, owner);
  }

  // Easiest / hardest to guess (per correct owner, counting wrong votes over all rounds of their package)
  const participantStats = new Map<string, ParticipantStat>();
  for (const entry of history) {
    const ownerId = correctOwnerByEntry.get(entry.id);
    if (!ownerId) continue;
    const results = parseVoteResults(entry.results);
    const totalVotes = results.reduce((sum, r) => sum + r.count, 0);
    const correctVotes = results.find(r => r.participantId === ownerId)?.count || 0;
    const stat = participantStats.get(ownerId) ?? { id: ownerId, name: nameOf(ownerId), totalVotes: 0, wrongVotes: 0, roundCount: 0 };
    stat.totalVotes += totalVotes;
    stat.wrongVotes += totalVotes - correctVotes;
    stat.roundCount += 1;
    participantStats.set(ownerId, stat);
  }
  const statsArray = [...participantStats.values()];
  const easiest = statsArray.length
    ? [...statsArray].sort((a, b) => a.wrongVotes - b.wrongVotes || a.roundCount - b.roundCount)[0]
    : null;
  const hardest = statsArray.length
    ? [...statsArray].sort((a, b) => b.wrongVotes - a.wrongVotes || b.roundCount - a.roundCount)[0]
    : null;

  // Most moved package (named after who held it at the start)
  let mostMovedPackage: PackageStat | null = null;
  for (const [pkg, moveCount] of movesByPackage) {
    if (moveCount > 0 && (!mostMovedPackage || moveCount > mostMovedPackage.moveCount)) {
      mostMovedPackage = { ownerId: pkg, ownerName: nameOf(pkg), moveCount };
    }
  }

  // Best voters: a vote is correct if it named the package's finally locked owner.
  // The round's package holder's own vote is excluded.
  const voterTotal = new Map<string, number>();
  const voterCorrect = new Map<string, number>();
  for (const entry of history) {
    const ownerId = correctOwnerByEntry.get(entry.id);
    if (!ownerId) continue;
    const holder = holderOf(entry);
    const holderName = holder ? participantMap.get(holder) : undefined;
    for (const [voterName, votedForId] of Object.entries(parseVoterVotes(entry.correct_voters))) {
      if (holderName && voterName === holderName) continue;
      voterTotal.set(voterName, (voterTotal.get(voterName) || 0) + 1);
      if (votedForId === ownerId) voterCorrect.set(voterName, (voterCorrect.get(voterName) || 0) + 1);
    }
  }
  const allVoters: VoterStat[] = [...voterTotal.entries()]
    .map(([name, total]) => {
      const correct = voterCorrect.get(name) || 0;
      return { name, correctVotes: correct, totalVotes: total, percentage: Math.round((correct / total) * 100) };
    })
    .sort((a, b) => b.percentage - a.percentage || b.correctVotes - a.correctVotes);

  return {
    easiest,
    hardest,
    mostMovedPackage,
    topVoters: allVoters.slice(0, 3),
    allVoters,
    history,
    participantMap,
    correctOwnerByEntry,
    label,
  };
}
