import { Icon } from '../components/Icon';
import { locale, tr } from '../../i18n';
import { machineName, playerName, state } from '../../app/state';
import { go } from '../../app/router';
import type { Tournament } from '../../events/types';
import { formatOf } from '../../formats';
import { BackupBanner } from '../components/BackupBanner';
import { Shell } from '../components/Shell';

export function TournamentsScreen() {
  const all = [...state.value.tournaments.values()].sort((a, b) => b.createdAt - a.createdAt);
  const list = all.filter((t) => t.format !== 'single');
  const singles = all.filter((t) => t.format === 'single').slice(0, 10);
  const active = list.filter((t) => t.status === 'active');
  const done = list.filter((t) => t.status === 'finished');
  return (
    <Shell
      title={
        <>
          <img class="logo" src="icons/icon.svg" alt="" width={32} height={32} />
          {tr('Flipper Toernooi')}
        </>
      }
    >
      <BackupBanner />
      <div class="grid2">
        <button class="btn primary big" onClick={() => go('nieuw')}>
          <Icon name="trophy" /> {tr('Toernooi')}
        </button>
        <button class="btn cyan big" onClick={() => go('pot')}>
          <Icon name="bolt" /> {tr('Losse pot')}
        </button>
      </div>
      {active.length > 0 && <h2>{tr('Bezig')}</h2>}
      <ul class="list">
        {active.map((t) => (
          <Item key={t.id} t={t} />
        ))}
      </ul>
      {done.length > 0 && <h2>{tr('Afgerond')}</h2>}
      <ul class="list">
        {done.map((t) => (
          <Item key={t.id} t={t} />
        ))}
      </ul>
      {singles.length > 0 && <h2>{tr('Losse potjes')}</h2>}
      <ul class="list">
        {singles.map((t) => (
          <SingleItem key={t.id} t={t} />
        ))}
      </ul>
      {!all.length && <p class="empty">{tr('Nog geen toernooien of potjes. Voeg eerst spelers (en machines) toe en start een toernooi of een losse pot.')}</p>}
    </Shell>
  );
}

function SingleItem({ t }: { t: Tournament }) {
  const s = state.value;
  const game = t.rounds[0]?.games[0];
  if (!game) return null;
  const names = (ids: string[]) => ids.map((id) => playerName(s, id)).join(' & ');
  const vs = game.teams ? game.teams.map(names).join(' vs ') : game.playerIds.map((id) => playerName(s, id)).join(' · ');
  const winner = game.result ? (game.teams ? names(game.teams.find((tm) => tm.includes(game.result![0]))!) : playerName(s, game.result[0])) : null;
  return (
    <li class="list-item card tap" onClick={() => go('t/' + t.id)}>
      <div class="name">
        {vs}
        <div class="small muted">
          {machineName(s, game.machineId)} · {t.name.replace(/^[^·]*· /, '')}
        </div>
      </div>
      {winner ? <span class="badge"><Icon name="trophy" /> {winner}</span> : <span class="badge live">{tr('bezig')}</span>}
    </li>
  );
}

function Item({ t }: { t: Tournament }) {
  const date = new Date(t.createdAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <li class="list-item card tap" onClick={() => go('t/' + t.id)}>
      <div class="name">
        {t.name}
        <div class="small muted">
          {tr(formatOf(t.format).label)} · {date} ·{' '}
          {tr('{n} spelers · ronde {r}/{totaal}', { n: t.playerIds.length, r: Math.min(t.rounds.length, t.settings.rounds), totaal: t.settings.rounds })}
        </div>
      </div>
      {t.status === 'active' ? <span class="badge live">{tr('live')}</span> : <span class="badge">{tr('klaar')}</span>}
    </li>
  );
}
