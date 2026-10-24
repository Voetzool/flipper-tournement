import { toast } from '../../app/state';

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" key={t.id} role="status">
      {t.text}
    </div>
  );
}
