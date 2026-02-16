import type { TournamentEvent, StandingsEntry } from '../../services/api';
import { CinematicOpening } from './CinematicOpening';
import { CinematicReseed } from './CinematicReseed';

interface TVCinematicAnimationProps {
  event: TournamentEvent;
  animationType: 'shuffle' | 'reseed';
  previousStandings?: StandingsEntry[];
  onComplete: () => void;
}

export function TVCinematicAnimation({
  event,
  animationType,
  previousStandings,
  onComplete,
}: TVCinematicAnimationProps) {
  if (animationType === 'reseed' && previousStandings) {
    return (
      <CinematicReseed
        event={event}
        previousStandings={previousStandings}
        onComplete={onComplete}
      />
    );
  }

  return (
    <CinematicOpening
      event={event}
      onComplete={onComplete}
    />
  );
}
