import { useState } from 'preact/hooks';
import { dispatch, ratings, showToast, state } from '../../app/state';
import { go } from '../../app/router';
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
    <Shell title="Spelers">
      {!active.length && <p class="empty">Nog geen spelers. Tik op + om iemand toe te voegen.</p>}
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
              Gearchiveerd ({archived.length}) {showArchived ? '▲' : '▼'}
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
                    Terugzetten
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <button class="fab" onClick={() => setEditing('new')} aria-label="Speler toevoegen">
        +
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
      showToast(`${trimmed} toegevoegd`);
      setName('');
    }
  };

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={save} class="stack">
        <h3>{player ? 'Speler bewerken' : 'Nieuwe speler'}</h3>
        <div class="field">
          <label for="pname">Naam</label>
          <input
            id="pname"
            class="input"
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
          />
          {duplicate && <span class="small" style="color:var(--yellow)">Er is al een speler met deze naam.</span>}
        </div>
        <button class="btn primary block big" type="submit" disabled={!trimmed}>
          {player ? 'Opslaan' : 'Toevoegen'}
        </button>
        {!player && <p class="small muted">Je kunt meteen de volgende naam typen.</p>}
        {player && (
          <button
            type="button"
            class="btn danger block"
            onClick={() => {
              dispatch({ type: 'PlayerArchived', playerId: player.id });
              onClose();
            }}
          >
            Archiveren
          </button>
        )}
        <button type="button" class="btn ghost block" onClick={onClose}>
          Sluiten
        </button>
      </form>
    </Sheet>
  );
}
