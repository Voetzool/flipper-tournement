import { Icon } from '../components/Icon';
import { tr } from '../../i18n';
import { useState } from 'preact/hooks';
import { dispatch, ratings, showToast, state } from '../../app/state';
import { go } from '../../app/router';
import { playerInUse } from '../../events/reducer';
import type { Player } from '../../events/types';
import { newId } from '../../lib/id';
import { Shell } from '../components/Shell';
import { Sheet } from '../components/Sheet';

export function PlayersScreen() {
  const [editing, setEditing] = useState<'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const all = [...state.value.players.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const active = all.filter((p) => !p.archived);
  const archived = all.filter((p) => p.archived);

  return (
    <Shell title={tr('Spelers')}>
      {!active.length && <p class="empty">{tr('Nog geen spelers. Tik op + om iemand toe te voegen.')}</p>}
      <ul class="list">
        {active.map((p) => (
          <li key={p.id} class="list-item card tap" onClick={() => go('speler/' + p.id)}>
            <span class="name">{p.name}</span>
            {ratings.value.has(p.id) && <span class="muted">{Math.round(ratings.value.get(p.id)!.rating)}</span>}
            <span class="muted">›</span>
          </li>
        ))}
      </ul>
      {archived.length > 0 && (
        <>
          <h2>
            <button class="btn ghost" onClick={() => setShowArchived(!showArchived)}>
              {tr('Gearchiveerd ({n})', { n: archived.length })} {showArchived ? '▲' : '▼'}
            </button>
          </h2>
          {showArchived && (
            <ul class="list">
              {archived.map((p) => (
                <li key={p.id} class="list-item">
                  <a class="name muted plain" href={'#/speler/' + p.id}>
                    {p.name}
                  </a>
                  <button class="btn" onClick={() => dispatch({ type: 'PlayerRestored', playerId: p.id })}>
                    {tr('Terugzetten')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <button class="fab" onClick={() => setEditing('new')} aria-label={tr('Speler toevoegen')}>
        <Icon name="add" />
      </button>
      {editing && <PlayerSheet player={null} onClose={() => setEditing(null)} />}
    </Shell>
  );
}

export function PlayerSheet({ player, onClose }: { player: Player | null; onClose: () => void }) {
  const [name, setName] = useState(player?.name ?? '');
  const trimmed = name.trim();
  const duplicate = [...state.value.players.values()].some(
    (p) => p.id !== player?.id && p.name.toLowerCase() === trimmed.toLowerCase(),
  );

  const save = (e: Event) => {
    e.preventDefault();
    if (!trimmed) return;
    if (player) {
      if (trimmed !== player.name) dispatch({ type: 'PlayerUpdated', playerId: player.id, name: trimmed });
      onClose();
    } else {
      dispatch({ type: 'PlayerAdded', playerId: newId(), name: trimmed });
      showToast(tr('{naam} toegevoegd', { naam: trimmed }));
      setName('');
    }
  };

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={save} class="stack">
        <h3>{player ? tr('Speler bewerken') : tr('Nieuwe speler')}</h3>
        <div class="field">
          <label for="pname">{tr('Naam')}</label>
          <input
            id="pname"
            class="input"
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
          />
          {duplicate && <span class="small" style="color:var(--yellow)">{tr('Er is al een speler met deze naam.')}</span>}
        </div>
        <button class="btn primary block big" type="submit" disabled={!trimmed}>
          {player ? tr('Opslaan') : tr('Toevoegen')}
        </button>
        {!player && <p class="small muted">{tr('Je kunt meteen de volgende naam typen.')}</p>}
        {player && !playerInUse(state.value, player.id) && (
          <button
            type="button"
            class="btn danger block"
            onClick={() => {
              if (!confirm(tr('{naam} verwijderen?', { naam: player.name }))) return;
              dispatch({ type: 'PlayerDeleted', playerId: player.id });
              onClose();
              go('spelers');
            }}
          >
            {tr('Verwijderen')}
          </button>
        )}
        {player && playerInUse(state.value, player.id) && !player.archived && (
          <>
            <button
              type="button"
              class="btn danger block"
              onClick={() => {
                dispatch({ type: 'PlayerArchived', playerId: player.id });
                onClose();
              }}
            >
              {tr('Archiveren')}
            </button>
            <p class="small muted" style="margin:0">
              {tr('{naam} heeft al meegedaan aan een toernooi en kan daarom niet verwijderd worden (dan kloppen oude uitslagen niet meer). Archiveren verbergt de speler uit de lijsten; terugzetten kan altijd.', { naam: player.name })}
            </p>
          </>
        )}
        <button type="button" class="btn ghost block" onClick={onClose}>
          {tr('Sluiten')}
        </button>
      </form>
    </Sheet>
  );
}
