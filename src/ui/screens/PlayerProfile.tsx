import { useState } from 'preact/hooks';
import { machineName, playerName, ratings, state } from '../../app/state';
import { PROVISIONAL_GAMES } from '../../rating/ratings';
import { playerStats } from '../../stats/playerStats';
import { RatingChart } from '../components/RatingChart';
import { Shell } from '../components/Shell';
import { PlayerSheet } from './Players';
import { Delta } from './Ranking';

const fmtDate = (at: number) => new Date(at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
const pct = (v: number) => `${Math.round(v)}%`;

export function PlayerProfileScreen({ id }: { id: string }) {
  const s = state.value;
  const player = s.players.get(id);
  const [editing, setEditing] = useState(false);

  if (!player) {
    return (
      <Shell title="Speler" back="spelers">
        <p class="empty">Deze speler bestaat niet (meer).</p>
      </Shell>
    );
  }

  const all = ratings.value;
  const r = all.get(id);
  const stats = playerStats(s, id);
  const established = [...all.values()]
    .filter((x) => x.games >= PROVISIONAL_GAMES && !s.players.get(x.playerId)?.archived)
    .sort((a, b) => b.rating - a.rating);
  const rank = established.findIndex((x) => x.playerId === id) + 1;
  const ratingByGame = new Map(r?.history.map((h) => [h.gameId, h]) ?? []);

  return (
    <Shell
      title={player.name}
      back="spelers"
      actions={
        <button class="iconbtn" onClick={() => setEditing(true)} aria-label="Bewerken" title="Bewerken">
          ✎
        </button>
      }
    >
      {player.archived && <div class="banner">Deze speler is gearchiveerd.</div>}

      <div class="card stack">
        <div class="hero">
          <span class="big">{Math.round(r?.rating ?? 1500)}</span>
          <span class="muted">±{Math.round(r?.rd ?? 350)}</span>
          {r && r.games < PROVISIONAL_GAMES && <span class="badge warn">voorlopig</span>}
          {rank > 0 && <span class="badge live">#{rank} van {established.length}</span>}
        </div>
        {r && r.history.length > 0 ? (
          <RatingChart
            history={r.history}
            label={(p, i) => `Potje ${i + 1} · ${fmtDate(p.at)} · ${Math.round(p.rating)} (${p.delta >= 0 ? '+' : ''}${Math.round(p.delta)})`}
          />
        ) : (
          <p class="muted" style="margin:0">
            Nog geen potjes gespeeld.
          </p>
        )}
      </div>

      {stats.games > 0 && (
        <>
          <h2>Statistieken</h2>
          <div class="tiles">
            <Tile v={stats.games} l="potjes" />
            <Tile v={pct(stats.winPct)} l={`gewonnen (${stats.wins})`} />
            <Tile v={stats.avgPosition.toFixed(2)} l="gem. plek" />
            <Tile v={pct(stats.beatenPct)} l="tegenstanders verslagen" />
            <Tile v={stats.tournaments} l="toernooien" />
            <Tile v={`🏆 ${stats.tournamentWins}`} l={`toernooizeges · ${stats.podiums}× podium`} />
          </div>

          <h2>Per kast</h2>
          <div class="card">
            <table class="table">
              <thead>
                <tr>
                  <th>Kast</th>
                  <th class="num">Potjes</th>
                  <th class="num">Winst</th>
                  <th class="num">Gem.</th>
                </tr>
              </thead>
              <tbody>
                {stats.machines.map((m) => (
                  <tr key={m.machineId ?? 'vrij'}>
                    <td>{machineName(s, m.machineId)}</td>
                    <td class="num">{m.played}</td>
                    <td class="num">{m.wins}</td>
                    <td class="num">{m.avgPosition.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Tegenstanders</h2>
          <div class="card">
            <table class="table">
              <thead>
                <tr>
                  <th>Tegen</th>
                  <th class="num">Samen</th>
                  <th class="num">Erboven – eronder</th>
                </tr>
              </thead>
              <tbody>
                {stats.rivals.slice(0, 10).map((x) => (
                  <tr key={x.opponentId}>
                    <td>
                      <a class="plain" href={'#/speler/' + x.opponentId}>
                        {playerName(s, x.opponentId)}
                      </a>
                    </td>
                    <td class="num">{x.played}</td>
                    <td class="num">
                      {x.won} – {x.lost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Recente potjes</h2>
          <ul class="list">
            {stats.recent.slice(0, 15).map((g) => {
              const h = ratingByGame.get(g.game.id);
              return (
                <li key={g.game.id} class="list-item">
                  <div class="name">
                    {g.position}e van {g.size} · {machineName(s, g.game.machineId)}
                    <div class="small muted">
                      {fmtDate(g.game.resultAt ?? 0)} · {g.tournament.name} · {g.points} ptn
                    </div>
                  </div>
                  {h && (
                    <div class="num small" style="text-align:right">
                      <Delta value={h.delta} />
                      <div class="muted">{Math.round(h.rating)}</div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {editing && <PlayerSheet player={player} onClose={() => setEditing(false)} />}
    </Shell>
  );
}

function Tile({ v, l }: { v: string | number; l: string }) {
  return (
    <div class="tile">
      <div class="v">{v}</div>
      <div class="l">{l}</div>
    </div>
  );
}
