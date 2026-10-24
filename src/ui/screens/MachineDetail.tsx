import { useState } from 'preact/hooks';
import { dispatch, playerName, state } from '../../app/state';
import { back } from '../../app/router';
import { machineInUse } from '../../events/reducer';
import type { Machine } from '../../events/types';
import { machineStats } from '../../stats/machineStats';
import { Shell } from '../components/Shell';
import { Sheet } from '../components/Sheet';
import { MachineForm, machineSubtitle } from './Machines';

const KIND: Record<string, string> = { em: 'Elektromechanisch', ss: 'Solid state', me: 'Mechanisch' };

export function tiltForumsSearch(name: string) {
  return 'https://tiltforums.com/search?q=' + encodeURIComponent(name + ' rulesheet');
}

/** Infopagina van een kast: plaatje, gegevens, links naar spelregels, eigen notities en statistieken. */
export function MachineDetailScreen({ id }: { id: string }) {
  const s = state.value;
  const m = s.machines.get(id);
  const [editing, setEditing] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  if (!m) {
    return (
      <Shell title="Kast" back="kasten">
        <p class="empty">Deze kast bestaat niet (meer).</p>
      </Shell>
    );
  }

  const stats = machineStats(s, id);
  const details = [machineSubtitle(m), m.kind && KIND[m.kind]].filter(Boolean).join(' · ');

  return (
    <Shell
      title={m.name}
      back="kasten"
      actions={
        <button class="iconbtn" onClick={() => setEditing(true)} aria-label="Bewerken" title="Bewerken">
          ✎
        </button>
      }
    >
      {!m.active && (
        <div class="banner">
          <span class="grow">Deze kast is verwijderd.</span>
          <button class="btn" onClick={() => dispatch({ type: 'MachineRestored', machineId: m.id })}>
            Terugzetten
          </button>
        </div>
      )}

      {m.imageMedium && !imgFailed && (
        <img class="machine-hero" src={m.imageMedium} alt={m.name} onError={() => setImgFailed(true)} />
      )}
      {details && <p class="muted">{details}</p>}

      <h2>Spelregels</h2>
      <div class="stack">
        {m.rulesheetUrl ? (
          <a class="btn cyan block" href={m.rulesheetUrl} target="_blank" rel="noopener">
            📖 Rulesheet openen
          </a>
        ) : (
          <a class="btn block" href={tiltForumsSearch(m.name)} target="_blank" rel="noopener">
            🔍 Zoek rulesheet op Tilt Forums
          </a>
        )}
        {m.primerUrl && (
          <a class="btn block" href={m.primerUrl} target="_blank" rel="noopener">
            📘 PinballPrimer
          </a>
        )}
        {m.ipdbId && (
          <a class="btn ghost block" href={`https://www.ipdb.org/machine.cgi?id=${m.ipdbId}`} target="_blank" rel="noopener">
            IPDB-pagina
          </a>
        )}
        <p class="small muted" style="margin:0">
          Links openen alleen met internet. Zet de belangrijkste regels daarom ook in je eigen notities hieronder.
        </p>
      </div>

      <h2>Eigen notities en spelregels</h2>
      <Notes key={m.id + (m.notes ?? '')} m={m} />

      {stats.games > 0 && (
        <>
          <h2>Op deze kast</h2>
          <div class="tiles">
            <div class="tile">
              <div class="v">{stats.games}</div>
              <div class="l">potjes gespeeld</div>
            </div>
            <div class="tile">
              <div class="v">{stats.tournaments}</div>
              <div class="l">toernooien</div>
            </div>
          </div>
          <div class="card" style="margin-top:10px">
            <table class="table">
              <thead>
                <tr>
                  <th>Beste spelers</th>
                  <th class="num">Potjes</th>
                  <th class="num">Winst</th>
                  <th class="num">Gem.</th>
                </tr>
              </thead>
              <tbody>
                {stats.players.slice(0, 8).map((p) => (
                  <tr key={p.playerId}>
                    <td>
                      <a class="plain" href={'#/speler/' + p.playerId}>
                        {playerName(s, p.playerId)}
                      </a>
                    </td>
                    <td class="num">{p.played}</td>
                    <td class="num">{p.wins}</td>
                    <td class="num">{p.avgPosition.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {m.opdbId && <p class="small muted">Gegevens uit OPDB ({m.opdbId}).</p>}
      {editing && <EditMachineSheet m={m} onClose={() => setEditing(false)} />}
    </Shell>
  );
}

function Notes({ m }: { m: Machine }) {
  const [text, setText] = useState(m.notes ?? '');
  const changed = text.trim() !== (m.notes ?? '');
  return (
    <div class="stack">
      <textarea
        class="input notes"
        rows={5}
        placeholder="Bijv. huisregels, tilt-gevoeligheid, extra ball uit, kapotte onderdelen…"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      {changed && (
        <button class="btn primary block" onClick={() => dispatch({ type: 'MachineUpdated', machineId: m.id, notes: text.trim() || null })}>
          Notities opslaan
        </button>
      )}
    </div>
  );
}

function EditMachineSheet({ m, onClose }: { m: Machine; onClose: () => void }) {
  const inUse = machineInUse(state.value, m.id);
  return (
    <Sheet onClose={onClose}>
      <div class="stack">
        <h3>Kast bewerken</h3>
        <MachineForm
          initial={m}
          onSave={(v) => {
            dispatch({
              type: 'MachineUpdated',
              machineId: m.id,
              name: v.name,
              manufacturer: v.manufacturer ?? null,
              year: v.year ?? null,
              rulesheetUrl: v.rulesheetUrl ?? null,
            });
            onClose();
          }}
        />
        {m.active && (
          <button
            type="button"
            class="btn danger block"
            onClick={() => {
              if (inUse) {
                dispatch({ type: 'MachineRemoved', machineId: m.id });
                onClose();
              } else {
                if (!confirm(`${m.name} verwijderen?`)) return;
                dispatch({ type: 'MachineDeleted', machineId: m.id });
                onClose();
                back('kasten');
              }
            }}
          >
            Verwijderen
          </button>
        )}
        {m.active && inUse && (
          <p class="small muted" style="margin:0">
            Deze kast is al in een toernooi gebruikt. Na verwijderen blijft hij in oude uitslagen staan en kun je hem terugzetten.
          </p>
        )}
        <button type="button" class="btn ghost block" onClick={onClose}>
          Sluiten
        </button>
      </div>
    </Sheet>
  );
}
