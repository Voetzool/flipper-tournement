import { playerName, state } from '../../app/state';
import type { Tournament } from '../../events/types';
import { formatOf } from '../../formats';

export function StandingsTable({ t }: { t: Tournament }) {
  const s = state.value;
  const rows = formatOf(t.format).standings(t);
  return (
    <table class="standings">
      <thead>
        <tr>
          <th>#</th>
          <th>Speler</th>
          <th class="num">Gesp.</th>
          <th class="num">Winst</th>
          <th class="num">Ptn</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.playerId} class={'rank-' + r.rank}>
            <td>{r.rank}</td>
            <td>
              {playerName(s, r.playerId)}
              {!t.playerIds.includes(r.playerId) && <span class="badge" style="margin-left:6px">afgemeld</span>}
            </td>
            <td class="num muted">{r.played}</td>
            <td class="num muted">{r.wins}</td>
            <td class="num pts">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
