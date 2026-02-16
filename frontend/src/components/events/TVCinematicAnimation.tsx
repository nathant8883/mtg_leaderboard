import type { TournamentEvent, StandingsEntry } from '../../services/api';
import { CinematicOpening } from './CinematicOpening';
import { CinematicReseed } from './CinematicReseed';
import { CinematicClosing } from './CinematicClosing';

interface TVCinematicAnimationProps {
  event: TournamentEvent;
  animationType: 'shuffle' | 'reseed' | 'closing';
  previousStandings?: StandingsEntry[];
  onComplete: () => void;
}

export function TVCinematicAnimation({
  event,
  animationType,
  previousStandings,
  onComplete,
}: TVCinematicAnimationProps) {
  if (animationType === 'closing') {
    return (
      <CinematicClosing
        event={event}
        previousStandings={previousStandings}
        onComplete={onComplete}
      />
    );
  }

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
