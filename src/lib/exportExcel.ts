import writeExcelFile from 'write-excel-file/browser';
import { parseVoteResults } from '@/lib/utils';
import { parseVoterVotes, replayPackages, type GameStats } from '@/lib/gameStats';

type Cell = string | number | null;

export async function exportExcel(stats: GameStats): Promise<void> {
  const { easiest, hardest, mostMovedPackage, topVoters, allVoters, history, participantMap, correctOwnerByEntry, label } = stats;
  const { moveCountByEntry } = replayPackages(history);
  const sheets: { data: Cell[][]; sheet: string; columns: { width: number }[] }[] = [];

  // ── Sheet 1: Sammanfattning ──────────────────────────────────────────────────
  const summaryRows: Cell[][] = [
    ['Maria Casino — ' + label],
    [null],
    ['Bästa röstarna', '', '', ''],
    ['Rank', 'Namn', 'Rätt', 'Totalt', 'Procent'],
    ...topVoters.map((v, i) => [i + 1, v.name, v.correctVotes, v.totalVotes, v.percentage + '%']),
    [null],
    ['Lättast att gissa'],
    ['Namn', 'Omgångar', 'Felaktiga röster'],
    easiest ? [easiest.name, easiest.roundCount, easiest.wrongVotes] : ['(ingen data)'],
    [null],
    ['Svårast att gissa'],
    ['Namn', 'Omgångar', 'Felaktiga röster'],
    hardest ? [hardest.name, hardest.roundCount, hardest.wrongVotes] : ['(ingen data)'],
    [null],
    ['Mest flyttade paketet'],
    ['Ursprungsägare', 'Antal förflyttningar'],
    mostMovedPackage ? [mostMovedPackage.ownerName, mostMovedPackage.moveCount] : ['(inga förflyttningar)'],
  ];
  sheets.push({ data: summaryRows, sheet: 'Sammanfattning', columns: [{ width: 25 }, { width: 20 }, { width: 12 }, { width: 12 }, { width: 10 }] });

  // ── Sheet 2: Omgångar ────────────────────────────────────────────────────────
  const roundHeader = ['Omgång', 'Pakethållare', 'Vinnare', 'Röster totalt', 'Rätta röster', 'Felaktiga röster', 'Förflyttningar'];
  const roundData = history.map((entry, index) => {
    const results = parseVoteResults(entry.results);
    const winner = results[0];
    const holderName = entry.participant_id ? (participantMap.get(entry.participant_id) || 'Okänd') : 'Okänd';
    const winnerName = winner?.participantName || 'Okänd';
    const totalVotes = results.reduce((s, r) => s + r.count, 0);
    const correctOwnerId = correctOwnerByEntry.get(entry.id);
    const correctVotes = correctOwnerId
      ? (results.find(r => r.participantId === correctOwnerId)?.count || 0)
      : 0;
    return [
      index + 1,
      holderName,
      winnerName,
      totalVotes,
      correctVotes,
      totalVotes - correctVotes,
      moveCountByEntry.get(entry.id) ?? 0,
    ];
  });
  sheets.push({ data: [roundHeader, ...roundData], sheet: 'Omgångar', columns: [{ width: 8 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 16 }] });

  // ── Sheet 3: Röstare ─────────────────────────────────────────────────────────
  const voterHeader = ['Namn', 'Rätt', 'Totalt', 'Procent'];
  const voterData = allVoters.map(v => [v.name, v.correctVotes, v.totalVotes, v.percentage + '%']);
  sheets.push({ data: [voterHeader, ...voterData], sheet: 'Röstare', columns: [{ width: 20 }, { width: 8 }, { width: 8 }, { width: 10 }] });

  // ── Sheet 4: Deltagardetaljer ────────────────────────────────────────────────
  // One row per (voter, round) showing who they voted for and if correct
  const detailHeader = ['Röstare', 'Omgång', 'Pakethållare', 'Röstade på', 'Rätt ägare', 'Rätt?'];
  const detailData: Cell[][] = [];

  history.forEach((entry, index) => {
    const correctOwnerId = correctOwnerByEntry.get(entry.id);
    const holderName = entry.participant_id ? (participantMap.get(entry.participant_id) || 'Okänd') : 'Okänd';
    const correctOwnerName = correctOwnerId ? (participantMap.get(correctOwnerId) || 'Okänd') : '?';

    const voterVotes = parseVoterVotes(entry.correct_voters);

    Object.entries(voterVotes).forEach(([voterName, votedForId]) => {
      const votedForName = participantMap.get(votedForId) || votedForId;
      const isCorrect = correctOwnerId && votedForId === correctOwnerId;
      detailData.push([
        voterName,
        index + 1,
        holderName,
        votedForName,
        correctOwnerName,
        isCorrect ? 'Ja' : (correctOwnerId ? 'Nej' : '?'),
      ]);
    });
  });

  sheets.push({ data: [detailHeader, ...detailData], sheet: 'Deltagardetaljer', columns: [{ width: 18 }, { width: 8 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 8 }] });

  await writeExcelFile(sheets).toFile(`maria-casino-${label.replace(/[^a-zA-Z0-9åäöÅÄÖ]/g, '-')}.xlsx`);
}
