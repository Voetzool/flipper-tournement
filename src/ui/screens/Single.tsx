import { locale, tr } from '../../i18n';
import { useState } from 'preact/hooks';
import { dispatch, machineName, playerName, ratings, showToast, state, undo } from '../../app/state';
import { go } from '../../app/router';
import { ranksOf } from '../../events/ranks';
import type { Id, Tournament } from '../../events/types';
import { newId } from '../../lib/id';
import { shuffle } from '../../lib/rng';
import { Shell, UndoRedo } from '../components/Shell';
import { Thumb } from '../components/Thumb';
import { Delta } from './Ranking';
import { ResultSheet } from './Tournament';

type Mode = 'ffa' | 'teams';

/** Willekeurige kast uit een selectie. */
export function pickRandom<T>(pool: readonly T[], rng: () => number = Math.random): T | null {
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/**
 * Een losse ranked pot opzetten: spelers kiezen (iedereen voor zich of in teams) en een kast (zelf of willekeurig).
 * `from` = id van een vorige pot om dezelfde instellingen over te nemen ("nog een pot").
 */
export function NewSingleScreen({ from }: { from?: string }) {
  const s = state.value;
  const prev = from ? s.tournaments.get(from) : undefined;
  const prevGame = prev?.rounds[0]?.games[0];
  const players = [...s.players.values()].filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const machines = [...s.machines.values()].filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  const [mode, setMode] = useState<Mode>(prevGame?.teams ? 'teams' : 'ffa');
  const [sel, setSel] = useState<Id[]>(prevGame?.playerIds ?? []);
  // Team per speler (0 = A, 1 = B)
  const [teamOf, setTeamOf] = useState<Record<Id, number>>(() => {
    const t: Record<Id, number> = {};
    prevGame?.teams?.forEach((tm, i) => tm.forEach((id) => (t[id] = i)));
    return t;
  });
  const [machineMode, setMachineMode] = useState<'choose' | 'random'>(prev && prev.machineIds.length > 1 ? 'random' : 'choose');
  const [chosen, setChosen] = useState<Id | null>(prev && prev.machineIds.length === 1 ? prev.machineIds[0] : null);
  const [pool, setPool] = useState<Set<Id>>(() => new Set(prev && prev.machineIds.length > 1 ? prev.machineIds : machines.map((m) => m.id)));
  const [picked, setPicked] = useState<Id | null>(null);

  const togglePlayer = (id: Id) => {
    if (sel.includes(id)) {
      setSel(sel.filter((p) => p !== id));
      return;
    }
    setSel([...sel, id]);
    // nieuwe speler in het kleinste team
    const a = sel.filter((p) => (teamOf[p] ?? 0) === 0).length;
    const b = sel.length - a;
    if (teamOf[id] === undefined) setTeamOf({ ...teamOf, [id]: a <= b ? 0 : 1 });
  };

  const team = (id: Id) => teamOf[id] ?? 0;
  const teams: Id[][] = [sel.filter((p) => team(p) === 0), sel.filter((p) => team(p) === 1)];
  const drawTeams = () => {
    const order = shuffle(sel, Math.random);
    const t: Record<Id, number> = {};
    order.forEach((id, i) => (t[id] = i % 2));
    setTeamOf(t);
  };

  const poolList = machines.filter((m) => pool.has(m.id)).map((m) => m.id);
  const roll = () => setPicked(pickRandom(poolList.filter((id) => id !== picked).length ? poolList.filter((id) => id !== picked) : poolList));

  const valid = sel.length >= 2 && (mode === 'ffa' || (teams[0].length > 0 && teams[1].length > 0));

  const start = () => {
    const machineId = machineMode === 'choose' ? chosen : (picked ?? pickRandom(poolList));
    const tournamentId = newId();
    const when = new Date().toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    dispatch({
      type: 'TournamentCreated',
      tournamentId,
      name: `${tr('Losse pot')} · ${when}`,
      format: 'single',
      settings: { rounds: 1, maxGroupSize: 2, pointsTable: {} },
      playerIds: sel,
      // Bij willekeurig de selectie bewaren (voor "nog een pot"), anders alleen de gekozen kast.
      machineIds: machineMode === 'random' ? poolList : machineId ? [machineId] : [],
      firstRound: [{ id: newId(), machineId, playerIds: sel, ...(mode === 'teams' ? { teams } : {}) }],
    });
    go('t/' + tournamentId);
  };

  return (
    <Shell title={tr('Losse ranked pot')} back="">
      <div class="stack">
        <p class="small muted" style="margin:0">
          {tr('Eén potje dat meetelt voor de ranglijst.')}
        </p>
        <div class="seg">
          <button class={mode === 'ffa' ? 'on' : ''} onClick={() => setMode('ffa')}>
            {tr('Iedereen voor zich')}
          </button>
          <button class={mode === 'teams' ? 'on' : ''} onClick={() => setMode('teams')}>
            {tr('Teams')}
          </button>
        </div>

        <h2>{tr('Spelers ({n})', { n: sel.length })}</h2>
        {!players.length && (
          <p class="muted">
            {tr('Nog geen spelers.')} <a href="#/spelers">{tr('Voeg eerst spelers toe')}</a>.
          </p>
        )}
        <div class="chips">
          {players.map((p) => (
            <button key={p.id} class={'chip' + (sel.includes(p.id) ? ' on' : '')} onClick={() => togglePlayer(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
        {mode === 'ffa' && sel.length > 4 && <p class="small" style="color:var(--yellow);margin:0">{tr('Let op: de meeste kasten hebben maximaal 4 spelers.')}</p>}

        {mode === 'teams' && sel.length > 0 && (
          <div class="card stack">
            <div class="row">
              <span class="grow small muted">{tr('Tik op een speler om van team te wisselen.')}</span>
              <button class="btn" disabled={sel.length < 2} onClick={drawTeams}>
                🎲 {tr('Teams loten')}
              </button>
            </div>
            <div class="grid2">
              {teams.map((tm, i) => (
                <div key={i} class={'team team-' + i}>
                  <b>{tr('Team {t}', { t: String.fromCharCode(65 + i) })}</b>
                  {tm.map((id) => (
                    <button key={id} class="chip on" onClick={() => setTeamOf({ ...teamOf, [id]: 1 - team(id) })}>
                      {playerName(s, id)} ⇄
                    </button>
                  ))}
                  {!tm.length && <span class="small muted">{tr('nog niemand')}</span>}
                </div>
              ))}
            </div>
            <span class="small muted">
              {tr('{a}-tegen-{b}', { a: teams[0].length, b: teams[1].length })}
            </span>
          </div>
        )}

        <h2>{tr('Kast')}</h2>
        <div class="seg">
          <button class={machineMode === 'choose' ? 'on' : ''} onClick={() => setMachineMode('choose')}>
            {tr('Zelf kiezen')}
          </button>
          <button class={machineMode === 'random' ? 'on' : ''} onClick={() => setMachineMode('random')}>
            🎲 {tr('Willekeurig')}
          </button>
        </div>
        {!machines.length && (
          <p class="muted">
            {tr('Nog geen kasten.')} <a href="#/kasten">{tr('Voeg kasten toe')}</a> {tr('(mag ook zonder).')}
          </p>
        )}
        {machineMode === 'choose' ? (
          <div class="chips">
            {machines.map((m) => (
              <button key={m.id} class={'chip' + (chosen === m.id ? ' on' : '')} onClick={() => setChosen(chosen === m.id ? null : m.id)}>
                {m.name}
              </button>
            ))}
          </div>
        ) : (
          <div class="card stack">
            <div class="row">
              <span class="grow small muted">{tr('Kies uit welke kasten geloot wordt ({n}):', { n: poolList.length })}</span>
              <button class="btn ghost small" onClick={() => setPool(poolList.length === machines.length ? new Set() : new Set(machines.map((m) => m.id)))}>
                {poolList.length === machines.length ? tr('Geen') : tr('Alle')}
              </button>
            </div>
            <div class="chips">
              {machines.map((m) => (
                <button
                  key={m.id}
                  class={'chip' + (pool.has(m.id) ? ' on' : '')}
                  onClick={() => {
                    const n = new Set(pool);
                    n.has(m.id) ? n.delete(m.id) : n.add(m.id);
                    setPool(n);
                    if (picked === m.id) setPicked(null);
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <button class="btn cyan block" disabled={!poolList.length} onClick={roll}>
              🎲 {picked ? tr('Opnieuw loten') : tr('Kies een kast')}
            </button>
            {picked && (
              <div class="picked">
                <Thumb src={s.machines.get(picked)?.imageSmall} size={56} />
                <b>{machineName(s, picked)}</b>
              </div>
            )}
            {!picked && poolList.length > 0 && <span class="small muted">{tr('Of start meteen: dan loot de app bij het starten.')}</span>}
          </div>
        )}

        <button class="btn primary block big" disabled={!valid} onClick={start}>
          {tr('Start pot')}
        </button>
        {!valid && (
          <p class="small muted">{mode === 'teams' ? tr('Kies spelers en zet in elk team minstens één speler.') : tr('Kies minstens 2 spelers.')}</p>
        )}
      </div>
    </Shell>
  );
}

/** Scherm van één losse pot: uitslag invoeren, daarna uitslag + ratingwijziging. */
export function SingleGameView({ t }: { t: Tournament }) {
  const s = state.value;
  const game = t.rounds[0]?.games[0];
  const [entering, setEntering] = useState(false);
  if (!game) return null;
  const ranks = game.result ? ranksOf(game) : null;
  const r = ratings.value;
  const deltaFor = (id: Id) => r.get(id)?.history.find((h) => h.gameId === game.id);
  const order = game.result ?? game.playerIds;

  return (
    <Shell
      title={tr('Losse pot')}
      back=""
      actions={<UndoRedo tournamentId={t.id} />}
    >
      <div class="stack">
        <div class="card stack">
          <div class="row">
            <Thumb src={game.machineId ? s.machines.get(game.machineId)?.imageSmall : undefined} size={56} />
            <div class="grow">
              <div class="machine-title">{machineName(s, game.machineId)}</div>
              <div class="small muted">{t.name.replace(/^[^·]*· /, '')}</div>
            </div>
            {game.machineId && (
              <a class="btn" href={`#/kast/${game.machineId}/regels`}>
                📖 {tr('Regels')}
              </a>
            )}
          </div>
          {game.teams ? (
            <div class="grid2">
              {game.teams.map((tm, i) => (
                <div key={i} class={'team team-' + i + (ranks && ranks.get(tm[0]) === 0 ? ' won' : '')}>
                  <b>
                    {tr('Team {t}', { t: String.fromCharCode(65 + i) })} {ranks && ranks.get(tm[0]) === 0 && '🏆'}
                  </b>
                  {tm.map((id) => (
                    <PlayerLine key={id} name={playerName(s, id)} delta={deltaFor(id)?.delta} rating={deltaFor(id)?.rating} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <ol class="single-order">
              {order.map((id) => (
                <li key={id}>
                  <span class="pos">{ranks ? ranks.get(id)! + 1 : ''}</span>
                  <PlayerLine name={playerName(s, id)} delta={deltaFor(id)?.delta} rating={deltaFor(id)?.rating} />
                </li>
              ))}
            </ol>
          )}
        </div>

        <button class={'btn block big ' + (game.result ? '' : 'primary')} onClick={() => setEntering(true)}>
          {game.result ? tr('Uitslag corrigeren') : tr('Uitslag invoeren')}
        </button>
        {game.result && (
          <button class="btn primary block big" onClick={() => go('pot/' + t.id)}>
            ⚡ {tr('Nog een pot')}
          </button>
        )}
        <button
          class="btn ghost block"
          onClick={() => {
            if (!confirm(tr('Deze pot verwijderen?'))) return;
            dispatch({ type: 'TournamentDeleted', tournamentId: t.id });
            go('');
            showToast(tr('Pot verwijderd'), { label: tr('Herstellen'), run: () => (undo(t.id), go('t/' + t.id)) });
          }}
        >
          {tr('Pot verwijderen')}
        </button>
      </div>
      {entering && <ResultSheet t={t} gameId={game.id} onClose={() => setEntering(false)} />}
    </Shell>
  );
}

function PlayerLine({ name, delta, rating }: { name: string; delta?: number; rating?: number }) {
  return (
    <span class="player-line">
      <span class="grow">{name}</span>
      {delta !== undefined && (
        <span class="small">
          <Delta value={delta} /> <span class="muted">{Math.round(rating!)}</span>
        </span>
      )}
    </span>
  );
}
