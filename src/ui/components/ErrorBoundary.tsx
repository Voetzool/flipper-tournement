import { Component, type ComponentChildren } from 'preact';
import { go } from '../../app/router';
import { applyUpdate, updateAvailable } from '../../app/pwa';
import { tr } from '../../i18n';
import { Icon } from './Icon';

interface State {
  error: Error | null;
}

/** Vangt fouten in een scherm op en toont wat er misging (met versie en browser), i.p.v. een leeg scherm. */
export class ErrorBoundary extends Component<{ children: ComponentChildren }, State> {
  state: State = { error: null };

  componentDidCatch(error: Error) {
    console.error(error);
    this.setState({ error });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stack = (error.stack ?? '').split('\n').slice(0, 3).join('\n');
    return (
      <div class="app">
        <main>
          <div class="card stack error-box">
            <h2 style="margin:0">
              <Icon name="error" /> {tr('Er ging iets mis')}
            </h2>
            <p style="margin:0">{tr('Maak een foto van dit scherm en stuur die naar de maker van de app.')}</p>
            <pre class="error-details">
              {String(error.message || error)}
              {stack ? '\n' + stack : ''}
              {`\n\nv${__APP_VERSION__} · ${__BUILD_TIME__}\n${navigator.userAgent}`}
            </pre>
            {updateAvailable.value && (
              <button class="btn primary block" onClick={applyUpdate}>
                {tr('Bijwerken')}
              </button>
            )}
            <button
              class="btn block"
              onClick={() => {
                this.setState({ error: null });
                go('');
              }}
            >
              {tr('Terug naar Spelen')}
            </button>
            <button class="btn ghost block" onClick={() => location.reload()}>
              <Icon name="refresh" /> {tr('Opnieuw laden')}
            </button>
          </div>
        </main>
      </div>
    );
  }
}
