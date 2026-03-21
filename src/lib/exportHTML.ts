import { parseVoteResults } from '@/lib/utils';
import type { GameStats } from '@/pages/GameSummary';

export function exportHTML(stats: GameStats): void {
  const { easiest, hardest, mostMovedPackage, topVoters, history, participantMap, label } = stats;
  const exportDate = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });

  const medals = ['🥇', '🥈', '🥉'];

  // Build rounds table rows
  const roundRows = history.map((entry, index) => {
    const results = parseVoteResults(entry.results);
    const winner = results[0];
    const holderName = entry.participant_id ? (participantMap.get(entry.participant_id) || 'Okänd') : 'Okänd';
    const winnerName = winner?.participantName || 'Okänd';
    const totalVotes = results.reduce((s, r) => s + r.count, 0);
    const isMoved = holderName !== winnerName;
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${holderName}</td>
        <td>${isMoved ? `${winnerName} ↑` : '✓ ' + holderName}</td>
        <td>${totalVotes}</td>
        <td>${entry.move_count || 0}</td>
      </tr>`;
  }).join('');

  // Build voter leaderboard rows
  const voterRows: string[] = [];
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

  const sortedVoters = Array.from(voterTotalMap.entries())
    .map(([name, total]) => ({ name, total, correct: voterCorrectMap.get(name) || 0 }))
    .sort((a, b) => {
      const pctA = a.total > 0 ? a.correct / a.total : 0;
      const pctB = b.total > 0 ? b.correct / b.total : 0;
      if (pctB !== pctA) return pctB - pctA;
      return b.correct - a.correct;
    });

  sortedVoters.forEach((v, i) => {
    const pct = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
    const medal = i < 3 ? medals[i] + ' ' : '';
    voterRows.push(`
      <tr>
        <td>${medal}${v.name}</td>
        <td>${v.correct}</td>
        <td>${v.total}</td>
        <td>${pct}%</td>
      </tr>`);
  });

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Maria Casino — ${label}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #1a2e1a;
      color: #f5f0e8;
      padding: 2rem;
      min-height: 100vh;
    }
    h1 {
      font-size: 2.5rem;
      text-align: center;
      color: #d4af37;
      text-shadow: 0 0 20px rgba(212,175,55,0.4);
      margin-bottom: 0.25rem;
    }
    .subtitle {
      text-align: center;
      color: #a0956e;
      font-size: 1.1rem;
      margin-bottom: 2.5rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      max-width: 900px;
      margin: 0 auto 2.5rem;
    }
    .card {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(212,175,55,0.3);
      border-radius: 12px;
      padding: 1.5rem;
    }
    .card h2 {
      font-size: 1rem;
      color: #a0956e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }
    .card .value {
      font-size: 1.8rem;
      color: #d4af37;
      font-weight: bold;
    }
    .card .detail {
      font-size: 0.85rem;
      color: #a0956e;
      margin-top: 0.25rem;
    }
    .voters-list { list-style: none; }
    .voters-list li {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 0.9rem;
    }
    .voters-list li:last-child { border-bottom: none; }
    .voters-list li .pct { color: #d4af37; }
    section { max-width: 900px; margin: 0 auto 2.5rem; }
    section h2 {
      font-size: 1.2rem;
      color: #d4af37;
      border-bottom: 1px solid rgba(212,175,55,0.3);
      padding-bottom: 0.5rem;
      margin-bottom: 1rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      color: #a0956e;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid rgba(212,175,55,0.3);
    }
    td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    tr:hover td { background: rgba(255,255,255,0.04); }
    footer {
      text-align: center;
      color: #5a5040;
      font-size: 0.8rem;
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
  </style>
</head>
<body>
  <h1>🎅 Maria Casino</h1>
  <p class="subtitle">${label} &nbsp;•&nbsp; Julklappslek</p>

  <div class="grid">
    <div class="card">
      <h2>🟢 Lättast att gissa</h2>
      ${easiest
        ? `<div class="value">${easiest.name}</div>
           <div class="detail">${easiest.roundCount} omgång${easiest.roundCount !== 1 ? 'ar' : ''} • ${easiest.wrongVotes} felaktiga röster</div>`
        : '<div class="detail">Ingen data</div>'}
    </div>
    <div class="card">
      <h2>🔴 Svårast att gissa</h2>
      ${hardest
        ? `<div class="value">${hardest.name}</div>
           <div class="detail">${hardest.roundCount} omgång${hardest.roundCount !== 1 ? 'ar' : ''} • ${hardest.wrongVotes} felaktiga röster</div>`
        : '<div class="detail">Ingen data</div>'}
    </div>
    <div class="card">
      <h2>📦 Mest flyttade paketet</h2>
      ${mostMovedPackage
        ? `<div class="value">${mostMovedPackage.ownerName}</div>
           <div class="detail">Flyttades ${mostMovedPackage.moveCount} gång${mostMovedPackage.moveCount !== 1 ? 'er' : ''}</div>`
        : '<div class="detail">Inga paket flyttades</div>'}
    </div>
    <div class="card">
      <h2>🏆 Bästa röstarna</h2>
      ${topVoters.length > 0
        ? `<ul class="voters-list">
            ${topVoters.map((v, i) => `
              <li>
                <span>${medals[i]} ${v.name}</span>
                <span class="pct">${v.correctVotes}/${v.totalVotes} (${v.percentage}%)</span>
              </li>`).join('')}
           </ul>`
        : '<div class="detail">Ingen data</div>'}
    </div>
  </div>

  ${roundRows ? `
  <section>
    <h2>Omgångar</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Pakethållare</th>
          <th>Vinnare</th>
          <th>Röster</th>
          <th>Förflyttningar</th>
        </tr>
      </thead>
      <tbody>${roundRows}</tbody>
    </table>
  </section>` : ''}

  ${voterRows.length > 0 ? `
  <section>
    <h2>Alla röstare</h2>
    <table>
      <thead>
        <tr>
          <th>Namn</th>
          <th>Rätt</th>
          <th>Totalt</th>
          <th>Procent</th>
        </tr>
      </thead>
      <tbody>${voterRows.join('')}</tbody>
    </table>
  </section>` : ''}

  <footer>
    Exporterat ${exportDate} från Maria Casino
  </footer>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maria-casino-${label.replace(/[^a-zA-Z0-9åäöÅÄÖ]/g, '-')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
