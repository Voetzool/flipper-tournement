import { homeView, setHomeView } from '../../app/settings';
import { tr } from '../../i18n';
import { Icon } from './Icon';

/** Wissel tussen lijst en raster (onthouden per apparaat). */
export function HomeViewToggle() {
  return (
    <div class="seg mini" role="radiogroup" aria-label={tr('Weergave')}>
      <button class={homeView.value === 'list' ? 'on' : ''} role="radio" aria-checked={homeView.value === 'list'} onClick={() => setHomeView('list')} aria-label={tr('Lijst')} title={tr('Lijst')}>
        <Icon name="view_list" />
      </button>
      <button class={homeView.value === 'grid' ? 'on' : ''} role="radio" aria-checked={homeView.value === 'grid'} onClick={() => setHomeView('grid')} aria-label={tr('Raster')} title={tr('Raster')}>
        <Icon name="grid_view" />
      </button>
    </div>
  );
}
