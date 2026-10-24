import { useState } from 'preact/hooks';
import { dispatch, machineName, playerName, showToast, state, undo } from '../../app/state';
import { go } from '../../app/router';
import type { Game, Tournament } from '../../events/types';
import { formatOf } from '../../formats';
import { pointsFor, roundComplete } from '../../formats/roundRobin/scoring';
import { Shell, UndoRedo } from '../components/Shell';
import { Sheet } from '../components/Sheet';
import { StandingsTable } from '../components/Standings';
import { Thumb } from '../components/Thumb';
import { machineSubtitle } from './Machines';

type Tab = 'ronde' | 'stand' | 'kasten' | 'geschiedenis';

export function TournamentScreen({ id, tab }: { id: string; tab: Tab }) {
  const t = state.value.tournaments.get(id);
  const [editGame, setEditGame] = useState<Game | null>(null);
  const [menu, setMenu] = useState(false);

  if (!t) {
    return (
      <Shell title="Toernooi" back="">
        <p class="empty">Dit toernooi bestaat niet (meer).</p>
      </Shell>
    );
  }

  const base = `t/${t.id}`;
  return (
    <Shell
      title={t.name}
      back=""
      actions={
        <>
          <a class="iconbtn" href={`#/${base}/scorebord`} aria-label="Scorebord" title="Scorebord">
            📺
          </a>
          <button class="iconbtn" onClick={() => setMenu(true)} aria-label="Menu">
            ⋯
          </button>
          <UndoRedo tournamentId={t.id} />
        </>
      }
    >
      <nav class="tabs">
        <a href={`#/${base}`} class={tab === 'ronde' ? 'on' : ''}>
          Ronde
        </a>
        <a href={`#/${base}/stand`} class={tab === 'stand' ? 'on' : ''}>
          Stand
        </a>
        <a href={`#/${base}/kasten`} class={tab === 'kasten' ? 'on' : ''}>
          Kasten
        </a>
        <a href={`#/${base}/geschiedenis`} class={tab === 'geschiedenis' ? 'on' : ''}>
          Uitslagen
        </a>
      </nav>
      {tab === 'ronde' && <RoundTab t={t} onGame={setEditGame} />}
      {tab === 'stand' && <StandingsTable t={t} />}
      {tab === 'kasten' && <MachinesTab t={t} />}
      {tab === 'geschiedenis' && <HistoryTab t={t} onGame={setEditGame} />}
      {editGame && <ResultSheet t={t} gameId={editGame.id} onClose={() => setEditGame(null)} />}
      {menu && <MenuSheet t={t} onClose={() => setMenu(false)} />}
    </Shell>
  );
}

function GameCard({ t, game, onClick }: { t: Tournament; game: Game; onClick: () => void }) {
  const s = state.value;
  const done = !!game.result;
  const list = game.result ?? game.playerIds;
  return (
    <div class={'card tap game' + (done ? ' done' : '')} onClick={onClick}>
      <div class="machine">
        {machineName(s, game.machineId)} {game.corrected && <span class="badge warn">gecorrigeerd</span>}
      </div>
      <ol>
        {list.map((pid, i) => (
          <li key={pid}>
            <span>
              {done ? `${i + 1}. ` : ''}
              {playerName(s, pid)}
            </span>
            {done && <span class="pts">{pointsFor(t.settings.pointsTable, list.length, i)}</span>}
          </li>
        ))}
      </ol>
      {!done && <div class="hint">Tik om de uitslag in te voeren</div>}
    </div>
  );
}

function RoundTab({ t, onGame }: { t: Tournament; onGame: (g: Game) => void }) {
  const round = t.rounds[t.rounds.length - 1];
  const fmt = formatOf(t.format);
  const complete = roundComplete(t);
  const doneCount = round ? round.games.filter((g) => g.result).length : 0;
  const finished = t.status === 'finished';
  const target = t.settings.rounds;

  const nextRound = () => dispatch({ type: 'RoundGenerated', tournamentId: t.id, games: fmt.nextRound(t) });
  const regenerate = () =>
    dispatch({ type: 'RoundRegenerated', tournamentId: t.id, games: fmt.nextRound({ ...t, rounds: t.rounds.slice(0, -1) }) });

  if (!round) {
    return (
      <div class="stack">
        <p class="empty">Er is nog geen ronde.</p>
        <button class="btn primary block big" disabled={t.playerIds.length < 2} onClick={nextRound}>
          Ronde 1 indelen
        </button>
      </div>
    );
  }

  return (
    <div class="stack">
      <div class="row">
        <h2 class="grow" style="margin:0">
          Ronde {round.index + 1} van {Math.max(target, t.rounds.length)}
        </h2>
        {finished ? <span class="badge">afgerond</span> : <span class="badge live">{doneCount}/{round.games.length} ingevoerd</span>}
      </div>
      <div class="games">
        {round.games.map((g) => (
          <GameCard key={g.id} t={t} game={g} onClick={() => onGame(g)} />
        ))}
      </div>
      {!finished && complete && t.rounds.length < target && (
        <button class="btn primary block big" onClick={nextRound}>
          Ronde {t.rounds.length + 1} indelen
        </button>
      )}
      {!finished && complete && t.rounds.length >= target && (
        <>
          <button class="btn primary block big" onClick={() => dispatch({ type: 'TournamentFinished', tournamentId: t.id })}>
            🏁 Toernooi afronden
          </button>
          <button class="btn block" onClick={nextRound}>
            Extra ronde
          </button>
        </>
      )}
      {!finished && doneCount === 0 && (
        <button class="btn ghost block" onClick={regenerate}>
          🔀 Deze ronde opnieuw indelen
        </button>
      )}
      {finished && (
        <div class="card">
          <h2 style="margin-top:0">Eindstand</h2>
          <StandingsTable t={t} />
        </div>
      )}
    </div>
  );
}

/** Info-tab: de kasten van dit toernooi met notities en rulesheet, handig om aan spelers te laten zien. */
function MachinesTab({ t }: { t: Tournament }) {
  const s = state.value;
  const machines = t.machineIds.map((id) => s.machines.get(id)).filter((m) => !!m);
  if (!machines.length) return <p class="empty">Dit toernooi heeft geen kasten.</p>;
  return (
    <ul class="list">
      {machines.map((m) => (
        <li key={m.id} class="card machine-info">
          <a class="row plain" href={'#/kast/' + m.id}>
            <Thumb src={m.imageSmall} size={56} />
            <div class="grow">
              <b>{m.name}</b>
              {machineSubtitle(m) && <div class="small muted">{machineSubtitle(m)}</div>}
            </div>
            <span class="muted">›</span>
          </a>
          {m.notes && <p class="notes-text">{m.notes}</p>}
          <a class="btn block" href={`#/kast/${m.id}/regels`}>
            📖 Spelregels
          </a>
        </li>
      ))}
    </ul>
  );
}

function HistoryTab({ t, onGame }: { t: Tournament; onGame: (g: Game) => void }) {
  const rounds = t.rounds.slice().reverse();
  const any = t.rounds.some((r) => r.games.some((g) => g.result));
  if (!any) return <p class="empty">Nog geen uitslagen ingevoerd.</p>;
  return (
    <div>
      <p class="small muted">Tik op een potje om de uitslag te corrigeren.</p>
      {rounds.map((r) => {
        const played = r.games.filter((g) => g.result);
        if (!played.length) return null;
        return (
          <div key={r.index}>
            <h2>Ronde {r.index + 1}</h2>
            <div class="games">
              {played.map((g) => (
                <GameCard key={g.id} t={t} game={g} onClick={() => onGame(g)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultSheet({ t, gameId, onClose }: { t: Tournament; gameId: string; onClose: () => void }) {
  const s = state.value;
  const game = t.rounds.flatMap((r) => r.games).find((g) => g.id === gameId)!;
  const [order, setOrder] = useState<string[]>(game.result ?? []);
  const [pickMachine, setPickMachine] = useState(false);
  const n = game.playerIds.length;

  const tap = (pid: string) => {
    const i = order.indexOf(pid);
    if (i >= 0) {
      setOrder(order.slice(0, i));
      return;
    }
    const next = [...order, pid];
    if (next.length === n - 1) next.push(game.playerIds.find((p) => !next.includes(p))!);
    setOrder(next);
  };

  const save = () => {
    dispatch({
      type: game.result ? 'ResultCorrected' : 'GameResultEntered',
      tournamentId: t.id,
      gameId: game.id,
      order,
    });
    onClose();
    showToast(game.result ? 'Correctie opgeslagen' : 'Uitslag opgeslagen', { label: 'Ongedaan maken', run: () => undo(t.id) });
  };

  const unchanged = !!game.result && game.result.join() === order.join();
  const machineOptions = [...t.machineIds.map((id) => s.machines.get(id)).filter((m) => !!m), null];

  return (
    <Sheet onClose={onClose}>
      <div class="row">
        <h3 class="grow">
          {game.machineId ? (
            <a class="plain" href={'#/kast/' + game.machineId}>
              {machineName(s, game.machineId)} <span class="muted small">ⓘ</span>
            </a>
          ) : (
            machineName(s, game.machineId)
          )}
        </h3>
        {t.status === 'active' && (
          <button class="btn ghost small" onClick={() => setPickMachine(!pickMachine)}>
            Andere kast
          </button>
        )}
      </div>
      {pickMachine && (
        <div class="chips" style="margin:10px 0">
          {machineOptions.map((m) => (
            <button
              key={m?.id ?? 'free'}
              class={'chip' + ((m?.id ?? null) === game.machineId ? ' on' : '')}
              onClick={() => {
                dispatch({ type: 'GameMachineChanged', tournamentId: t.id, gameId: game.id, machineId: m?.id ?? null });
                setPickMachine(false);
              }}
            >
              {m?.name ?? 'Vrije kast'}
            </button>
          ))}
        </div>
      )}
      <p class="muted" style="margin:4px 0 0">
        {game.result ? 'Uitslag corrigeren. ' : ''}Tik de spelers aan in volgorde van finish: eerst de winnaar.
      </p>
      <div class="order-btns">
        {game.playerIds.map((pid) => {
          const pos = order.indexOf(pid);
          return (
            <button key={pid} class={'order-btn' + (pos >= 0 ? ' set' : '')} onClick={() => tap(pid)}>
              <span class="pos">{pos >= 0 ? pos + 1 : ''}</span>
              {playerName(s, pid)}
              {pos >= 0 && <span class="pts">{pointsFor(t.settings.pointsTable, n, pos)} ptn</span>}
            </button>
          );
        })}
      </div>
      <div class="stack">
        <button class="btn primary block big" disabled={order.length !== n || unchanged} onClick={save}>
          {game.result ? 'Correctie opslaan' : 'Uitslag opslaan'}
        </button>
        <div class="grid2">
          <button class="btn" disabled={!order.length} onClick={() => setOrder([])}>
            Wissen
          </button>
          <button class="btn ghost" onClick={onClose}>
            Annuleren
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function MenuSheet({ t, onClose }: { t: Tournament; onClose: () => void }) {
  const [players, setPlayers] = useState(false);
  if (players) return <PlayersSheet t={t} onClose={onClose} />;
  return (
    <Sheet onClose={onClose}>
      <div class="stack">
        <h3>{t.name}</h3>
        {t.status === 'active' && (
          <button class="btn block" onClick={() => setPlayers(true)}>
            👤 Deelnemers aan-/afmelden
          </button>
        )}
        {t.status === 'active' ? (
          <button
            class="btn block"
            onClick={() => {
              dispatch({ type: 'TournamentFinished', tournamentId: t.id });
              onClose();
            }}
          >
            🏁 Toernooi afronden
          </button>
        ) : (
          <button
            class="btn block"
            onClick={() => {
              dispatch({ type: 'TournamentReopened', tournamentId: t.id });
              onClose();
            }}
          >
            ↩ Toernooi heropenen
          </button>
        )}
        <button
          class="btn danger block"
          onClick={() => {
            if (!confirm(`"${t.name}" verwijderen?`)) return;
            dispatch({ type: 'TournamentDeleted', tournamentId: t.id });
            onClose();
            go('');
            const id = t.id;
            showToast(`${t.name} verwijderd`, {
              label: 'Herstellen',
              run: () => {
                undo(id);
                go('t/' + id);
              },
            });
          }}
        >
          Toernooi verwijderen
        </button>
        <button class="btn ghost block" onClick={onClose}>
          Sluiten
        </button>
      </div>
    </Sheet>
  );
}

function PlayersSheet({ t, onClose }: { t: Tournament; onClose: () => void }) {
  const s = state.value;
  const [sel, setSel] = useState(new Set(t.playerIds));
  const all = [...s.players.values()]
    .filter((p) => !p.archived || t.playerIds.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const changed = sel.size !== t.playerIds.length || t.playerIds.some((id) => !sel.has(id));
  return (
    <Sheet onClose={onClose}>
      <div class="stack">
        <h3>Deelnemers</h3>
        <p class="small muted">Wijzigingen gelden vanaf de volgende ronde. Gespeelde uitslagen blijven staan.</p>
        <div class="chips">
          {all.map((p) => (
            <button
              key={p.id}
              class={'chip' + (sel.has(p.id) ? ' on' : '')}
              onClick={() => {
                const n = new Set(sel);
                n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                setSel(n);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          class="btn primary block"
          disabled={!changed || sel.size < 2}
          onClick={() => {
            dispatch({ type: 'TournamentPlayersChanged', tournamentId: t.id, playerIds: [...sel] });
            onClose();
          }}
        >
          Opslaan ({sel.size} spelers)
        </button>
        <button class="btn ghost block" onClick={onClose}>
          Annuleren
        </button>
      </div>
    </Sheet>
  );
}
