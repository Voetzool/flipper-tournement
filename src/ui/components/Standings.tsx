import { tr } from '../../i18n';
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
          <th>{tr('Speler')}</th>
          <th class="num">{tr('Gesp.')}</th>
          <th class="num">{tr('Winst')}</th>
          <th class="num">{tr('Ptn')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.playerId} class={'rank-' + r.rank}>
            <td>{r.rank}</td>
            <td>
              <a class="plain" href={'#/speler/' + r.playerId}>
                {playerName(s, r.playerId)}
              </a>
              {!t.playerIds.includes(r.playerId) && <span class="badge" style="margin-left:6px">{tr('afgemeld')}</span>}
              {r.note && <span class="badge live" style="margin-left:6px">{tr(r.note)}</span>}
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
