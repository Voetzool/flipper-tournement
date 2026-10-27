import { Icon } from '../components/Icon';
import { tr } from '../../i18n';
import { useEffect } from 'preact/hooks';
import { machineName, playerName, state } from '../../app/state';
import { formatOf } from '../../formats';
import { isTiebreakRound, waitingPlayers } from '../../formats/headToHead';
import { gameStatus, openRounds } from '../../formats/progress';
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

  if (!t) return <p class="empty">{tr('Toernooi niet gevonden.')}</p>;
  const rows = formatOf(t.format).standings(t);
  // Bij vooruit spelen lopen er twee rondes; "Nu spelen" = de potjes die nu echt gespeeld kunnen worden.
  const running = openRounds(t);
  const round = running[0] ?? t.rounds[t.rounds.length - 1];
  const open = running.flatMap((r) => r.games).filter((g) => gameStatus(t, g).state === 'ready');

  return (
    <div class="scoreboard">
      <header>
        <a class="iconbtn" href={`#/t/${t.id}`} aria-label={tr('Terug')}>
          <Icon name="arrow_back_ios_new" />
        </a>
        <h1>{t.name}</h1>
        <UndoRedo tournamentId={t.id} />
        <button class="iconbtn" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} aria-label={tr('Volledig scherm')}>
          <Icon name="fullscreen" />
        </button>
      </header>
      <div class="sub" style="margin-bottom:2vh">
        {t.status === 'finished'
          ? tr('Eindstand')
          : isTiebreakRound(round)
            ? <><Icon name="swords" /> {tr('Tie-breaker')}</>
            : round
              ? tr('Ronde {n} van {totaal}', { n: running.length > 1 ? `${round.index + 1}–${running[running.length - 1].index + 1}` : round.index + 1, totaal: Math.max(t.settings.rounds, t.rounds.length) })
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
            <div class="sub">{tr('Nu spelen')}</div>
            {open.map((g) => (
              <div key={g.id} class="card game">
                <div class="machine">{machineName(s, g.machineId)}</div>
                <div>{g.playerIds.map((p) => playerName(s, p)).join(' · ')}</div>
              </div>
            ))}
            {round && waitingPlayers(t, round).length > 0 && (
              <div class="sub"><Icon name="pause_circle" /> {tr('Wacht:')} {waitingPlayers(t, round).map((p) => playerName(s, p)).join(', ')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
