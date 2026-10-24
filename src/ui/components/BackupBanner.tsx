import { tr } from '../../i18n';
import { events, lastBackupAt } from '../../app/state';
import { needsBackupReminder } from '../../backup/backup';

export function BackupBanner() {
  if (!needsBackupReminder(events.value, lastBackupAt.value)) return null;
  const last = lastBackupAt.value;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  return (
    <div class="banner">
      <span class="grow">
        💾 {days === null ? tr('Je hebt nog nooit een back-up gemaakt.') : days === 1 ? tr('Laatste back-up: 1 dag geleden.') : tr('Laatste back-up: {n} dagen geleden.', { n: days })}
      </span>
      <a class="btn" href="#/meer">
        {tr('Back-up')}
      </a>
    </div>
  );
}
