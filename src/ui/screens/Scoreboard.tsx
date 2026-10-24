import { useEffect } from 'preact/hooks';
import { machineName, playerName, state } from '../../app/state';
import { formatOf } from '../../formats';
import { isTiebreakRound } from '../../formats/headToHead';
import { UndoRedo } from '../components/Shell';

/** Grote weergave voor een tablet aan de muur. Scherm blijft aan (waar de browser dat toestaat). */
export function ScoreboardScreen({ id }: { id: string }) {
  const s = state.value;
  const t = s.tournaments.get(id);

  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const request = () => navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    request();
    const onVis = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  if (!t) return <p class="empty">Toernooi niet gevonden.</p>;
  const rows = formatOf(t.format).standings(t);
  const round = t.rounds[t.rounds.length - 1];
  const open = round?.games.filter((g) => !g.result) ?? [];

  return (
    <div class="scoreboard">
      <header>
        <a class="iconbtn" href={`#/t/${t.id}`} aria-label="Terug">
          ‹
        </a>
        <h1>{t.name}</h1>
        <UndoRedo tournamentId={t.id} />
        <button class="iconbtn" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} aria-label="Volledig scherm">
          ⛶
        </button>
      </header>
      <div class="sub" style="margin-bottom:2vh">
        {t.status === 'finished'
          ? 'Eindstand'
          : isTiebreakRound(round)
            ? '⚔️ Tie-breaker'
            : round
              ? `Ronde ${round.index + 1} van ${Math.max(t.settings.rounds, t.rounds.length)}`
              : ''}
      </div>
      <div class={'sb-cols' + (open.length ? ' two' : '')}>
        {/* Rijen krimpen mee zodat de hele stand op één scherm past. */}
        <div class="sb-list" style={`--sb-size: clamp(14px, min(3.6vw, calc((100dvh - 280px) / ${(rows.length * 2.3).toFixed(1)})), 52px)`}>
          {rows.map((r) => (
            <div key={r.playerId} class={'sb-row rank-' + r.rank}>
              <span class="r">{r.rank}</span>
              <span>{playerName(s, r.playerId)}</span>
              <span class="p">{r.points}</span>
            </div>
          ))}
        </div>
        {open.length > 0 && t.status === 'active' && (
          <div class="sb-games stack">
            <div class="sub">Nu spelen</div>
            {open.map((g) => (
              <div key={g.id} class="card game">
                <div class="machine">{machineName(s, g.machineId)}</div>
                <div>{g.playerIds.map((p) => playerName(s, p)).join(' · ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
