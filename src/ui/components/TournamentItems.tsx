import { useState } from 'preact/hooks';
import { dispatch, machineName, playerName, state } from '../../app/state';
import { go } from '../../app/router';
import { homeView } from '../../app/settings';
import type { Folder, Tournament } from '../../events/types';
import { formatOf } from '../../formats';
import { locale, tr } from '../../i18n';
import { newId } from '../../lib/id';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

/** Is een toernooi of losse pot klaar (en dus te archiveren)? */
export function isDone(t: Tournament): boolean {
  if (t.format === 'single') return !!t.rounds[0]?.games[0]?.result;
  return t.status === 'finished';
}

const fmtDate = (at: number) => new Date(at).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

/** Titel, onderregel en badge van een toernooi of losse pot (voor lijst én raster). */
function describe(t: Tournament) {
  const s = state.value;
  if (t.format === 'single') {
    const game = t.rounds[0]?.games[0];
    const names = (ids: string[]) => ids.map((id) => playerName(s, id)).join(' & ');
    const title = !game ? t.name : game.teams ? game.teams.map(names).join(' vs ') : game.playerIds.map((id) => playerName(s, id)).join(' · ');
    const winner = game?.result ? (game.teams ? names(game.teams.find((tm) => tm.includes(game.result![0]))!) : playerName(s, game.result[0])) : null;
    return {
      title,
      sub: `${game ? machineName(s, game.machineId) : ''} · ${t.name.replace(/^[^·]*· /, '')}`,
      badge: winner ? (
        <span class="badge">
          <Icon name="trophy" /> {winner}
        </span>
      ) : (
        <span class="badge live">{tr('bezig')}</span>
      ),
    };
  }
  return {
    title: t.name,
    sub: `${tr(formatOf(t.format).label)} · ${fmtDate(t.createdAt)} · ${tr('{n} spelers · ronde {r}/{totaal}', {
      n: t.playerIds.length,
      r: Math.min(t.rounds.length, t.settings.rounds),
      totaal: t.settings.rounds,
    })}`,
    badge: t.status === 'active' ? <span class="badge live">{tr('live')}</span> : <span class="badge">{tr('klaar')}</span>,
  };
}

/** Een lijst of raster (volgens de instelling) van toernooien en losse potjes, elk met een knop om te ordenen. */
export function TournamentItems({ items }: { items: Tournament[] }) {
  const [organize, setOrganize] = useState<Tournament | null>(null);
  if (!items.length) return null;
  const grid = homeView.value === 'grid';
  return (
    <>
      <ul class={grid ? 'tile-grid' : 'list'}>
        {items.map((t) => {
          const d = describe(t);
          return (
            <li key={t.id} class={(grid ? 'tile' : 'list-item') + ' card tap'} onClick={() => go('t/' + t.id)}>
              <div class="name">
                {d.title}
                <div class="small muted">{d.sub}</div>
              </div>
              <div class="item-end">
                {d.badge}
                <button
                  class="iconbtn plain-icon"
                  aria-label={tr('Ordenen')}
                  title={tr('Ordenen')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOrganize(t);
                  }}
                >
                  <Icon name="more_vert" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {organize && <OrganizeSheet t={organize} onClose={() => setOrganize(null)} />}
    </>
  );
}

/** Mappen als tegels (raster) of rijen (lijst). */
export function FolderItems({ folders }: { folders: Folder[] }) {
  if (!folders.length) return null;
  const s = state.value;
  const grid = homeView.value === 'grid';
  const count = (f: Folder) => [...s.tournaments.values()].filter((t) => t.folderId === f.id && !t.archived).length;
  return (
    <ul class={grid ? 'tile-grid' : 'list'}>
      {folders.map((f) => (
        <li key={f.id} class={(grid ? 'tile folder' : 'list-item') + ' card tap'} onClick={() => go('map/' + f.id)}>
          <Icon name="folder" />
          <div class="name">
            {f.name}
            <div class="small muted">{count(f) === 1 ? tr('1 item') : tr('{n} items', { n: count(f) })}</div>
          </div>
          {!grid && (
            <span class="muted">
              <Icon name="chevron_right" />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Nieuwe map maken (vraagt een naam); geeft de id terug, of null als er geen naam is ingevuld. */
export function createFolder(): string | null {
  const name = prompt(tr('Naam van de nieuwe map:'))?.trim();
  if (!name) return null;
  const folderId = newId();
  dispatch({ type: 'FolderCreated', folderId, name });
  return folderId;
}

/** Ordenen: naar een map verplaatsen en archiveren / uit het archief halen. */
export function OrganizeSheet({ t, onClose }: { t: Tournament; onClose: () => void }) {
  const s = state.value;
  const folders = [...s.folders.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const move = (folderId: string | null) => {
    dispatch({ type: 'TournamentsMoved', tournamentIds: [t.id], folderId });
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <div class="stack">
        <h3>{describe(t).title}</h3>
        <div class="field">
          <label>{tr('In map')}</label>
          <div class="chips">
            <button class={'chip' + (!t.folderId ? ' on' : '')} onClick={() => move(null)}>
              {tr('Geen map')}
            </button>
            {folders.map((f) => (
              <button key={f.id} class={'chip' + (t.folderId === f.id ? ' on' : '')} onClick={() => move(f.id)}>
                <Icon name="folder" /> {f.name}
              </button>
            ))}
            <button
              class="chip"
              onClick={() => {
                const id = createFolder();
                if (id) move(id);
              }}
            >
              <Icon name="create_new_folder" /> {tr('Nieuwe map…')}
            </button>
          </div>
        </div>
        {t.archived ? (
          <button
            class="btn block"
            onClick={() => {
              dispatch({ type: 'TournamentsArchived', tournamentIds: [t.id], archived: false });
              onClose();
            }}
          >
            <Icon name="unarchive" /> {tr('Uit archief halen')}
          </button>
        ) : (
          <button
            class="btn block"
            disabled={!isDone(t)}
            onClick={() => {
              dispatch({ type: 'TournamentsArchived', tournamentIds: [t.id], archived: true });
              onClose();
            }}
          >
            <Icon name="archive" /> {tr('Archiveren')}
          </button>
        )}
        {!t.archived && !isDone(t) && <p class="small muted" style="margin:0">{tr('Archiveren kan als het toernooi of potje klaar is.')}</p>}
        <button class="btn ghost block" onClick={onClose}>
          {tr('Sluiten')}
        </button>
      </div>
    </Sheet>
  );
}
