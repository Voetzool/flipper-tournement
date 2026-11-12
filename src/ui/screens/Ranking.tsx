import { Icon } from '../components/Icon';
import { locale, tr } from '../../i18n';
import { rankingView, setRankingView, type RankingView } from '../../app/settings';
import { rankingCsv, rankingPng, type RankingRow } from '../../lib/rankingExport';
import { shareOrDownload } from '../../lib/share';
import type { IconName } from '../components/Icon';
import { MAX_SERIES, RatingBars, RatingHistory } from '../components/RankingCharts';
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

  const view = rankingView.value;
  const exportRows = (): RankingRow[] => [
    ...ranked.map((r, i) => ({ rank: i + 1, name: playerName(s, r.playerId), r })),
    ...provisional.map((r) => ({ rank: null, name: playerName(s, r.playerId), r })),
  ];
  const today = new Date();
  const stamp = today.toISOString().slice(0, 10);
  const exportCsv = () => {
    const csv = rankingCsv(
      exportRows(),
      [tr('Plek'), tr('Speler'), tr('Rating'), tr('Onzekerheid (±)'), tr('Potjes'), tr('Laatste wijziging'), tr('Voorlopig')],
      tr('ja'),
    );
    shareOrDownload(new File([csv], `ranglijst-${stamp}.csv`, { type: 'text/csv' }), tr('Ranglijst'));
  };
  const exportPng = async () => {
    const blob = await rankingPng(exportRows(), tr('Ranglijst'), today.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }));
    shareOrDownload(new File([blob], `ranglijst-${stamp}.png`, { type: 'image/png' }), tr('Ranglijst'));
  };
  // Verloop: de vaste groep als die er is, anders de top van de ranglijst.
  const core = list.filter((r) => s.players.get(r.playerId)?.core);
  const historyRows = (core.length ? core : [...ranked, ...provisional]).slice(0, MAX_SERIES);

  return (
    <Shell title={tr('Ranglijst')}>
      {!list.length && <p class="empty">{tr('Nog geen uitslagen. Na het eerste potje verschijnt hier de ranglijst.')}</p>}
      {list.length > 0 && (
        <div class="row home-tools" style="margin:0 0 12px">
          <div class="seg mini" role="radiogroup" aria-label={tr('Weergave')}>
            {(
              [
                ['table', 'table_rows', 'Tabel'],
                ['bars', 'bar_chart', 'Staafgrafiek'],
                ['history', 'show_chart', 'Verloop'],
              ] as [RankingView, IconName, string][]
            ).map(([v, icon, label]) => (
              <button key={v} class={view === v ? 'on' : ''} role="radio" aria-checked={view === v} onClick={() => setRankingView(v)} aria-label={tr(label)} title={tr(label)}>
                <Icon name={icon} />
              </button>
            ))}
          </div>
          <span class="grow" />
          <span class="export-buttons">
          <button class="btn ghost small" onClick={exportCsv} title={tr('Exporteren als spreadsheet (CSV)')}>
            <Icon name="download" /> CSV
          </button>
          <button class="btn ghost small" onClick={exportPng} title={tr('Exporteren als afbeelding')}>
            <Icon name="image" /> {tr('Afbeelding')}
          </button>
          </span>
        </div>
      )}
      {view === 'bars' && list.length > 0 && <RatingBars rows={[...ranked, ...provisional]} />}
      {view === 'history' && list.length > 0 && (
        <>
          <RatingHistory rows={historyRows} />
          <p class="small muted">
            {core.length ? tr('Je ziet de vaste groep (maximaal {n} spelers).', { n: MAX_SERIES }) : tr('Je ziet de top {n} van de ranglijst.', { n: MAX_SERIES })}
          </p>
        </>
      )}
      {view === 'table' && ranked.length > 0 && <Rows rows={ranked} />}
      {view === 'table' && provisional.length > 0 && (
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
