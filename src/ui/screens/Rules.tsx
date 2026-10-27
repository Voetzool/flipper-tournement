import { Icon } from '../components/Icon';
import { locale, tr } from '../../i18n';
import { useMemo, useState } from 'preact/hooks';
import { state } from '../../app/state';
import { renderMarkdown } from '../../rules/markdown';
import { ensureRules, fetchingRules } from '../../rules/rules';
import { ImageViewer } from '../components/ImageViewer';
import { Shell } from '../components/Shell';

const SOURCES = {
  pinballrulesheets: { name: 'Pinball Rulesheets', note: 'Community-rulesheet (CC0), opvolger van de Tilt Forums-wiki.' },
  pinballprimer: { name: 'The Pinball Primer', note: 'Persoonlijke offline kopie. Bezoek en steun de makers via hun website.' },
};

/** Spelregels van één kast, in de app en offline leesbaar. */
export function RulesScreen({ id }: { id: string }) {
  const m = state.value.machines.get(id);
  const [viewer, setViewer] = useState(false);
  const [pfFailed, setPfFailed] = useState(false);
  const rendered = useMemo(() => (m?.rules ? renderMarkdown(m.rules.text, m.rules.url) : null), [m?.rules]);

  if (!m) {
    return (
      <Shell title={tr('Spelregels')} back="kasten">
        <p class="empty">{tr('Deze machine bestaat niet (meer).')}</p>
      </Shell>
    );
  }

  const loading = fetchingRules.value.has(id);
  const canFetch = !!(m.rulesheetPath || m.primerUrl || m.opdbId);
  const src = m.rules ? SOURCES[m.rules.source] : null;

  return (
    <Shell title={m.name} back={'kast/' + m.id}>
      {m.playfieldMedium && !pfFailed && (
        <button class="playfield" onClick={() => setViewer(true)} aria-label={tr('Speelveld vergroten')}>
          <img src={m.playfieldMedium} alt={tr('Speelveld {naam}', { naam: m.name })} onError={() => setPfFailed(true)} />
          <span class="playfield-hint"><Icon name="zoom_in" /> {tr('Tik om te vergroten')}</span>
        </button>
      )}

      <h2 style="margin-top:0">{tr('Spelregels')}</h2>

      {m.notes && (
        <div class="card house-rules">
          <div class="small muted">{tr('Eigen notities en huisregels')}</div>
          <p class="notes-text" style="margin:6px 0 0">
            {m.notes}
          </p>
        </div>
      )}

      {rendered ? (
        <>
          {rendered.toc.length > 3 && !rendered.hasOwnToc && (
            <details class="card toc">
              <summary>{tr('Inhoud')}</summary>
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
              {tr('Bron:')} <b>{src!.name}</b> — {tr(src!.note)}
            </div>
            <div>
              {tr('Opgehaald op {datum}', { datum: new Date(m.rules!.fetchedAt).toLocaleDateString(locale()) })} ·{' '}
              <a href={m.rules!.url} target="_blank" rel="noopener">
                {tr('origineel bekijken')}
              </a>
            </div>
            <button class="btn block" disabled={loading || !navigator.onLine} onClick={() => ensureRules(m.id, true)}>
              {loading ? tr('Bezig…') : <><Icon name="refresh" /> {tr('Opnieuw ophalen')}</>}
            </button>
          </div>
        </>
      ) : (
        <div class="card stack">
          {loading ? (
            <p style="margin:0">{tr('Spelregels ophalen…')}</p>
          ) : (
            <>
              <p style="margin:0">
                {canFetch
                  ? navigator.onLine
                    ? tr('Er zijn (nog) geen spelregels gevonden voor deze machine.')
                    : tr('Nog niet opgehaald. Zodra er internet is, worden de spelregels automatisch opgehaald.')
                  : tr('Voor deze machine zijn geen online spelregels bekend. Voeg de machine toe via de catalogus, of zet de regels in je eigen notities.')}
              </p>
              {canFetch && (
                <button class="btn cyan block" disabled={!navigator.onLine} onClick={() => ensureRules(m.id, true)}>
                  {tr('Spelregels ophalen')}
                </button>
              )}
            </>
          )}
          <a class="btn ghost block" href={'#/kast/' + m.id}>
            <Icon name="edit" /> {tr('Eigen notities schrijven')}
          </a>
        </div>
      )}

      {m.rulesheetUrl && (
        <p class="small">
          <a href={m.rulesheetUrl} target="_blank" rel="noopener">
            {tr('Eigen rulesheet-link openen')}
          </a>
        </p>
      )}

      {m.playfieldMedium && !pfFailed && (
        <button class="playfield-fab" onClick={() => setViewer(true)} aria-label={tr('Speelveld bekijken')}>
          <Icon name="map" /> {tr('Speelveld')}
        </button>
      )}
      {viewer && m.playfieldMedium && (
        <ImageViewer
          src={m.playfieldLarge ?? m.playfieldMedium}
          fallback={m.playfieldMedium}
          alt={tr('Speelveld {naam}', { naam: m.name })}
          onClose={() => setViewer(false)}
        />
      )}
    </Shell>
  );
}
