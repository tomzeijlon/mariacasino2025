import * as XLSX from 'xlsx';
import { parseVoteResults } from '@/lib/utils';
import type { GameStats } from '@/pages/GameSummary';

export function exportExcel(stats: GameStats): void {
  const { easiest, hardest, mostMovedPackage, topVoters, history, participantMap, label } = stats;
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
    const correctVotes = entry.locked_participant_id
      ? (results.find(r => r.participantId === entry.locked_participant_id)?.count || 0)
      : 0;
    return [
      index + 1,
      holderName,
      winnerName,
      totalVotes,
      correctVotes,
      totalVotes - correctVotes,
      entry.move_count || 0,
    ];
  });
  const wsRounds = XLSX.utils.aoa_to_sheet([roundHeader, ...roundData]);
  wsRounds['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsRounds, 'Omgångar');

  // ── Sheet 3: Röstare ─────────────────────────────────────────────────────────
  const voterTotalMap = new Map<string, number>();
  const voterCorrectMap = new Map<string, number>();
  const packageToCorrectOwner = new Map<string, string>();

  history.forEach(entry => {
    if (entry.package_owner_id && entry.locked_participant_id) {
      packageToCorrectOwner.set(entry.package_owner_id, entry.locked_participant_id);
    }
  });

  history.forEach(entry => {
    const packageOwnerId = entry.package_owner_id;
    if (!packageOwnerId) return;
    const correctOwnerId = packageToCorrectOwner.get(packageOwnerId);
    if (!correctOwnerId) return;
    const packageOwnerName = participantMap.get(packageOwnerId);

    let voterVotes: Record<string, string> = {};
    try {
      if (typeof entry.correct_voters === 'string') {
        voterVotes = JSON.parse(entry.correct_voters);
      } else if (entry.correct_voters && typeof entry.correct_voters === 'object') {
        voterVotes = entry.correct_voters as Record<string, string>;
      }
    } catch { voterVotes = {}; }

    Object.entries(voterVotes).forEach(([voterName, votedForId]) => {
      if (packageOwnerName && voterName === packageOwnerName) return;
      voterTotalMap.set(voterName, (voterTotalMap.get(voterName) || 0) + 1);
      if (votedForId === correctOwnerId) {
        voterCorrectMap.set(voterName, (voterCorrectMap.get(voterName) || 0) + 1);
      }
    });
  });

  const voterHeader = ['Namn', 'Rätt', 'Totalt', 'Procent'];
  const voterData = Array.from(voterTotalMap.entries())
    .map(([name, total]) => {
      const correct = voterCorrectMap.get(name) || 0;
      return [name, correct, total, total > 0 ? Math.round((correct / total) * 100) + '%' : '0%'];
    })
    .sort((a, b) => {
      const pA = parseInt(String(a[3]));
      const pB = parseInt(String(b[3]));
      return pB - pA;
    });
  const wsVoters = XLSX.utils.aoa_to_sheet([voterHeader, ...voterData]);
  wsVoters['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsVoters, 'Röstare');

  // ── Sheet 4: Deltagardetaljer ────────────────────────────────────────────────
  // One row per (voter, round) showing who they voted for and if correct
  const detailHeader = ['Röstare', 'Omgång', 'Pakethållare', 'Röstade på', 'Rätt ägare', 'Rätt?'];
  const detailData: (string | number)[][] = [];

  history.forEach((entry, index) => {
    const packageOwnerId = entry.package_owner_id;
    const correctOwnerId = packageOwnerId ? packageToCorrectOwner.get(packageOwnerId) : undefined;
    const holderName = entry.participant_id ? (participantMap.get(entry.participant_id) || 'Okänd') : 'Okänd';
    const correctOwnerName = correctOwnerId ? (participantMap.get(correctOwnerId) || 'Okänd') : '?';

    let voterVotes: Record<string, string> = {};
    try {
      if (typeof entry.correct_voters === 'string') {
        voterVotes = JSON.parse(entry.correct_voters);
      } else if (entry.correct_voters && typeof entry.correct_voters === 'object') {
        voterVotes = entry.correct_voters as Record<string, string>;
      }
    } catch { voterVotes = {}; }

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
