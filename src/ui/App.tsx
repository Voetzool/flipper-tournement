import { loaded } from '../app/state';
import { route } from '../app/router';
import { Toast } from './components/Toast';
import { MachineDetailScreen } from './screens/MachineDetail';
import { MachinesScreen } from './screens/Machines';
import { MoreScreen } from './screens/More';
import { NewTournamentScreen } from './screens/NewTournament';
import { PlayerProfileScreen } from './screens/PlayerProfile';
import { PlayersScreen } from './screens/Players';
import { RankingScreen } from './screens/Ranking';
import { RulesScreen } from './screens/Rules';
import { ScoreboardScreen } from './screens/Scoreboard';
import { NewSingleScreen } from './screens/Single';
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
    case 'speler':
      return <PlayerProfileScreen key={b} id={b} />;
    case 'ranglijst':
      return <RankingScreen />;
    case 'kast':
      if (c === 'regels') return <RulesScreen key={b} id={b} />;
      return <MachineDetailScreen key={b} id={b} />;
    case 'kasten':
      return <MachinesScreen />;
    case 'meer':
      return <MoreScreen />;
    case 'pot':
      return <NewSingleScreen key={b ?? 'nieuw'} from={b} />;
    case 'nieuw':
      return <NewTournamentScreen />;
    case 't':
      if (c === 'scorebord') return <ScoreboardScreen id={b} />;
      return <TournamentScreen key={b} id={b} tab={c === 'ronde' || c === 'stand' || c === 'kasten' || c === 'geschiedenis' ? c : 'auto'} />;
    default:
      return <TournamentsScreen />;
  }
}
