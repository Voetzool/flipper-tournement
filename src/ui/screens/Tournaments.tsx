import { Icon } from '../components/Icon';
import { tr } from '../../i18n';
import { dispatch, state } from '../../app/state';
import { go } from '../../app/router';
import { BackupBanner } from '../components/BackupBanner';
import { HomeViewToggle } from '../components/HomeViewToggle';
import { Shell } from '../components/Shell';
import { createFolder, FolderItems, isDone, TournamentItems } from '../components/TournamentItems';

export function TournamentsScreen() {
  const s = state.value;
  const all = [...s.tournaments.values()].sort((a, b) => b.createdAt - a.createdAt);
  const visible = all.filter((t) => !t.archived);
  // Wat nog bezig is staat altijd bovenaan, ook als het in een map zit.
  const active = visible.filter((t) => !isDone(t));
  const loose = visible.filter((t) => isDone(t) && !t.folderId);
  const done = loose.filter((t) => t.format !== 'single');
  const singles = loose.filter((t) => t.format === 'single');
  const folders = [...s.folders.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const archivedCount = all.length - visible.length;

  const archiveAll = () => {
    if (!confirm(tr('{n} afgeronde toernooien en potjes (buiten mappen) naar het archief verplaatsen?', { n: loose.length }))) return;
    dispatch({ type: 'TournamentsArchived', tournamentIds: loose.map((t) => t.id), archived: true });
  };

  return (
    <Shell
      title={
        <>
          <img class="logo" src="icons/icon.svg" alt="" width={32} height={32} />
          {tr('Flipper Toernooi')}
        </>
      }
    >
      <BackupBanner />
      <div class="grid2">
        <button class="btn primary big" onClick={() => go('nieuw')}>
          <Icon name="trophy" /> {tr('Toernooi')}
        </button>
        <button class="btn cyan big" onClick={() => go('pot')}>
          <Icon name="bolt" /> {tr('Losse pot')}
        </button>
      </div>

      {all.length > 0 && (
        <div class="row home-tools">
          <HomeViewToggle />
          <span class="grow" />
          <button class="btn ghost small" onClick={() => createFolder()}>
            <Icon name="create_new_folder" /> {tr('Nieuwe map')}
          </button>
        </div>
      )}

      {active.length > 0 && <h2>{tr('Bezig')}</h2>}
      <TournamentItems items={active} />
      {folders.length > 0 && <h2>{tr('Mappen')}</h2>}
      <FolderItems folders={folders} />
      {done.length > 0 && <h2>{tr('Afgerond')}</h2>}
      <TournamentItems items={done} />
      {singles.length > 0 && <h2>{tr('Losse potjes')}</h2>}
      <TournamentItems items={singles} />

      {(loose.length > 0 || archivedCount > 0) && (
        <div class="row home-tools" style="margin-top:20px">
          {loose.length > 0 && (
            <button class="btn ghost small" onClick={archiveAll}>
              <Icon name="archive" /> {tr('Afgeronde archiveren')}
            </button>
          )}
          <span class="grow" />
          {archivedCount > 0 && (
            <a class="btn ghost small" href="#/archief">
              <Icon name="inventory_2" /> {tr('Archief ({n})', { n: archivedCount })}
            </a>
          )}
        </div>
      )}
      {!all.length && <p class="empty">{tr('Nog geen toernooien of potjes. Voeg eerst spelers (en machines) toe en start een toernooi of een losse pot.')}</p>}
    </Shell>
  );
}
