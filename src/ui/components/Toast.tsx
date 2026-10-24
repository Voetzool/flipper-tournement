import { toast } from '../../app/state';

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" key={t.id} role="status">
      <span>{t.text}</span>
      {t.action && (
        <button
          class="toast-action"
          onClick={() => {
            toast.value = null;
            t.action!.run();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}
