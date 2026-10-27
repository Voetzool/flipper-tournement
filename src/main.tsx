import { render } from 'preact';
import { initPwa } from './app/pwa';
import { initSettings } from './app/settings';
import { initState } from './app/state';
import { requestPersistence } from './db/db';
import { syncMissingRules, syncPlayfields } from './rules/rules';
import { App } from './ui/App';
import './ui/theme.css';

// Vangnet: blijft het scherm leeg door een fout, toon dan wat er misging (i.p.v. een wit scherm).
function showCrash(message: string) {
  setTimeout(() => {
    const app = document.getElementById('app')!;
    if (app.textContent?.trim()) return;
    const box = document.createElement('div');
    box.className = 'empty';
    box.textContent = 'Er ging iets mis / Something went wrong: ' + message;
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = 'Opnieuw laden / Reload';
    btn.onclick = () => location.reload();
    box.append(document.createElement('br'), btn);
    app.replaceChildren(box);
  }, 50);
}
addEventListener('error', (e) => showCrash(e.message));
addEventListener('unhandledrejection', (e) => showCrash(String((e.reason as Error)?.message ?? e.reason)));

initSettings();
render(<App />, document.getElementById('app')!);

initState()
  .then(() => {
    // Spelregels die eerder (offline) niet opgehaald konden worden, alsnog ophalen.
    syncPlayfields().then(() => syncMissingRules());
    addEventListener('online', () => syncPlayfields().then(() => syncMissingRules()));
  })
  .catch((err) => {
  console.error(err);
  document.getElementById('app')!.innerHTML =
    '<p class="empty">De lokale database kon niet geopend worden. Gebruik je een privé-venster? Probeer de app in een normaal venster.</p>';
});
requestPersistence();
initPwa();
