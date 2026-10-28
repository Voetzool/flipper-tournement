import { SERVER_MODE } from '../../lib/serverMode';
import { locale, tr } from '../../i18n';
import { useEffect, useState } from 'preact/hooks';
import { events, lastBackupAt, markBackedUp, showToast, state, store } from '../../app/state';
import { checkForUpdate, offlineReady } from '../../app/pwa';
import { Icon, type IconName } from '../components/Icon';
import { lang, setLang, setTheme, theme, type Lang, type ThemeChoice } from '../../app/settings';
import { backupFileName, makeBackup, parseBackup } from '../../backup/backup';
import { requestPersistence } from '../../db/db';
import { updateServerCatalog } from '../../catalog/serverCatalog';
import { catalog, catalogError, catalogStatus, catalogVersion, fetchRemoteMeta, loadStoredCatalog, updateCatalog } from '../../catalog/catalog';
import type { CatalogMeta } from '../../catalog/types';
import { syncMissingRules, syncPlayfields } from '../../rules/rules';
import { BackupBanner } from '../components/BackupBanner';
import { Shell } from '../components/Shell';

export function MoreScreen() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  const [remote, setRemote] = useState<CatalogMeta | null | undefined>(undefined);
  const [updateCheck, setUpdateCheck] = useState<'busy' | 'updating' | 'latest' | 'offline' | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false));
    loadStoredCatalog();
    fetchRemoteMeta().then(setRemote);
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(tr('{n} KB gebruikt', { n: Math.round(e.usage / 1024) })));
  }, []);

  const exportData = async () => {
    const json = JSON.stringify(makeBackup(events.value), null, 1);
    const name = backupFileName();
    const file = new File([json], name, { type: 'application/json' });
    // Op telefoons: deelmenu (opslaan in Bestanden/Drive, mailen, WhatsApp). Anders: gewone download.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: tr('Flipper back-up') });
        await markBackedUp();
        showToast(tr('Back-up gedeeld'));
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    await markBackedUp();
    showToast(tr('Back-up opgeslagen'));
  };

  const importData = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const imported = parseBackup(await f.text());
      if (!confirm(tr('Back-up met {n} acties terugzetten? Alle huidige gegevens op dit apparaat worden vervangen.', { n: imported.length }))) return;
      await store.replaceAll(imported);
      await markBackedUp();
      showToast(tr('Back-up teruggezet'));
    } catch (err) {
      alert(tr((err as Error).message));
    }
  };

  const s = state.value;
  return (
    <Shell title={tr('Instellingen')}>
      <BackupBanner />
      <h2>Taal / Language</h2>
      <div class="card stack">
        <div class="seg" role="radiogroup" aria-label="Taal / Language">
          {(
            [
              ['nl', 'Nederlands'],
              ['en', 'English'],
            ] as [Lang, string][]
          ).map(([v, label]) => (
            <button key={v} class={lang.value === v ? 'on' : ''} role="radio" aria-checked={lang.value === v} onClick={() => setLang(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <h2>{tr('Weergave')}</h2>
      <div class="card stack">
        <div class="seg" role="radiogroup" aria-label={tr('Weergave')}>
          {(
            [
              ['auto', 'Automatisch', 'brightness_auto'],
              ['light', 'Licht', 'light_mode'],
              ['dark', 'Donker', 'dark_mode'],
            ] as [ThemeChoice, string, IconName][]
          ).map(([v, label, icon]) => (
            <button key={v} class={theme.value === v ? 'on' : ''} role="radio" aria-checked={theme.value === v} onClick={() => setTheme(v)}>
              <Icon name={icon} /> {tr(label)}
            </button>
          ))}
        </div>
        <p class="small muted" style="margin:0">{tr('Automatisch volgt de instelling van je telefoon.')}</p>
      </div>

      <h2>{tr('Back-up')}</h2>
      <div class="card stack">
        <p style="margin:0">
          {SERVER_MODE
            ? tr('Download een kopie van alle gegevens op de server, om apart te bewaren of op een andere server terug te zetten.')
            : tr('Al je gegevens staan alleen op dit apparaat. Maak regelmatig een back-up en bewaar die ergens anders (bijv. Google Drive, iCloud of mail).')}
        </p>
        <p class="small muted" style="margin:0">
          {tr('Laatste back-up:')} {lastBackupAt.value ? new Date(lastBackupAt.value).toLocaleString(locale()) : tr('nog nooit')}
        </p>
        <button class="btn cyan block" onClick={exportData}>
          <Icon name="save" /> {tr('Back-up maken')}
        </button>
        <label class="btn block">
          <Icon name="upload_file" /> {tr('Back-up terugzetten')}
          <input type="file" accept="application/json,.json" style="display:none" onChange={importData} />
        </label>
      </div>

      <h2>{tr('Machinecatalogus (OPDB)')}</h2>
      <div class="card stack">
        <div>
          {catalog.value
            ? tr('{n} machines offline beschikbaar · versie van {datum}', { n: catalog.value.e.length, datum: new Date(catalog.value.generatedAt).toLocaleDateString(locale()) })
            : tr('Nog niet gedownload.')}
        </div>
        {remote && remote.version !== catalogVersion.value && (
          <div class="small muted">
            {tr(catalog.value ? 'Er is een nieuwere versie: {n} machines, ±{kb} KB downloaden.' : 'Beschikbaar: {n} machines, ±{kb} KB downloaden.', { n: remote.count, kb: Math.max(1, Math.round(remote.gzipBytes / 1024)) })}
          </div>
        )}
        {remote === null && <div class="small muted">{tr('Server niet bereikbaar (geen internet?).')}</div>}
        {catalogStatus.value === 'error' && <div class="small" style="color:var(--yellow)">{tr(catalogError.value ?? '')}</div>}
        <button
          class="btn block"
          disabled={catalogStatus.value === 'loading' || (!SERVER_MODE && (!remote || remote.version === catalogVersion.value))}
          onClick={async () => {
            // Pi-versie: eerst laat de Pi (als hij internet heeft) de nieuwste catalogus ophalen.
            if (SERVER_MODE && !(await updateServerCatalog())) return;
            if (SERVER_MODE) fetchRemoteMeta().then(setRemote);
            if (await updateCatalog(true)) await syncPlayfields().then(syncMissingRules);
          }}
        >
          {catalogStatus.value === 'loading' ? tr('Downloaden…') : catalog.value ? <><Icon name="refresh" /> {tr('Catalogus bijwerken')}</> : <><Icon name="download" /> {tr('Catalogus downloaden')}</>}
        </button>
        <p class="small muted" style="margin:0">
          {tr('Machinegegevens en afbeeldingen: OPDB (opdb.org), via Match Play. De catalogus wordt wekelijks ververst.')}
        </p>
      </div>

      <h2>{tr('Opslag')}</h2>
      {SERVER_MODE ? (
        <div class="card stack">
          <div>
            {tr('{spelers} spelers · {kasten} machines · {toernooien} toernooien · {acties} acties', { spelers: s.players.size, kasten: s.machines.size, toernooien: s.tournaments.size, acties: events.value.length })}
          </div>
          <div class="small muted">
            {tr('Alle gegevens staan op de server ({adres}). Die maakt elke dag zelf een kopie.', { adres: location.host })}
          </div>
        </div>
      ) : (
      <div class="card stack">
        <div>
          {tr('{spelers} spelers · {kasten} machines · {toernooien} toernooien · {acties} acties', { spelers: s.players.size, kasten: s.machines.size, toernooien: s.tournaments.size, acties: events.value.length })}
        </div>
        <div class="small muted">{usage}</div>
        <div class="row">
          <span class="grow">
            {persisted ? <><Icon name="check_circle" /> {tr('Browser bewaart de gegevens permanent')}</> : <><Icon name="warning" /> {tr('Browser mag gegevens opruimen bij weinig ruimte')}</>}
          </span>
          {!persisted && (
            <button class="btn" onClick={async () => setPersisted(await requestPersistence())}>
              {tr('Vragen')}
            </button>
          )}
        </div>
        {!persisted && (
          <p class="small muted" style="margin:0">
            {tr('Tip: zet de app op je startscherm; dan bewaren de meeste browsers de gegevens permanent.')}
          </p>
        )}
      </div>
      )}

      {!SERVER_MODE && <h2>{tr('Installeren')}</h2>}
      {!SERVER_MODE && (
      <div class="card stack small">
        <div>
          <b>Android (Chrome):</b> {tr('menu')} <Icon name="more_vert" /> → <i>{tr('App installeren')}</i> {tr('of')} <i>{tr('Toevoegen aan startscherm')}</i>.
        </div>
        <div>
          <b>iPhone/iPad (Safari):</b> {tr('deelknop')} <Icon name="ios_share" /> → <i>{tr('Zet op beginscherm')}</i>.
        </div>
        <div class="muted">{offlineReady.value ? <><Icon name="check_circle" /> {tr('Klaar voor offline gebruik.')}</> : tr('Werkt offline zodra de app één keer volledig geladen is.')}</div>
      </div>
      )}

      {!SERVER_MODE && (
        <>
          <h2>{tr('Raspberry Pi-versie')}</h2>
          <div class="card stack small">
            <div>{tr('Wil je de gegevens op een Raspberry Pi bewaren en het scorebord op meerdere schermen tonen? Daar is een aparte versie voor.')}</div>
            <a class="btn block" href={import.meta.env.BASE_URL + 'pi/index.html'} target="_blank" rel="noopener">
              {tr('Installatiehandleiding')}
            </a>
          </div>
        </>
      )}

      <h2>{tr('Over')}</h2>
      <div class="card stack small">
        <div class="muted">
          {tr('Flipper Toernooi')} v{__APP_VERSION__} · {tr('gebouwd')} {new Date(__BUILD_TIME__).toLocaleString(locale())}
        </div>
        {SERVER_MODE ? (
          <div class="muted">{tr('Nieuwe versie installeren: op de server')} <code>sudo pinball-tournament update</code></div>
        ) : (
        <button
          class="btn block"
          disabled={updateCheck === 'busy'}
          onClick={async () => {
            setUpdateCheck('busy');
            setUpdateCheck(await checkForUpdate());
          }}
        >
          <Icon name="refresh" /> {tr('Controleren op update')}
        </button>
        )}
        {updateCheck === 'latest' && <div class="muted">{tr('Je hebt de nieuwste versie.')}</div>}
        {updateCheck === 'updating' && <div class="muted">{tr('Nieuwe versie wordt geladen…')}</div>}
        {updateCheck === 'offline' && <div class="muted">{tr('Geen internetverbinding.')}</div>}
      </div>
    </Shell>
  );
}
