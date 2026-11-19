import { parseVoteResults } from '@/lib/utils';
import { replayPackages, type GameStats } from '@/lib/gameStats';

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function exportHTML(stats: GameStats): void {
  const { easiest: rawEasiest, hardest: rawHardest, mostMovedPackage: rawMostMoved, topVoters: rawTopVoters, allVoters, history, participantMap } = stats;
  // Escape every user-provided string (participant and voter names, label) before it goes into HTML
  const label = escapeHtml(stats.label);
  const easiest = rawEasiest && { ...rawEasiest, name: escapeHtml(rawEasiest.name) };
  const hardest = rawHardest && { ...rawHardest, name: escapeHtml(rawHardest.name) };
  const mostMovedPackage = rawMostMoved && { ...rawMostMoved, ownerName: escapeHtml(rawMostMoved.ownerName) };
  const topVoters = rawTopVoters.map(v => ({ ...v, name: escapeHtml(v.name) }));
  const exportDate = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
  const { moveCountByEntry } = replayPackages(history);

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
        <td>${escapeHtml(holderName)}</td>
        <td>${isMoved ? `${escapeHtml(winnerName)} ↑` : '✓ ' + escapeHtml(holderName)}</td>
        <td>${totalVotes}</td>
        <td>${moveCountByEntry.get(entry.id) ?? 0}</td>
      </tr>`;
  }).join('');

  // Build voter leaderboard rows
  const voterRows: string[] = [];
  const sortedVoters = allVoters.map(v => ({ name: escapeHtml(v.name), total: v.totalVotes, correct: v.correctVotes }));

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
