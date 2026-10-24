import { useMemo } from 'preact/hooks';
import { state } from '../../app/state';
import { renderMarkdown } from '../../rules/markdown';
import { ensureRules, fetchingRules } from '../../rules/rules';
import { Shell } from '../components/Shell';

const SOURCES = {
  pinballrulesheets: { name: 'Pinball Rulesheets', note: 'Community-rulesheet (CC0), opvolger van de Tilt Forums-wiki.' },
  pinballprimer: { name: 'The Pinball Primer', note: 'Persoonlijke offline kopie. Bezoek en steun de makers via hun website.' },
};

/** Spelregels van één kast, in de app en offline leesbaar. */
export function RulesScreen({ id }: { id: string }) {
  const m = state.value.machines.get(id);
  const rendered = useMemo(() => (m?.rules ? renderMarkdown(m.rules.text, m.rules.url) : null), [m?.rules]);

  if (!m) {
    return (
      <Shell title="Spelregels" back="kasten">
        <p class="empty">Deze kast bestaat niet (meer).</p>
      </Shell>
    );
  }

  const loading = fetchingRules.value.has(id);
  const canFetch = !!(m.rulesheetPath || m.primerUrl || m.opdbId);
  const src = m.rules ? SOURCES[m.rules.source] : null;

  return (
    <Shell title={m.name} back={'kast/' + m.id}>
      <h2 style="margin-top:0">Spelregels</h2>

      {m.notes && (
        <div class="card house-rules">
          <div class="small muted">Eigen notities en huisregels</div>
          <p class="notes-text" style="margin:6px 0 0">
            {m.notes}
          </p>
        </div>
      )}

      {rendered ? (
        <>
          {rendered.toc.length > 3 && !rendered.hasOwnToc && (
            <details class="card toc">
              <summary>Inhoud</summary>
              <ul>
                {rendered.toc.map((h) => (
                  <li key={h.id}>
                    <button class="linkbtn" onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })}>
                      {h.text}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <article
            class="rules"
            onClick={(e) => {
              const a = (e.target as HTMLElement).closest('a[data-anchor]');
              if (a) document.getElementById(a.getAttribute('data-anchor')!)?.scrollIntoView({ behavior: 'smooth' });
            }}
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
          <div class="card small muted stack" style="margin-top:20px">
            <div>
              Bron: <b>{src!.name}</b> — {src!.note}
            </div>
            <div>
              Opgehaald op {new Date(m.rules!.fetchedAt).toLocaleDateString('nl-NL')} ·{' '}
              <a href={m.rules!.url} target="_blank" rel="noopener">
                origineel bekijken
              </a>
            </div>
            <button class="btn block" disabled={loading || !navigator.onLine} onClick={() => ensureRules(m.id, true)}>
              {loading ? 'Bezig…' : '⟳ Opnieuw ophalen'}
            </button>
          </div>
        </>
      ) : (
        <div class="card stack">
          {loading ? (
            <p style="margin:0">Spelregels ophalen…</p>
          ) : (
            <>
              <p style="margin:0">
                {canFetch
                  ? navigator.onLine
                    ? 'Er zijn (nog) geen spelregels gevonden voor deze kast.'
                    : 'Nog niet opgehaald. Zodra er internet is, worden de spelregels automatisch opgehaald.'
                  : 'Voor deze kast zijn geen online spelregels bekend. Voeg de kast toe via de catalogus, of zet de regels in je eigen notities.'}
              </p>
              {canFetch && (
                <button class="btn cyan block" disabled={!navigator.onLine} onClick={() => ensureRules(m.id, true)}>
                  Spelregels ophalen
                </button>
              )}
            </>
          )}
          <a class="btn ghost block" href={'#/kast/' + m.id}>
            ✎ Eigen notities schrijven
          </a>
        </div>
      )}

      {m.rulesheetUrl && (
        <p class="small">
          <a href={m.rulesheetUrl} target="_blank" rel="noopener">
            Eigen rulesheet-link openen
          </a>
        </p>
      )}
    </Shell>
  );
}
