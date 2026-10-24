import { events, lastBackupAt } from '../../app/state';
import { needsBackupReminder } from '../../backup/backup';

export function BackupBanner() {
  if (!needsBackupReminder(events.value, lastBackupAt.value)) return null;
  const last = lastBackupAt.value;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  return (
    <div class="banner">
      <span class="grow">
        💾 {days === null ? 'Je hebt nog nooit een back-up gemaakt.' : `Laatste back-up: ${days} ${days === 1 ? 'dag' : 'dagen'} geleden.`}
      </span>
      <a class="btn" href="#/meer">
        Back-up
      </a>
    </div>
  );
}
