import { render } from 'preact';
import { initPwa } from './app/pwa';
import { initState } from './app/state';
import { requestPersistence } from './db/db';
import { App } from './ui/App';
import './ui/theme.css';

render(<App />, document.getElementById('app')!);

initState().catch((err) => {
  console.error(err);
  document.getElementById('app')!.innerHTML =
    '<p class="empty">De lokale database kon niet geopend worden. Gebruik je een privé-venster? Probeer de app in een normaal venster.</p>';
});
requestPersistence();
initPwa();
