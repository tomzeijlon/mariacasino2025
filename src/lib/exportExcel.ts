import * as XLSX from 'xlsx';
import { parseVoteResults } from '@/lib/utils';
import { parseVoterVotes, replayPackages, type GameStats } from '@/lib/gameStats';

export function exportExcel(stats: GameStats): void {
  const { easiest, hardest, mostMovedPackage, topVoters, allVoters, history, participantMap, correctOwnerByEntry, label } = stats;
  const { moveCountByEntry } = replayPackages(history);
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Sammanfattning ──────────────────────────────────────────────────
  const summaryRows: (string | number)[][] = [
    ['Maria Casino — ' + label],
    [],
    ['Bästa röstarna', '', '', ''],
    ['Rank', 'Namn', 'Rätt', 'Totalt', 'Procent'],
    ...topVoters.map((v, i) => [i + 1, v.name, v.correctVotes, v.totalVotes, v.percentage + '%']),
    [],
    ['Lättast att gissa'],
    ['Namn', 'Omgångar', 'Felaktiga röster'],
    easiest ? [easiest.name, easiest.roundCount, easiest.wrongVotes] : ['(ingen data)'],
    [],
    ['Svårast att gissa'],
    ['Namn', 'Omgångar', 'Felaktiga röster'],
    hardest ? [hardest.name, hardest.roundCount, hardest.wrongVotes] : ['(ingen data)'],
    [],
    ['Mest flyttade paketet'],
    ['Ursprungsägare', 'Antal förflyttningar'],
    mostMovedPackage ? [mostMovedPackage.ownerName, mostMovedPackage.moveCount] : ['(inga förflyttningar)'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Sammanfattning');

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
  const wsRounds = XLSX.utils.aoa_to_sheet([roundHeader, ...roundData]);
  wsRounds['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsRounds, 'Omgångar');

  // ── Sheet 3: Röstare ─────────────────────────────────────────────────────────
  const voterHeader = ['Namn', 'Rätt', 'Totalt', 'Procent'];
  const voterData = allVoters.map(v => [v.name, v.correctVotes, v.totalVotes, v.percentage + '%']);
  const wsVoters = XLSX.utils.aoa_to_sheet([voterHeader, ...voterData]);
  wsVoters['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsVoters, 'Röstare');

  // ── Sheet 4: Deltagardetaljer ────────────────────────────────────────────────
  // One row per (voter, round) showing who they voted for and if correct
  const detailHeader = ['Röstare', 'Omgång', 'Pakethållare', 'Röstade på', 'Rätt ägare', 'Rätt?'];
  const detailData: (string | number)[][] = [];

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

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailData]);
  wsDetail['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Deltagardetaljer');

  XLSX.writeFile(wb, `maria-casino-${label.replace(/[^a-zA-Z0-9åäöÅÄÖ]/g, '-')}.xlsx`);
}
