import { render } from 'preact';
import { initPwa } from './app/pwa';
import { initSettings } from './app/settings';
import { initState } from './app/state';
import { requestPersistence } from './db/db';
import { syncMissingRules } from './rules/rules';
import { App } from './ui/App';
import './ui/theme.css';

initSettings();
render(<App />, document.getElementById('app')!);

initState()
  .then(() => {
    // Spelregels die eerder (offline) niet opgehaald konden worden, alsnog ophalen.
    syncMissingRules();
    addEventListener('online', () => syncMissingRules());
  })
  .catch((err) => {
  console.error(err);
  document.getElementById('app')!.innerHTML =
    '<p class="empty">De lokale database kon niet geopend worden. Gebruik je een privé-venster? Probeer de app in een normaal venster.</p>';
});
requestPersistence();
initPwa();
