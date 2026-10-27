import { Icon } from '../components/Icon';
import { tr } from '../../i18n';
import { go } from '../../app/router';
import { playerName, ratings, state } from '../../app/state';
import { PROVISIONAL_GAMES, type PlayerRating } from '../../rating/ratings';
import { Shell } from '../components/Shell';

export function Delta({ value }: { value: number }) {
  const v = Math.round(value);
  if (!v) return <span class="muted">±0</span>;
  return <span class={v > 0 ? 'delta-up' : 'delta-down'}>{v > 0 ? <Icon name="arrow_drop_up" /> : <Icon name="arrow_drop_down" />}
      {v > 0 ? `+${v}` : v}</span>;
}

export function RankingScreen() {
  const s = state.value;
  const list = [...ratings.value.values()]
    .filter((r) => s.players.get(r.playerId) && !s.players.get(r.playerId)!.archived)
    .sort((a, b) => b.rating - a.rating);
  const ranked = list.filter((r) => r.games >= PROVISIONAL_GAMES);
  const provisional = list.filter((r) => r.games < PROVISIONAL_GAMES);

  return (
    <Shell title={tr('Ranglijst')}>
      {!list.length && <p class="empty">{tr('Nog geen uitslagen. Na het eerste potje verschijnt hier de ranglijst.')}</p>}
      {ranked.length > 0 && <Rows rows={ranked} />}
      {provisional.length > 0 && (
        <>
          <h2>{tr('Voorlopig (minder dan {n} potjes)', { n: PROVISIONAL_GAMES })}</h2>
          <Rows rows={provisional} numbered={false} />
        </>
      )}
      {list.length > 0 && (
        <p class="small muted">
          {tr('Rating volgens Glicko-2: iedereen start op 1500. Bij elk potje telt de uitslag als onderlinge duels (wie hoger eindigt, wint van iedereen onder zich). Het ±-getal is de onzekerheid: hoe meer je speelt, hoe kleiner.')}
        </p>
      )}
    </Shell>
  );
}

function Rows({ rows, numbered = true }: { rows: PlayerRating[]; numbered?: boolean }) {
  const s = state.value;
  return (
    <table class="standings">
      <thead>
        <tr>
          <th>{numbered ? '#' : ''}</th>
          <th>{tr('Speler')}</th>
          <th class="num">{tr('Laatst')}</th>
          <th class="num">{tr('Rating')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.playerId} class={numbered ? 'rank-' + (i + 1) : ''} onClick={() => go('speler/' + r.playerId)} style="cursor:pointer">
            <td>{numbered ? i + 1 : '–'}</td>
            <td>
              {playerName(s, r.playerId)}
              <div class="small muted">{tr(r.games === 1 ? '1 potje' : '{n} potjes', { n: r.games })}</div>
            </td>
            <td class="num small">
              <Delta value={r.history[r.history.length - 1]?.delta ?? 0} />
            </td>
            <td class="num">
              <span class="pts">{Math.round(r.rating)}</span>
              <div class="small muted">±{Math.round(r.rd)}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
