import { useState } from 'preact/hooks';
import { dispatch, state } from '../../app/state';
import { go } from '../../app/router';
import type { RoundRobinSettings } from '../../events/types';
import { roundRobin } from '../../formats/roundRobin';
import { groupSizes } from '../../formats/roundRobin/pairing';
import { defaultSettings } from '../../formats/roundRobin/scoring';
import { newId } from '../../lib/id';
import { Shell } from '../components/Shell';

function defaultName() {
  return 'Toernooi ' + new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
}

export function NewTournamentScreen() {
  const s = state.value;
  const players = [...s.players.values()].filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const machines = [...s.machines.values()].filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  const [name, setName] = useState(defaultName);
  const [selPlayers, setSelPlayers] = useState<Set<string>>(new Set());
  const [selMachines, setSelMachines] = useState<Set<string>>(() => new Set(machines.map((m) => m.id)));
  const [settings, setSettings] = useState<RoundRobinSettings>(defaultSettings);

  const toggle = (set: Set<string>, id: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    fn(n);
  };

  const sizes = groupSizes(selPlayers.size, settings.maxGroupSize);
  const tooFewMachines = sizes.length > selMachines.size;

  const start = () => {
    const tournamentId = newId();
    const base = {
      playerIds: [...selPlayers],
      machineIds: [...selMachines],
      settings,
      rounds: [],
    };
    dispatch({
      type: 'TournamentCreated',
      tournamentId,
      name: name.trim() || defaultName(),
      format: 'roundRobin',
      settings,
      playerIds: base.playerIds,
      machineIds: base.machineIds,
      firstRound: roundRobin.nextRound(base),
    });
    go('t/' + tournamentId);
  };

  const setPoints = (size: number, pos: number, value: string) => {
    const table = structuredClone(settings.pointsTable);
    table[size][pos] = Math.max(0, Math.min(99, parseInt(value, 10) || 0));
    setSettings({ ...settings, pointsTable: table });
  };

  return (
    <Shell title="Nieuw toernooi" back="">
      <div class="stack">
        <div class="field">
          <label for="tname">Naam</label>
          <input id="tname" class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </div>

        <h2>
          Spelers ({selPlayers.size}){' '}
          {players.length > 0 && (
            <button
              class="btn ghost small"
              onClick={() => setSelPlayers(selPlayers.size === players.length ? new Set() : new Set(players.map((p) => p.id)))}
            >
              {selPlayers.size === players.length ? 'Geen' : 'Iedereen'}
            </button>
          )}
        </h2>
        {!players.length && (
          <p class="muted">
            Nog geen spelers. <a href="#/spelers">Voeg eerst spelers toe</a>.
          </p>
        )}
        <div class="chips">
          {players.map((p) => (
            <button key={p.id} class={'chip' + (selPlayers.has(p.id) ? ' on' : '')} onClick={() => toggle(selPlayers, p.id, setSelPlayers)}>
              {p.name}
            </button>
          ))}
        </div>

        <h2>Kasten ({selMachines.size})</h2>
        {!machines.length && (
          <p class="muted">
            Nog geen kasten. <a href="#/kasten">Voeg kasten toe</a> (mag ook zonder).
          </p>
        )}
        <div class="chips">
          {machines.map((m) => (
            <button key={m.id} class={'chip' + (selMachines.has(m.id) ? ' on' : '')} onClick={() => toggle(selMachines, m.id, setSelMachines)}>
              {m.name}
            </button>
          ))}
        </div>

        <h2>Instellingen</h2>
        <div class="card stack">
          <div class="row">
            <span class="grow">Aantal rondes</span>
            <div class="stepper">
              <button class="iconbtn" onClick={() => setSettings({ ...settings, rounds: Math.max(1, settings.rounds - 1) })}>
                −
              </button>
              <span class="val">{settings.rounds}</span>
              <button class="iconbtn" onClick={() => setSettings({ ...settings, rounds: Math.min(30, settings.rounds + 1) })}>
                +
              </button>
            </div>
          </div>
          <div class="field">
            <label>Maximaal spelers per kast</label>
            <div class="seg">
              {([2, 3, 4] as const).map((n) => (
                <button key={n} class={settings.maxGroupSize === n ? 'on' : ''} onClick={() => setSettings({ ...settings, maxGroupSize: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          {selPlayers.size >= 2 && (
            <p class="small muted">
              Per ronde: {sizes.length} {sizes.length === 1 ? 'groep' : 'groepen'} ({sizes.join(' + ')} spelers).
              {tooFewMachines && ' Er zijn minder kasten dan groepen; sommige groepen wachten op een vrije kast.'}
            </p>
          )}
          <div class="field">
            <label>Punten per plek</label>
            {[4, 3, 2].map((size) => (
              <div class="points-row" key={size}>
                <span class="lbl">{size} spelers</span>
                {settings.pointsTable[size].map((v, i) => (
                  <input
                    key={i}
                    type="number"
                    inputMode="numeric"
                    value={v}
                    aria-label={`${size} spelers, plek ${i + 1}`}
                    onInput={(e) => setPoints(size, i, e.currentTarget.value)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <button class="btn primary block big" disabled={selPlayers.size < 2} onClick={start}>
          Start toernooi
        </button>
        {selPlayers.size < 2 && <p class="small muted">Kies minstens 2 spelers.</p>}
      </div>
    </Shell>
  );
}
