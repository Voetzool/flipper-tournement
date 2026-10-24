import type { ComponentChildren } from 'preact';
import { canRedo, canUndo, redo, undo } from '../../app/state';
import { route } from '../../app/router';
import { applyUpdate, updateAvailable } from '../../app/pwa';

interface Props {
  title: ComponentChildren;
  back?: string;
  actions?: ComponentChildren;
  children: ComponentChildren;
  nav?: boolean;
}

export function Shell({ title, back, actions, children, nav = true }: Props) {
  return (
    <div class="app">
      <header class="topbar">
        {back !== undefined && (
          <a class="iconbtn back" href={'#/' + back} aria-label="Terug">
            ‹
          </a>
        )}
        <h1>{title}</h1>
        {actions}
        <UndoRedo />
      </header>
      <main>
        {updateAvailable.value && (
          <div class="banner info">
            <span class="grow">Er is een nieuwe versie van de app.</span>
            <button class="btn cyan" onClick={applyUpdate}>
              Bijwerken
            </button>
          </div>
        )}
        {children}
      </main>
      {nav && <BottomNav />}
    </div>
  );
}

export function UndoRedo() {
  return (
    <>
      <button class="iconbtn undo" disabled={!canUndo.value} onClick={undo} aria-label="Ongedaan maken" title="Ongedaan maken">
        ↶
      </button>
      {canRedo.value && (
        <button class="iconbtn" onClick={redo} aria-label="Opnieuw" title="Opnieuw">
          ↷
        </button>
      )}
    </>
  );
}

const tabs = [
  { path: '', match: ['', 't', 'nieuw'], ico: '🏆', label: 'Toernooien' },
  { path: 'ranglijst', match: ['ranglijst'], ico: '📈', label: 'Ranglijst' },
  { path: 'spelers', match: ['spelers', 'speler'], ico: '👤', label: 'Spelers' },
  { path: 'kasten', match: ['kasten'], ico: '🕹️', label: 'Kasten' },
  { path: 'meer', match: ['meer'], ico: '⚙️', label: 'Meer' },
];

function BottomNav() {
  const cur = route.value[0] ?? '';
  return (
    <nav class="bottomnav">
      {tabs.map((t) => (
        <a key={t.path} href={'#/' + t.path} class={t.match.includes(cur) ? 'active' : ''}>
          <span class="ico">{t.ico}</span>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
