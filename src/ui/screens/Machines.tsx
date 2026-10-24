import { useState } from 'preact/hooks';
import { dispatch, showToast, state } from '../../app/state';
import type { Machine } from '../../events/types';
import { newId } from '../../lib/id';
import { Shell } from '../components/Shell';
import { Sheet } from '../components/Sheet';

// Fase 1: alleen een naam. Fase 3 voegt fabrikant, jaar, notities, rulesheet en de catalogus toe.
export function MachinesScreen() {
  const [editing, setEditing] = useState<Machine | 'new' | null>(null);
  const all = [...state.value.machines.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const active = all.filter((m) => m.active);
  const removed = all.filter((m) => !m.active);

  return (
    <Shell title="Kasten">
      {!active.length && <p class="empty">Nog geen kasten. Tik op + om een flipperkast toe te voegen.</p>}
      <ul class="list">
        {active.map((m) => (
          <li key={m.id} class="list-item card tap" onClick={() => setEditing(m)}>
            <span class="name">{m.name}</span>
            <span class="muted">›</span>
          </li>
        ))}
      </ul>
      {removed.length > 0 && (
        <>
          <h2>Verwijderd</h2>
          <ul class="list">
            {removed.map((m) => (
              <li key={m.id} class="list-item">
                <span class="name muted">{m.name}</span>
                <button class="btn" onClick={() => dispatch({ type: 'MachineRestored', machineId: m.id })}>
                  Terugzetten
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button class="fab" onClick={() => setEditing('new')} aria-label="Kast toevoegen">
        +
      </button>
      {editing && <MachineSheet machine={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Shell>
  );
}

function MachineSheet({ machine, onClose }: { machine: Machine | null; onClose: () => void }) {
  const [name, setName] = useState(machine?.name ?? '');
  const trimmed = name.trim();

  const save = (e: Event) => {
    e.preventDefault();
    if (!trimmed) return;
    if (machine) {
      if (trimmed !== machine.name) dispatch({ type: 'MachineUpdated', machineId: machine.id, name: trimmed });
      onClose();
    } else {
      dispatch({ type: 'MachineAdded', machineId: newId(), name: trimmed });
      showToast(`${trimmed} toegevoegd`);
      setName('');
    }
  };

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={save} class="stack">
        <h3>{machine ? 'Kast bewerken' : 'Nieuwe kast'}</h3>
        <div class="field">
          <label for="mname">Naam</label>
          <input
            id="mname"
            class="input"
            value={name}
            placeholder="bijv. Medieval Madness"
            onInput={(e) => setName(e.currentTarget.value)}
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
          />
        </div>
        <button class="btn primary block big" type="submit" disabled={!trimmed}>
          {machine ? 'Opslaan' : 'Toevoegen'}
        </button>
        {machine && (
          <button
            type="button"
            class="btn danger block"
            onClick={() => {
              dispatch({ type: 'MachineRemoved', machineId: machine.id });
              onClose();
            }}
          >
            Verwijderen
          </button>
        )}
        <button type="button" class="btn ghost block" onClick={onClose}>
          Sluiten
        </button>
      </form>
    </Sheet>
  );
}
