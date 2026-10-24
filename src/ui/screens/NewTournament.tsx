import { locale, tr } from '../../i18n';
import { useEffect, useState } from 'preact/hooks';
import { dispatch, state } from '../../app/state';
import { go } from '../../app/router';
import type { FormatId, RoundRobinSettings } from '../../events/types';
import { formatOf } from '../../formats';
import { headToHeadSettings } from '../../formats/headToHead';
import { fairRoundCounts, groupSizes, waitingPerRound } from '../../formats/roundRobin/pairing';
import { DEFAULT_POINTS, defaultSettings } from '../../formats/roundRobin/scoring';
import { newId } from '../../lib/id';
import { shuffle } from '../../lib/rng';
import { Sheet } from '../components/Sheet';
import { Shell } from '../components/Shell';

function defaultName() {
  return tr('Toernooi') + ' ' + new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
}

function pointsSummary(table: Record<number, number[]>, max: number) {
  return (table[max] ?? []).join(' · ') + ' ' + tr('bij {n} spelers', { n: max });
}

function isDefaultPoints(table: Record<number, number[]>) {
  return JSON.stringify(table) === JSON.stringify(DEFAULT_POINTS);
}

export function NewTournamentScreen() {
  const s = state.value;
  const players = [...s.players.values()].filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const machines = [...s.machines.values()].filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  const [name, setName] = useState(defaultName);
  const [selPlayers, setSelPlayers] = useState<Set<string>>(new Set());
  const [selMachines, setSelMachines] = useState<Set<string>>(() => new Set(machines.map((m) => m.id)));
  const [settings, setSettings] = useState<RoundRobinSettings>(defaultSettings);
  const [format, setFormat] = useState<FormatId>('roundRobin');
  const h2h = format === 'headToHead';

  const toggle = (set: Set<string>, id: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    fn(n);
  };

  const [roundsTouched, setRoundsTouched] = useState(false);
  const [editPoints, setEditPoints] = useState(false);

  const n = selPlayers.size;
  const sizes = groupSizes(n, settings.maxGroupSize);
  const tooFewMachines = sizes.length > selMachines.size;
  const waiting = waitingPerRound(n, settings.maxGroupSize);
  const fair = fairRoundCounts(n, settings.maxGroupSize);
  const isFair = !fair || fair.includes(settings.rounds);

  const setRounds = (rounds: number) => {
    setRoundsTouched(true);
    setSettings({ ...settings, rounds: Math.max(1, Math.min(30, rounds)) });
  };

  // Moet er iemand wachten, dan het aantal rondes automatisch op een eerlijk aantal zetten (tot je het zelf aanpast).
  useEffect(() => {
    if (roundsTouched || !fair) return;
    const nearest = fair.reduce((a, b) => (Math.abs(b - settings.rounds) < Math.abs(a - settings.rounds) ? b : a));
    if (nearest !== settings.rounds) setSettings({ ...settings, rounds: nearest });
  }, [n, settings.maxGroupSize]);

  const start = () => {
    const tournamentId = newId();
    // Round Robin: willekeurige volgorde vastleggen, daaruit volgt het hele schema.
    const playerIds = h2h ? shuffle([...selPlayers], Math.random) : [...selPlayers];
    const chosen = h2h ? headToHeadSettings(playerIds.length) : settings;
    const base = { playerIds, machineIds: [...selMachines], settings: chosen, rounds: [] };
    dispatch({
      type: 'TournamentCreated',
      tournamentId,
      name: name.trim() || defaultName(),
      format,
      settings: chosen,
      playerIds,
      machineIds: base.machineIds,
      firstRound: formatOf(format).nextRound(base),
    });
    go('t/' + tournamentId);
  };

  const setPoints = (size: number, pos: number, value: string) => {
    const table = structuredClone(settings.pointsTable);
    table[size][pos] = Math.max(0, Math.min(99, parseInt(value, 10) || 0));
    setSettings({ ...settings, pointsTable: table });
  };

  return (
    <Shell title={tr('Nieuw toernooi')} back="">
      <div class="stack">
        <div class="field">
          <label for="tname">{tr('Naam')}</label>
          <input id="tname" class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </div>

        <h2>{tr('Spelvorm')}</h2>
        <div class="seg">
          {(['roundRobin', 'headToHead'] as FormatId[]).map((f) => (
            <button key={f} class={format === f ? 'on' : ''} onClick={() => setFormat(f)}>
              {tr(formatOf(f).label)}
            </button>
          ))}
        </div>
        <p class="small muted" style="margin:4px 0 0">
          {h2h ? tr('1-tegen-1, iedereen één keer tegen iedereen.') : tr('Groepjes van 2–4 per kast, punten per plek, eerlijk ingedeeld.')}
        </p>

        <h2>
          {tr('Spelers ({n})', { n: selPlayers.size })}{' '}
          {players.length > 0 && (
            <button
              class="btn ghost small"
              onClick={() => setSelPlayers(selPlayers.size === players.length ? new Set() : new Set(players.map((p) => p.id)))}
            >
              {selPlayers.size === players.length ? tr('Geen') : tr('Iedereen')}
            </button>
          )}
        </h2>
        {!players.length && (
          <p class="muted">
            {tr('Nog geen spelers.')} <a href="#/spelers">{tr('Voeg eerst spelers toe')}</a>.
          </p>
        )}
        <div class="chips">
          {players.map((p) => (
            <button key={p.id} class={'chip' + (selPlayers.has(p.id) ? ' on' : '')} onClick={() => toggle(selPlayers, p.id, setSelPlayers)}>
              {p.name}
            </button>
          ))}
        </div>

        <h2>{tr('Kasten ({n})', { n: selMachines.size })}</h2>
        {!machines.length && (
          <p class="muted">
            {tr('Nog geen kasten.')} <a href="#/kasten">{tr('Voeg kasten toe')}</a> {tr('(mag ook zonder).')}
          </p>
        )}
        <div class="chips">
          {machines.map((m) => (
            <button key={m.id} class={'chip' + (selMachines.has(m.id) ? ' on' : '')} onClick={() => toggle(selMachines, m.id, setSelMachines)}>
              {m.name}
            </button>
          ))}
        </div>

        <h2>{tr('Instellingen')}</h2>
        {h2h ? (
          <div class="card stack">
            <p style="margin:0">
              {tr('Iedereen speelt één keer 1-tegen-1 tegen iedereen. Winst = 1 punt, verlies = 0. Bij gelijke stand bovenaan volgt een tie-breaker.')}
            </p>
            {selPlayers.size >= 2 && (
              <p class="small muted" style="margin:0">
                {tr('{r} rondes; iedereen speelt {n} potjes.', { r: headToHeadSettings(selPlayers.size).rounds, n: selPlayers.size - 1 })}
                {selPlayers.size % 2 === 1 && ' ' + tr('Oneven aantal: elke ronde wacht één speler.')}
              </p>
            )}
          </div>
        ) : (
        <div class="card stack">
          <div class="row">
            <span class="grow">{tr('Aantal rondes')}</span>
            <div class="stepper">
              <button class="iconbtn" onClick={() => setRounds(settings.rounds - 1)}>
                −
              </button>
              <span class="val">{settings.rounds}</span>
              <button class="iconbtn" onClick={() => setRounds(settings.rounds + 1)}>
                +
              </button>
            </div>
          </div>
          <div class="field">
            <label>{tr('Maximaal spelers per kast')}</label>
            <div class="seg">
              {([2, 3, 4] as const).map((n) => (
                <button key={n} class={settings.maxGroupSize === n ? 'on' : ''} onClick={() => setSettings({ ...settings, maxGroupSize: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          {n >= 2 && (
            <p class="small muted" style="margin:0">
              {sizes.length === 1 ? tr('Per ronde: 1 groep ({groepen} spelers)', { groepen: sizes.join(' + ') }) : tr('Per ronde: {n} groepen ({groepen} spelers)', { n: sizes.length, groepen: sizes.join(' + ') })}
              {waiting > 0 && tr(', 1 speler wacht (0 punten)')}.
              {tooFewMachines && ' ' + tr('Er zijn minder kasten dan groepen; sommige groepen wachten op een vrije kast.')}
            </p>
          )}
          {n >= 2 && fair && (
            <div class={'advice' + (isFair ? '' : ' warn')}>
              <div>
                {isFair
                  ? tr('Met {r} rondes wacht iedereen {w}× en speelt iedereen {p} potjes.', { r: settings.rounds, w: settings.rounds / n, p: (settings.rounds / n) * (n - 1) })
                  : tr('Met {r} rondes speelt niet iedereen even vaak. Kies een aanbevolen aantal:', { r: settings.rounds })}
              </div>
              <div class="chips" style="margin-top:8px">
                {fair.slice(0, 4).map((r) => (
                  <button key={r} class={'chip' + (r === settings.rounds ? ' on' : '')} onClick={() => setRounds(r)}>
                    {tr('{r} rondes · {p} potjes p.p.', { r, p: (r / n) * (n - 1) })}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div class="row">
            <span class="grow">
              {tr('Punten per plek')}
              <div class="small muted">
                {pointsSummary(settings.pointsTable, settings.maxGroupSize)}
                {' '}
                {isDefaultPoints(settings.pointsTable) ? tr('(standaard)') : tr('(aangepast)')}
              </div>
            </span>
            <button class="btn" onClick={() => setEditPoints(true)}>
              {tr('Punten aanpassen')}
            </button>
          </div>
        </div>
        )}

        <button class="btn primary block big" disabled={selPlayers.size < 2} onClick={start}>
          {tr('Start toernooi')}
        </button>
        {selPlayers.size < 2 && <p class="small muted">{tr('Kies minstens 2 spelers.')}</p>}
      </div>
      {editPoints && (
        <Sheet onClose={() => setEditPoints(false)}>
          <div class="stack">
            <h3>{tr('Punten per plek')}</h3>
            <p class="small muted" style="margin:0">
              {tr('Hoeveel punten krijgt de 1e, 2e, 3e en 4e plek? Dat hangt af van hoeveel spelers er in het potje zitten.')}
            </p>
            {[4, 3, 2]
              .filter((size) => size <= settings.maxGroupSize)
              .map((size) => (
                <div class="points-row" key={size}>
                  <span class="lbl">{tr('{n} spelers', { n: size })}</span>
                  {settings.pointsTable[size].map((v, i) => (
                    <input
                      key={i}
                      type="number"
                      inputMode="numeric"
                      value={v}
                      aria-label={tr('{n} spelers, plek {p}', { n: size, p: i + 1 })}
                      onInput={(e) => setPoints(size, i, e.currentTarget.value)}
                    />
                  ))}
                </div>
              ))}
            <div class="grid2">
              <button class="btn" onClick={() => setSettings({ ...settings, pointsTable: structuredClone(DEFAULT_POINTS) })}>
                {tr('Standaard')}
              </button>
              <button class="btn primary" onClick={() => setEditPoints(false)}>
                {tr('Klaar')}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </Shell>
  );
}
