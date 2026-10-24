import { useEffect, useState } from 'preact/hooks';
import { events, lastBackupAt, markBackedUp, showToast, state, store } from '../../app/state';
import { offlineReady } from '../../app/pwa';
import { backupFileName, makeBackup, parseBackup } from '../../backup/backup';
import { requestPersistence } from '../../db/db';
import { BackupBanner } from '../components/BackupBanner';
import { Shell } from '../components/Shell';

export function MoreScreen() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false));
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(`${Math.round(e.usage / 1024)} KB gebruikt`));
  }, []);

  const exportData = async () => {
    const json = JSON.stringify(makeBackup(events.value), null, 1);
    const name = backupFileName();
    const file = new File([json], name, { type: 'application/json' });
    // Op telefoons: deelmenu (opslaan in Bestanden/Drive, mailen, WhatsApp). Anders: gewone download.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Flipper back-up' });
        await markBackedUp();
        showToast('Back-up gedeeld');
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
    showToast('Back-up opgeslagen');
  };

  const importData = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const imported = parseBackup(await f.text());
      if (!confirm(`Back-up met ${imported.length} acties terugzetten? Alle huidige gegevens op dit apparaat worden vervangen.`)) return;
      await store.replaceAll(imported);
      await markBackedUp();
      showToast('Back-up teruggezet');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const s = state.value;
  return (
    <Shell title="Meer">
      <BackupBanner />
      <h2>Back-up</h2>
      <div class="card stack">
        <p style="margin:0">
          Al je gegevens staan alleen op dit apparaat. Maak regelmatig een back-up en bewaar die ergens anders (bijv. Google Drive,
          iCloud of mail).
        </p>
        <p class="small muted" style="margin:0">
          Laatste back-up: {lastBackupAt.value ? new Date(lastBackupAt.value).toLocaleString('nl-NL') : 'nog nooit'}
        </p>
        <button class="btn cyan block" onClick={exportData}>
          💾 Back-up maken
        </button>
        <label class="btn block">
          📂 Back-up terugzetten
          <input type="file" accept="application/json,.json" style="display:none" onChange={importData} />
        </label>
      </div>

      <h2>Opslag</h2>
      <div class="card stack">
        <div>
          {s.players.size} spelers · {s.machines.size} kasten · {s.tournaments.size} toernooien · {events.value.length} acties
        </div>
        <div class="small muted">{usage}</div>
        <div class="row">
          <span class="grow">
            {persisted ? '✅ Browser bewaart de gegevens permanent' : '⚠️ Browser mag gegevens opruimen bij weinig ruimte'}
          </span>
          {!persisted && (
            <button class="btn" onClick={async () => setPersisted(await requestPersistence())}>
              Vragen
            </button>
          )}
        </div>
        {!persisted && (
          <p class="small muted" style="margin:0">
            Tip: zet de app op je startscherm; dan bewaren de meeste browsers de gegevens permanent.
          </p>
        )}
      </div>

      <h2>Installeren</h2>
      <div class="card stack small">
        <div>
          <b>Android (Chrome):</b> menu ⋮ → <i>App installeren</i> of <i>Toevoegen aan startscherm</i>.
        </div>
        <div>
          <b>iPhone/iPad (Safari):</b> deelknop ⬆︎ → <i>Zet op beginscherm</i>.
        </div>
        <div class="muted">{offlineReady.value ? '✅ Klaar voor offline gebruik.' : 'Werkt offline zodra de app één keer volledig geladen is.'}</div>
      </div>

      <h2>Over</h2>
      <div class="card small muted">
        Flipper Toernooi v{__APP_VERSION__} · gebouwd {new Date(__BUILD_TIME__).toLocaleDateString('nl-NL')}
      </div>
    </Shell>
  );
}
