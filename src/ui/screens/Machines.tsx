import { Icon } from '../components/Icon';
import { tr } from '../../i18n';
import { useEffect, useState } from 'preact/hooks';
import { dispatch, showToast, state } from '../../app/state';
import { go } from '../../app/router';
import { catalogError, catalogIndex, catalogStatus, loadStoredCatalog, prefetchImage, updateCatalog } from '../../catalog/catalog';
import { searchCatalog } from '../../catalog/search';
import { ensureRules } from '../../rules/rules';
import type { CatalogMachine } from '../../catalog/types';
import type { Machine } from '../../events/types';
import { newId } from '../../lib/id';
import { Shell } from '../components/Shell';
import { Sheet } from '../components/Sheet';
import { Thumb } from '../components/Thumb';

export function machineSubtitle(m: { manufacturer?: string; year?: number }) {
  return [m.manufacturer, m.year].filter(Boolean).join(' · ');
}

export function MachinesScreen() {
  const [adding, setAdding] = useState(false);
  const all = [...state.value.machines.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const active = all.filter((m) => m.active);
  const removed = all.filter((m) => !m.active);

  return (
    <Shell title={tr('Machines')}>
      {!active.length && <p class="empty">{tr('Nog geen machines. Tik op + om een flipperkast toe te voegen.')}</p>}
      <ul class="list">
        {active.map((m) => (
          <MachineItem key={m.id} m={m} />
        ))}
      </ul>
      {removed.length > 0 && (
        <>
          <h2>{tr('Verwijderd')}</h2>
          <ul class="list">
            {removed.map((m) => (
              <MachineItem key={m.id} m={m} />
            ))}
          </ul>
        </>
      )}
      <button class="fab" onClick={() => setAdding(true)} aria-label={tr('Machine toevoegen')}>
        <Icon name="add" />
      </button>
      {adding && <AddMachineSheet onClose={() => setAdding(false)} />}
    </Shell>
  );
}

function MachineItem({ m }: { m: Machine }) {
  return (
    <li class={'list-item card tap' + (m.active ? '' : ' muted')} onClick={() => go('kast/' + m.id)}>
      <Thumb src={m.imageSmall} />
      <div class="name">
        {m.name}
        {machineSubtitle(m) && <div class="small muted">{machineSubtitle(m)}</div>}
      </div>
      <span class="muted">›</span>
    </li>
  );
}

function AddMachineSheet({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'zoeken' | 'handmatig'>('zoeken');
  const [query, setQuery] = useState('');
  const index = catalogIndex.value;

  useEffect(() => {
    // Lokale catalogus laden; is er (nog) geen, dan meteen proberen te downloaden.
    loadStoredCatalog().then(() => {
      if (!catalogIndex.value && navigator.onLine) updateCatalog();
    });
  }, []);

  const existing = new Set([...state.value.machines.values()].map((m) => m.opdbId).filter(Boolean));
  const results = index ? searchCatalog(index, query, 25) : [];

  const addFromCatalog = (c: CatalogMachine) => {
    const { opdbId, name, manufacturer, year, kind, ipdbId, imageSmall, imageMedium, rulesheetUrl, primerUrl, rulesheetPath, playfieldMedium, playfieldLarge } =
      c;
    const machineId = newId();
    dispatch({
      type: 'MachineAdded',
      machineId,
      name,
      manufacturer,
      year,
      kind,
      ipdbId,
      opdbId,
      imageSmall,
      imageMedium,
      rulesheetUrl,
      primerUrl,
      rulesheetPath,
      playfieldMedium,
      playfieldLarge,
    });
    // Spelregels meteen ophalen en opslaan (lukt het nu niet, dan later automatisch opnieuw).
    ensureRules(machineId);
    prefetchImage(imageSmall);
    prefetchImage(imageMedium);
    prefetchImage(playfieldMedium);
    showToast(tr('{naam} toegevoegd', { naam: name }));
    setQuery('');
  };

  return (
    <Sheet onClose={onClose}>
      <div class="stack">
        <h3>{tr('Machine toevoegen')}</h3>
        <div class="seg">
          <button class={mode === 'zoeken' ? 'on' : ''} onClick={() => setMode('zoeken')}>
            🔍 {tr('Zoeken')}
          </button>
          <button class={mode === 'handmatig' ? 'on' : ''} onClick={() => setMode('handmatig')}>
            ✎ {tr('Handmatig')}
          </button>
        </div>
        {mode === 'zoeken' ? (
          <>
            {index ? (
              <input
                class="input"
                placeholder={tr('Naam, afkorting (AFM) of fabrikant…')}
                value={query}
                onInput={(e) => setQuery(e.currentTarget.value)}
                autoFocus
                autoComplete="off"
                enterKeyHint="search"
              />
            ) : catalogStatus.value === 'loading' ? (
              <p class="muted">{tr('Catalogus downloaden…')}</p>
            ) : (
              <div class="banner">
                <span class="grow">
                  {tr(catalogError.value || 'De machinecatalogus is nog niet gedownload.')} {tr('Je kunt de machine ook handmatig toevoegen.')}
                </span>
                <button class="btn" onClick={() => updateCatalog(true)}>
                  {tr('Opnieuw')}
                </button>
              </div>
            )}
            <ul class="list">
              {results.map((c) => (
                <li key={c.opdbId} class="list-item">
                  <Thumb src={c.imageSmall} />
                  <div class="name">
                    {c.name}
                    <div class="small muted">{machineSubtitle(c)}</div>
                  </div>
                  {existing.has(c.opdbId) ? (
                    <span class="badge">{tr('al toegevoegd')}</span>
                  ) : (
                    <button class="btn" onClick={() => addFromCatalog(c)} aria-label={tr('{naam} toevoegen', { naam: c.name })}>
                      +
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {index && query.trim() && !results.length && <p class="muted">{tr('Niets gevonden. Voeg de machine handmatig toe.')}</p>}
            {index && <p class="small muted">{tr('Machinegegevens: OPDB (opdb.org), via Match Play.')}</p>}
          </>
        ) : (
          <MachineForm
            onSave={(d) => {
              dispatch({ type: 'MachineAdded', machineId: newId(), ...d });
              showToast(tr('{naam} toegevoegd', { naam: d.name }));
              onClose();
            }}
          />
        )}
        <button type="button" class="btn ghost block" onClick={onClose}>
          {tr('Sluiten')}
        </button>
      </div>
    </Sheet>
  );
}

export interface MachineFormValues {
  name: string;
  manufacturer?: string;
  year?: number;
  rulesheetUrl?: string;
}

/** Naam, fabrikant, jaar en rulesheet-link. Gebruikt bij handmatig toevoegen en bij bewerken. */
export function MachineForm({ initial, onSave }: { initial?: Partial<MachineFormValues>; onSave: (v: MachineFormValues) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [rules, setRules] = useState(initial?.rulesheetUrl ?? '');
  const y = parseInt(year, 10);
  return (
    <form
      class="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          manufacturer: manufacturer.trim() || undefined,
          year: y >= 1900 && y <= 2100 ? y : undefined,
          rulesheetUrl: rules.trim() || undefined,
        });
      }}
    >
      <div class="field">
        <label for="mname">{tr('Naam')}</label>
        <input id="mname" class="input" value={name} placeholder={tr('bijv. Medieval Madness')} onInput={(e) => setName(e.currentTarget.value)} autoComplete="off" />
      </div>
      <div class="grid2">
        <div class="field">
          <label for="mmfr">{tr('Fabrikant')}</label>
          <input id="mmfr" class="input" value={manufacturer} onInput={(e) => setManufacturer(e.currentTarget.value)} autoComplete="off" />
        </div>
        <div class="field">
          <label for="myear">{tr('Jaar')}</label>
          <input id="myear" class="input" inputMode="numeric" value={year} onInput={(e) => setYear(e.currentTarget.value)} />
        </div>
      </div>
      <div class="field">
        <label for="mrules">{tr('Link naar rulesheet (optioneel)')}</label>
        <input id="mrules" class="input" type="url" value={rules} placeholder="https://pinballrulesheets.com/…" onInput={(e) => setRules(e.currentTarget.value)} />
      </div>
      <button class="btn primary block big" type="submit" disabled={!name.trim()}>
        {tr('Opslaan')}
      </button>
    </form>
  );
}
