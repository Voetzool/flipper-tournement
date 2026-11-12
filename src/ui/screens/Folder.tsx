import { Icon } from '../components/Icon';
import { tr } from '../../i18n';
import { dispatch, state } from '../../app/state';
import { go } from '../../app/router';
import { HomeViewToggle } from '../components/HomeViewToggle';
import { Shell } from '../components/Shell';
import { TournamentItems } from '../components/TournamentItems';

/** Eén map: de toernooien en potjes erin, hernoemen en verwijderen. */
export function FolderScreen({ id }: { id: string }) {
  const s = state.value;
  const f = s.folders.get(id);
  if (!f) {
    return (
      <Shell title={tr('Map')} back="">
        <p class="empty">{tr('Deze map bestaat niet (meer).')}</p>
      </Shell>
    );
  }
  const items = [...s.tournaments.values()].filter((t) => t.folderId === id && !t.archived).sort((a, b) => b.createdAt - a.createdAt);
  const rename = () => {
    const name = prompt(tr('Nieuwe naam van de map:'), f.name)?.trim();
    if (name && name !== f.name) dispatch({ type: 'FolderRenamed', folderId: id, name });
  };
  const remove = () => {
    if (!confirm(tr('Map "{naam}" verwijderen? Wat erin zit komt weer op het startscherm.', { naam: f.name }))) return;
    dispatch({ type: 'FolderDeleted', folderId: id });
    go('');
  };
  return (
    <Shell
      title={f.name}
      back=""
      actions={
        <>
          <button class="iconbtn" onClick={rename} aria-label={tr('Hernoemen')} title={tr('Hernoemen')}>
            <Icon name="edit" />
          </button>
          <button class="iconbtn" onClick={remove} aria-label={tr('Map verwijderen')} title={tr('Map verwijderen')}>
            <Icon name="delete" />
          </button>
        </>
      }
    >
      <div class="row home-tools">
        <HomeViewToggle />
      </div>
      {!items.length && <p class="empty">{tr('Deze map is leeg. Verplaats toernooien of potjes hierheen met het menu (⋮) bij een toernooi.')}</p>}
      <TournamentItems items={items} />
    </Shell>
  );
}

/** Archief: afgeronde toernooien en potjes die van het startscherm zijn gehaald. */
export function ArchiveScreen() {
  const s = state.value;
  const items = [...s.tournaments.values()].filter((t) => t.archived).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <Shell title={tr('Archief')} back="">
      <div class="row home-tools">
        <HomeViewToggle />
        <span class="grow" />
        {items.length > 0 && (
          <button
            class="btn ghost small"
            onClick={() => dispatch({ type: 'TournamentsArchived', tournamentIds: items.map((t) => t.id), archived: false })}
          >
            <Icon name="unarchive" /> {tr('Alles terugzetten')}
          </button>
        )}
      </div>
      {!items.length && <p class="empty">{tr('Het archief is leeg.')}</p>}
      <TournamentItems items={items} />
    </Shell>
  );
}
