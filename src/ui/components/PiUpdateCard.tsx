import { checkPiUpdate, installPiUpdate, piUpdate } from '../../app/piUpdate';
import { tr } from '../../i18n';
import { Icon } from './Icon';

/** Pi-versie: Pi-software controleren en bijwerken vanuit de app (Instellingen → Over). */
export function PiUpdateCard() {
  const st = piUpdate.value;
  const terminalTip = (
    <div class="small muted">
      {tr('Lukt het niet? Op de Pi zelf kan het ook met:')} <code>sudo pinball-tournament update</code>
    </div>
  );
  return (
    <div class="stack">
      <div class="muted">{tr('Pi-software: v{v}', { v: __APP_VERSION__ })}</div>
      {st.step === 'available' && (
        <>
          <div>{tr('Versie {v} is beschikbaar.', { v: st.latest })}</div>
          <button
            class="btn primary block"
            onClick={() => confirm(tr('De Pi bijwerken naar versie {v}? Dat duurt een paar minuten; de app is dan even niet bereikbaar. Laat de Pi aan.', { v: st.latest })) && installPiUpdate(st.latest)}
          >
            <Icon name="download" /> {tr('Pi bijwerken')}
          </button>
        </>
      )}
      {st.step === 'installing' && (
        <div class="banner info">
          <span class="grow">{tr('Bezig met bijwerken naar versie {v}… Dit duurt een paar minuten (bij een Pi 3B+ wat langer). Laat de Pi aan; de app herlaadt vanzelf.', { v: st.latest })}</span>
        </div>
      )}
      {st.step !== 'available' && st.step !== 'installing' && (
        <button class="btn block" disabled={st.step === 'checking'} onClick={checkPiUpdate}>
          <Icon name="refresh" /> {st.step === 'error' ? tr('Opnieuw proberen') : tr('Controleren op update')}
        </button>
      )}
      {st.step === 'checking' && <div class="muted">{tr('Bezig…')}</div>}
      {st.step === 'latest' && <div class="muted">{tr('Je hebt de nieuwste versie.')}</div>}
      {st.step === 'offline' && <div class="banner">{tr('De Pi heeft geen internet. Steek de netwerkkabel in de Pi en probeer het opnieuw.')}</div>}
      {st.step === 'error' && (
        <>
          <div class="banner">
            <span class="grow">
              {tr('Bijwerken is niet gelukt:')} {tr(st.message)}
            </span>
          </div>
          {terminalTip}
        </>
      )}
    </div>
  );
}
