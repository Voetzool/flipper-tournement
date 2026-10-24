import { loaded } from '../app/state';
import { route } from '../app/router';
import { Toast } from './components/Toast';
import { MachinesScreen } from './screens/Machines';
import { MoreScreen } from './screens/More';
import { NewTournamentScreen } from './screens/NewTournament';
import { PlayersScreen } from './screens/Players';
import { ScoreboardScreen } from './screens/Scoreboard';
import { TournamentScreen } from './screens/Tournament';
import { TournamentsScreen } from './screens/Tournaments';

export function App() {
  if (!loaded.value) return <p class="empty">Laden…</p>;
  return (
    <>
      <Screen />
      <Toast />
    </>
  );
}

function Screen() {
  const [a, b, c] = route.value;
  switch (a) {
    case 'spelers':
      return <PlayersScreen />;
    case 'kasten':
      return <MachinesScreen />;
    case 'meer':
      return <MoreScreen />;
    case 'nieuw':
      return <NewTournamentScreen />;
    case 't':
      if (c === 'scorebord') return <ScoreboardScreen id={b} />;
      return <TournamentScreen key={b} id={b} tab={c === 'stand' || c === 'geschiedenis' ? c : 'ronde'} />;
    default:
      return <TournamentsScreen />;
  }
}
