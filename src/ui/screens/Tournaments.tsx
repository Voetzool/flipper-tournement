import { state } from '../../app/state';
import { go } from '../../app/router';
import type { Tournament } from '../../events/types';
import { BackupBanner } from '../components/BackupBanner';
import { Shell } from '../components/Shell';

export function TournamentsScreen() {
  const list = [...state.value.tournaments.values()].sort((a, b) => b.createdAt - a.createdAt);
  const active = list.filter((t) => t.status === 'active');
  const done = list.filter((t) => t.status === 'finished');
  return (
    <Shell title="🎰 Flipper Toernooi">
      <BackupBanner />
      <button class="btn primary block big" onClick={() => go('nieuw')}>
        + Nieuw toernooi
      </button>
      {active.length > 0 && <h2>Bezig</h2>}
      <ul class="list">
        {active.map((t) => (
          <Item key={t.id} t={t} />
        ))}
      </ul>
      {done.length > 0 && <h2>Afgerond</h2>}
      <ul class="list">
        {done.map((t) => (
          <Item key={t.id} t={t} />
        ))}
      </ul>
      {!list.length && <p class="empty">Nog geen toernooien. Voeg eerst spelers (en kasten) toe en start een toernooi.</p>}
    </Shell>
  );
}

function Item({ t }: { t: Tournament }) {
  const date = new Date(t.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <li class="list-item card tap" onClick={() => go('t/' + t.id)}>
      <div class="name">
        {t.name}
        <div class="small muted">
          {date} · {t.playerIds.length} spelers · ronde {t.rounds.length}/{t.settings.rounds}
        </div>
      </div>
      {t.status === 'active' ? <span class="badge live">live</span> : <span class="badge">klaar</span>}
    </li>
  );
}
