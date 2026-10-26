import { tr } from '../../i18n';
import type { ComponentChildren } from 'preact';
import { Icon, type IconName } from './Icon';
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
          <a class="iconbtn back" href={'#/' + back} aria-label={tr('Terug')}>
            <Icon name="arrow_back_ios_new" />
          </a>
        )}
        <h1>{title}</h1>
        {actions}
      </header>
      <main>
        {updateAvailable.value && (
          <div class="banner info">
            <span class="grow">{tr('Er is een nieuwe versie van de app.')}</span>
            <button class="btn cyan" onClick={applyUpdate}>
              {tr('Bijwerken')}
            </button>
          </div>
        )}
        {children}
      </main>
      {nav && <BottomNav />}
    </div>
  );
}

/** Undo/redo voor één toernooi; alleen zichtbaar in het toernooi en op het scorebord. */
export function UndoRedo({ tournamentId }: { tournamentId: string }) {
  return (
    <>
      <button
        class="iconbtn undo"
        disabled={!canUndo(tournamentId)}
        onClick={() => undo(tournamentId)}
        aria-label={tr('Ongedaan maken')}
        title={tr('Ongedaan maken')}
      >
        <Icon name="undo" />
      </button>
      {canRedo(tournamentId) && (
        <button class="iconbtn" onClick={() => redo(tournamentId)} aria-label={tr('Opnieuw')} title={tr('Opnieuw')}>
          <Icon name="redo" />
        </button>
      )}
    </>
  );
}

const tabs = [
  { path: '', match: ['', 't', 'nieuw', 'pot'], ico: 'sports_esports', label: 'Spelen' },
  { path: 'ranglijst', match: ['ranglijst'], ico: 'leaderboard', label: 'Ranglijst' },
  { path: 'spelers', match: ['spelers', 'speler'], ico: 'group', label: 'Spelers' },
  { path: 'kasten', match: ['kasten', 'kast'], ico: 'joystick', label: 'Machines' },
  { path: 'meer', match: ['meer'], ico: 'settings', label: 'Instellingen' },
] satisfies { path: string; match: string[]; ico: IconName; label: string }[];

function BottomNav() {
  const cur = route.value[0] ?? '';
  return (
    <nav class="bottomnav">
      {tabs.map((t) => (
        <a key={t.path} href={'#/' + t.path} class={t.match.includes(cur) ? 'active' : ''}>
          <span class="ico">
            <Icon name={t.ico} fill={t.match.includes(cur)} />
          </span>
          {tr(t.label)}
        </a>
      ))}
    </nav>
  );
}
