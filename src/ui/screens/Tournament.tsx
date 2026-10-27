import { Icon } from '../components/Icon';
import { tr } from '../../i18n';
import { useState } from 'preact/hooks';
import { dispatch, machineName, playerName, showToast, state, undo } from '../../app/state';
import { go } from '../../app/router';
import type { Game, Tournament } from '../../events/types';
import { formatOf } from '../../formats';
import { isTiebreakRound, tiebreakGame, tiebreakPlayers, waitingPlayers } from '../../formats/headToHead';
import { allRoundsComplete, canLookAhead, gameStatus, openRounds } from '../../formats/progress';
import { pointsFor } from '../../formats/roundRobin/scoring';
import { Shell, UndoRedo } from '../components/Shell';
import { Sheet } from '../components/Sheet';
import { StandingsTable } from '../components/Standings';
import { Thumb } from '../components/Thumb';
import { SingleGameView } from './Single';
import { machineSubtitle } from './Machines';

type Tab = 'ronde' | 'stand' | 'kasten' | 'geschiedenis';

/** Zonder tab in de URL: lopend toernooi opent op Ronde, afgerond toernooi op Stand. */
export type TabRoute = Tab | 'auto';

export function TournamentScreen({ id, tab: tabRoute }: { id: string; tab: TabRoute }) {
  const t = state.value.tournaments.get(id);
  const [editGame, setEditGame] = useState<Game | null>(null);
  const [menu, setMenu] = useState(false);

  if (!t) {
    return (
      <Shell title={tr('Toernooi')} back="">
        <p class="empty">{tr('Dit toernooi bestaat niet (meer).')}</p>
      </Shell>
    );
  }

  if (t.format === 'single') return <SingleGameView t={t} />;

  const base = `t/${t.id}`;
  const tab: Tab = tabRoute === 'auto' ? (t.status === 'finished' ? 'stand' : 'ronde') : tabRoute;
  return (
    <Shell
      title={t.name}
      back=""
      actions={
        <>
          <a class="iconbtn" href={`#/${base}/scorebord`} aria-label={tr('Scorebord')} title={tr('Scorebord')}>
            <Icon name="scoreboard" />
          </a>
          <button class="iconbtn" onClick={() => setMenu(true)} aria-label={tr('Menu')}>
            <Icon name="more_vert" />
          </button>
          <UndoRedo tournamentId={t.id} />
        </>
      }
    >
      <nav class="tabs">
        <a href={`#/${base}/ronde`} class={tab === 'ronde' ? 'on' : ''}>
          {tr('Ronde')}
        </a>
        <a href={`#/${base}/stand`} class={tab === 'stand' ? 'on' : ''}>
          {tr('Stand')}
        </a>
        <a href={`#/${base}/kasten`} class={tab === 'kasten' ? 'on' : ''}>
          {tr('Machines')}
        </a>
        <a href={`#/${base}/geschiedenis`} class={tab === 'geschiedenis' ? 'on' : ''}>
          {tr('Uitslagen')}
        </a>
      </nav>
      {tab === 'ronde' && <RoundTab t={t} onGame={setEditGame} />}
      {tab === 'stand' && (
        <div class="stack">
          <WinnerBanner t={t} />
          <StandingsTable t={t} />
        </div>
      )}
      {tab === 'kasten' && <MachinesTab t={t} />}
      {tab === 'geschiedenis' && <HistoryTab t={t} onGame={setEditGame} />}
      {editGame && <ResultSheet t={t} gameId={editGame.id} onClose={() => setEditGame(null)} />}
      {menu && <MenuSheet t={t} onClose={() => setMenu(false)} />}
    </Shell>
  );
}

/** Winnaar bovenaan een afgerond toernooi (alleen bij één duidelijke winnaar). */
function WinnerBanner({ t }: { t: Tournament }) {
  if (t.status !== 'finished') return null;
  const standings = formatOf(t.format).standings(t);
  const winner = standings.filter((r) => r.rank === 1).length === 1 ? standings[0] : null;
  if (!winner) return null;
  return (
    <div class="banner winner">
      <span class="grow">
        <Icon name="trophy" /> {tr('Winnaar:')} <b>{playerName(state.value, winner.playerId)}</b>
        {winner.note ? ` (${tr(winner.note)})` : ''}
      </span>
    </div>
  );
}

function GameCard({ t, game, onClick, showStatus }: { t: Tournament; game: Game; onClick: () => void; showStatus?: boolean }) {
  const s = state.value;
  const done = !!game.result;
  const list = game.result ?? game.playerIds;
  const status = showStatus && !done ? gameStatus(t, game) : null;
  return (
    <div class={'card tap game' + (done ? ' done' : '') + (status?.state === 'busy' ? ' busy' : '')} onClick={onClick}>
      <div class="machine">
        {machineName(s, game.machineId)} {game.tiebreak && <span class="badge live">{tr('tie-breaker')}</span>}{' '}
        {game.corrected && <span class="badge warn">{tr('gecorrigeerd')}</span>}
        {status?.state === 'ready' && <span class="badge live"><Icon name="play_arrow" /> {tr('speel nu')}</span>}
      </div>
      {status?.state === 'busy' && (
        <div class="small muted wait-reason">
          <Icon name="hourglass_top" /> {status.waitingFor.length ? tr('Wacht op {namen}', { namen: status.waitingFor.map((id) => playerName(s, id)).join(', ') }) : ''}
          {status.waitingFor.length && status.machineBusy ? ' · ' : ''}
          {status.machineBusy ? tr('machine nog bezet') : ''}
        </div>
      )}
      <ol>
        {list.map((pid, i) => (
          <li key={pid}>
            <span>
              {done ? `${i + 1}. ` : ''}
              {playerName(s, pid)}
            </span>
            {done && !game.tiebreak && <span class="pts">{pointsFor(t.settings.pointsTable, list.length, i)}</span>}
          </li>
        ))}
      </ol>
      {!done && <div class="hint">{tr('Tik om de uitslag in te voeren')}</div>}
    </div>
  );
}

function RoundTab({ t, onGame }: { t: Tournament; onGame: (g: Game) => void }) {
  const last = t.rounds[t.rounds.length - 1];
  const fmt = formatOf(t.format);
  const h2h = t.format === 'headToHead';
  const complete = allRoundsComplete(t);
  const finished = t.status === 'finished';
  const target = t.settings.rounds;
  const regularCount = t.rounds.filter((r) => !isTiebreakRound(r)).length;
  const tied = h2h ? tiebreakPlayers(t) : [];
  const needsTiebreak = h2h && tied.length > 0 && !tiebreakGame(t);
  const s = state.value;

  const nextRound = () => dispatch({ type: 'RoundGenerated', tournamentId: t.id, games: fmt.nextRound(t) });
  const finish = () => {
    dispatch({ type: 'TournamentFinished', tournamentId: t.id });
    go(`t/${t.id}/stand`);
  };
  const regenerate = () =>
    dispatch({ type: 'RoundRegenerated', tournamentId: t.id, games: fmt.nextRound({ ...t, rounds: t.rounds.slice(0, -1) }) });

  if (!last) {
    return (
      <div class="stack">
        <p class="empty">{tr('Er is nog geen ronde.')}</p>
        <button class="btn primary block big" disabled={t.playerIds.length < 2} onClick={nextRound}>
          {tr('Ronde {n}', { n: 1 })}
        </button>
      </div>
    );
  }

  // Lopende rondes (bij vooruit spelen twee), anders de laatste ronde.
  const open = openRounds(t);
  const shown = open.length ? open : [last];
  const lookAhead = !finished && canLookAhead(t);

  return (
    <div class="stack">
      <WinnerBanner t={t} />
      {shown.map((round, i) => {
        const doneCount = round.games.filter((g) => g.result).length;
        const waiting = waitingPlayers(t, round);
        return (
          <div key={round.index} class="stack">
            <div class="row">
              <h2 class="grow" style="margin:0">
                {isTiebreakRound(round) ? <><Icon name="swords" /> {tr('Tie-breaker')}</> : tr('Ronde {n} van {totaal}', { n: round.index + 1, totaal: Math.max(target, regularCount) })}
              </h2>
              {i > 0 && <span class="badge warn">{tr('vooruit')}</span>}
              {finished ? <span class="badge">{tr('afgerond')}</span> : <span class="badge live">{tr('{n}/{totaal} ingevoerd', { n: doneCount, totaal: round.games.length })}</span>}
            </div>
            {isTiebreakRound(round) && (
              <p class="small muted" style="margin:0">
                {round.games[0].playerIds.length > 2
                  ? tr('Alle spelers met evenveel punten spelen op dezelfde machine. De winnaar wint het toernooi.')
                  : tr('Eén potje: de winnaar wint het toernooi.')}
              </p>
            )}
            <div class="games">
              {round.games.map((g) => (
                <GameCard key={g.id} t={t} game={g} onClick={() => onGame(g)} showStatus={shown.length > 1} />
              ))}
            </div>
            {waiting.length > 0 && (
              <div class="card small">
                <Icon name="pause_circle" /> {tr('Wacht deze ronde:')} <b>{waiting.map((id) => playerName(s, id)).join(', ')}</b>
              </div>
            )}
          </div>
        );
      })}
      {lookAhead && (
        <>
          <button class="btn cyan block" onClick={nextRound}>
            <Icon name="fast_forward" /> {tr('Ronde {n}', { n: t.rounds.length + 1 })}
          </button>
          <p class="small muted" style="margin:-4px 0 0">{tr('Wie klaar is, kan alvast beginnen aan de volgende ronde.')}</p>
        </>
      )}
      {!finished && complete && regularCount < target && (
        <button class="btn primary block big" onClick={nextRound}>
          {tr('Ronde {n}', { n: t.rounds.length + 1 })}
        </button>
      )}
      {!finished && complete && regularCount >= target && needsTiebreak && (
        <>
          <div class="banner">
            <span class="grow">
              {tr('Gelijke stand bovenaan:')} <b>{tied.map((id) => playerName(s, id)).join(', ')}</b>
            </span>
          </div>
          <button class="btn primary block big" onClick={nextRound}>
            <Icon name="swords" /> {tr('Tie-breaker starten')}
          </button>
        </>
      )}
      {!finished && complete && regularCount >= target && !needsTiebreak && (
        <>
          <button class="btn primary block big" onClick={finish}>
            <Icon name="sports_score" /> {tr('Toernooi afronden')}
          </button>
          {!h2h && (
            <button class="btn block" onClick={nextRound}>
              {tr('Extra ronde')}
            </button>
          )}
        </>
      )}
      {!finished && !h2h && last.games.every((g) => !g.result) && (
        <button class="btn ghost block" onClick={regenerate}>
          <Icon name="shuffle" /> {tr('Ronde {n} opnieuw indelen', { n: last.index + 1 })}
        </button>
      )}
    </div>
  );
}

/** Info-tab: de kasten van dit toernooi met notities en rulesheet, handig om aan spelers te laten zien. */
function MachinesTab({ t }: { t: Tournament }) {
  const s = state.value;
  const machines = t.machineIds.map((id) => s.machines.get(id)).filter((m) => !!m);
  if (!machines.length) return <p class="empty">{tr('Dit toernooi heeft geen machines.')}</p>;
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
            <span class="muted"><Icon name="chevron_right" /></span>
          </a>
          {m.notes && <p class="notes-text">{m.notes}</p>}
          <a class="btn block" href={`#/kast/${m.id}/regels`}>
            <Icon name="menu_book" /> {tr('Spelregels')}
          </a>
        </li>
      ))}
    </ul>
  );
}

function HistoryTab({ t, onGame }: { t: Tournament; onGame: (g: Game) => void }) {
  const rounds = t.rounds.slice().reverse();
  const any = t.rounds.some((r) => r.games.some((g) => g.result));
  if (!any) return <p class="empty">{tr('Nog geen uitslagen ingevoerd.')}</p>;
  return (
    <div>
      <p class="small muted">{tr('Tik op een potje om de uitslag te corrigeren.')}</p>
      {rounds.map((r) => {
        const played = r.games.filter((g) => g.result);
        if (!played.length) return null;
        return (
          <div key={r.index}>
            <h2>{tr('Ronde {n}', { n: r.index + 1 })}</h2>
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

export function ResultSheet({ t, gameId, onClose }: { t: Tournament; gameId: string; onClose: () => void }) {
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
    showToast(game.result ? tr('Correctie opgeslagen') : tr('Uitslag opgeslagen'), { label: tr('Ongedaan maken'), run: () => undo(t.id) });
  };

  const unchanged = !!game.result && game.result.join() === order.join();
  // Losse pot: elke actieve kast mag; toernooi: alleen de kasten van het toernooi.
  const machineOptions = [
    ...(t.format === 'single' ? [...s.machines.values()].filter((m) => m.active) : t.machineIds.map((id) => s.machines.get(id)).filter((m) => !!m)),
    null,
  ];
  const teams = game.teams;
  const winnerTeam = teams && order.length ? teams.findIndex((tm) => tm.includes(order[0])) : -1;
  const pickTeam = (i: number) => setOrder([...teams![i], ...teams!.filter((_, j) => j !== i).flat()]);

  return (
    <Sheet onClose={onClose}>
      <div class="row">
        <h3 class="grow">
          {game.machineId ? (
            <a class="plain" href={'#/kast/' + game.machineId}>
              {machineName(s, game.machineId)} <span class="muted small"><Icon name="info" /></span>
            </a>
          ) : (
            machineName(s, game.machineId)
          )}
        </h3>
        {t.status === 'active' && (
          <button class="btn ghost small" onClick={() => setPickMachine(!pickMachine)}>
            {tr('Andere machine')}
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
              {m?.name ?? tr('Vrije machine')}
            </button>
          ))}
        </div>
      )}
      <p class="muted" style="margin:4px 0 0">
        {game.result ? tr('Uitslag corrigeren.') + ' ' : ''}
        {teams ? tr('Tik op het team dat gewonnen heeft.') : tr('Tik de spelers aan in volgorde van finish: eerst de winnaar.')}
      </p>
      {teams ? (
        <div class="order-btns">
          {teams.map((tm, i) => (
            <button key={i} class={'order-btn' + (winnerTeam === i ? ' set win' : winnerTeam >= 0 ? ' lose' : '')} onClick={() => pickTeam(i)}>
              <span class="pos">{winnerTeam === i ? <Icon name="check" /> : String.fromCharCode(65 + i)}</span>
              <span>
                {tr('Team {t} wint', { t: String.fromCharCode(65 + i) })}
                <div class="small muted">{tm.map((id) => playerName(s, id)).join(' & ')}</div>
              </span>
            </button>
          ))}
        </div>
      ) : (
      <div class="order-btns">
        {game.playerIds.map((pid) => {
          const pos = order.indexOf(pid);
          return (
            <button key={pid} class={'order-btn' + (pos === 0 ? ' set win' : pos > 0 ? ' set' : '')} onClick={() => tap(pid)}>
              <span class="pos">{pos === 0 ? <Icon name="check" /> : pos > 0 ? pos + 1 : ''}</span>
              {playerName(s, pid)}
              {pos >= 0 && !game.tiebreak && t.format !== 'single' && <span class="pts">{tr('{n} ptn', { n: pointsFor(t.settings.pointsTable, n, pos) })}</span>}
            </button>
          );
        })}
      </div>
      )}
      <div class="stack">
        <button class="btn primary block big" disabled={order.length !== n || unchanged} onClick={save}>
          {game.result ? tr('Correctie opslaan') : tr('Uitslag opslaan')}
        </button>
        <div class="grid2">
          <button class="btn" disabled={!order.length} onClick={() => setOrder([])}>
            {tr('Wissen')}
          </button>
          <button class="btn ghost" onClick={onClose}>
            {tr('Annuleren')}
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
        {t.status === 'active' && t.format !== 'headToHead' && (
          <button class="btn block" onClick={() => setPlayers(true)}>
            <Icon name="person" /> {tr('Deelnemers aan-/afmelden')}
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
            <Icon name="sports_score" /> {tr('Toernooi afronden')}
          </button>
        ) : (
          <button
            class="btn block"
            onClick={() => {
              dispatch({ type: 'TournamentReopened', tournamentId: t.id });
              onClose();
            }}
          >
            <Icon name="undo" /> {tr('Toernooi heropenen')}
          </button>
        )}
        <button
          class="btn danger block"
          onClick={() => {
            if (!confirm(tr('{naam} verwijderen?', { naam: `"${t.name}"` }))) return;
            dispatch({ type: 'TournamentDeleted', tournamentId: t.id });
            onClose();
            go('');
            const id = t.id;
            showToast(tr('{naam} verwijderd', { naam: t.name }), {
              label: tr('Herstellen'),
              run: () => {
                undo(id);
                go('t/' + id);
              },
            });
          }}
        >
          {tr('Toernooi verwijderen')}
        </button>
        <button class="btn ghost block" onClick={onClose}>
          {tr('Sluiten')}
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
        <h3>{tr('Deelnemers')}</h3>
        <p class="small muted">{tr('Wijzigingen gelden vanaf de volgende ronde. Gespeelde uitslagen blijven staan.')}</p>
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
          {tr('Opslaan ({n} spelers)', { n: sel.size })}
        </button>
        <button class="btn ghost block" onClick={onClose}>
          {tr('Annuleren')}
        </button>
      </div>
    </Sheet>
  );
}
