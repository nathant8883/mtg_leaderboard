import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import { seasonApi, type SeasonRecap } from '../services/api';
import SeasonRecapModal from './SeasonRecapModal';

/**
 * Pops up the end-of-season recap once per finished season. Dismissing marks
 * it seen on the server; it can be reopened from the Hall of Fame.
 */
function SeasonRecapPrompt() {
  const { currentPlayer, isGuest } = useAuth();
  const { currentPod } = usePod();
  const [recap, setRecap] = useState<SeasonRecap | null>(null);

  useEffect(() => {
    if (!currentPlayer || isGuest || !currentPod?.id) return;
    let cancelled = false;
    seasonApi.getPendingRecap()
      .then(data => { if (!cancelled) setRecap(data); })
      .catch(err => console.debug('No season recap:', err));
    return () => { cancelled = true; };
  }, [currentPlayer?.id, isGuest, currentPod?.id]);

  const dismiss = useCallback(() => {
    if (!recap) return;
    setRecap(null);
    seasonApi.markRecapSeen(recap.season.number).catch(err =>
      console.error('Error dismissing season recap:', err)
    );
  }, [recap]);

  return recap ? <SeasonRecapModal recap={recap} onClose={dismiss} /> : null;
}

export default SeasonRecapPrompt;
