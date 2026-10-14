import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import type { SeasonAward, SeasonRecap } from '../services/api';
import { getSeasonBadgeStyle } from '../utils/seasonBadges';
import PlayerAvatar from './PlayerAvatar';
import ColorPips from './ColorPips';

const PLACE_COLORS: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
const CONFETTI_COLORS = ['#667eea', '#764ba2', '#FFD700', '#33D9B2', '#ffffff'];

function fireConfetti(big: boolean) {
  const base = { colors: CONFETTI_COLORS, zIndex: 10001, disableForReducedMotion: true };
  confetti({ ...base, particleCount: big ? 160 : 80, spread: 80, startVelocity: 45, origin: { y: 0.35 } });
  if (big) {
    // Side cannons for podium finishes
    setTimeout(() => {
      confetti({ ...base, particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } });
      confetti({ ...base, particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } });
    }, 350);
  }
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function Medal({ award }: { award: SeasonAward }) {
  const style = getSeasonBadgeStyle(award);
  const isDeck = award.award_type === 'deck_placement';
  return (
    <div className="flex flex-col items-center gap-1.5 w-[84px]">
      <div
        className="w-14 h-14 rounded-full border-[3px] overflow-hidden flex items-center justify-center bg-[#25262B]"
        style={{ borderColor: style.color, boxShadow: `0 0 14px ${style.glow}` }}
      >
        {isDeck && award.commander_image_url ? (
          <img src={award.commander_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-black" style={{ color: style.color }}>
            {award.award_type === 'peak_elo' ? award.stats.peak_elo : `#${award.placement}`}
          </span>
        )}
      </div>
      <div className="text-[11px] font-semibold text-center leading-tight" style={{ color: style.color }}>
        {style.label}
      </div>
      {isDeck && award.deck_name && (
        <div className="text-[10px] text-[#909296] text-center leading-tight truncate w-full">{award.deck_name}</div>
      )}
    </div>
  );
}

interface SeasonRecapModalProps {
  recap: SeasonRecap;
  onClose: () => void;
}

/** End-of-season recap: your finish, record, badges and best deck, with confetti. */
function SeasonRecapModal({ recap, onClose }: SeasonRecapModalProps) {
  const podium = recap.rank !== null && recap.rank <= 3;
  const finishColor = recap.rank ? PLACE_COLORS[recap.rank] ?? '#a5b4fc' : '#909296';
  const isChampion = recap.rank === 1;
  const played = recap.games_played > 0;

  useEffect(() => {
    if (played) fireConfetti(podium || recap.awards.length > 0);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      confetti.reset();
    };
  }, [played, podium, recap.awards.length, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 10000 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[20px] border border-[#2C2E33] bg-[#1A1B1E] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${recap.season.label} recap`}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-5 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(102,126,234,0.25) 0%, rgba(118,75,162,0.25) 100%)' }}
        >
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#a5b4fc] font-bold">
            {recap.pod_name ?? 'Season'} · Final Results
          </div>
          <h2 className="text-white text-2xl font-black mt-1 mb-0">{recap.season.label}</h2>

          {played ? (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 12 }}
              className="mt-4"
            >
              {recap.rank ? (
                <>
                  <div
                    className="text-7xl font-black leading-none"
                    style={{ color: finishColor, textShadow: podium ? `0 0 30px ${finishColor}66` : undefined }}
                  >
                    {ordinal(recap.rank)}
                  </div>
                  <div className="text-[#C1C2C5] text-sm mt-2">
                    {isChampion ? 'Season Champion' : `of ${recap.ranked_count} ranked players`}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl font-black text-[#C1C2C5] leading-none">Unranked</div>
                  <div className="text-[#909296] text-sm mt-2">
                    {recap.games_needed} more {recap.games_needed === 1 ? 'game' : 'games'} needed to place
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <div className="text-[#909296] text-sm mt-4">You didn't play this season</div>
          )}
        </div>

        <div className="px-5 pb-5 pt-4 flex flex-col gap-4">
          {/* Stats */}
          {played && (
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-[#141517] rounded-[10px] text-center">
                <div className="text-lg font-bold text-white">{recap.wins}-{recap.losses}</div>
                <div className="text-[#909296] text-[11px]">Record</div>
              </div>
              <div className="p-3 bg-[#141517] rounded-[10px] text-center">
                <div className="text-lg font-bold text-[#667eea]">{Math.round(recap.win_rate)}%</div>
                <div className="text-[#909296] text-[11px]">Win Rate</div>
              </div>
              <div className="p-3 bg-[#141517] rounded-[10px] text-center">
                <div className="text-lg font-bold text-[#667eea]">{recap.elo ?? '—'}</div>
                <div className="text-[#909296] text-[11px]">
                  {recap.peak_elo && recap.elo && recap.peak_elo > recap.elo ? `Elo · peak ${recap.peak_elo}` : 'Final Elo'}
                </div>
              </div>
            </div>
          )}

          {/* Badges earned */}
          {recap.awards.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#909296] font-semibold mb-3 text-center">
                Badges Earned
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {recap.awards.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5 + i * 0.15, type: 'spring', stiffness: 260, damping: 14 }}
                  >
                    <Medal award={a} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Best deck */}
          {recap.top_deck && (
            <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-[10px]">
              <div className="w-11 h-11 rounded-[8px] overflow-hidden bg-[#25262B] flex-shrink-0">
                {recap.top_deck.commander_image_url && (
                  <img src={recap.top_deck.commander_image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-[#909296] font-semibold">Best Deck</div>
                <div className="text-white text-sm font-semibold truncate">{recap.top_deck.deck_name}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-white">
                  {recap.top_deck.wins}-{recap.top_deck.games_played - recap.top_deck.wins}
                </div>
                {recap.top_deck.colors.length > 0 && <ColorPips colors={recap.top_deck.colors} />}
              </div>
            </div>
          )}

          {/* Champion (when it wasn't you) */}
          {recap.champion && !isChampion && (
            <div className="flex items-center gap-3 p-3 rounded-[10px] border border-[rgba(255,215,0,0.25)] bg-[rgba(255,215,0,0.06)]">
              <PlayerAvatar
                playerName={recap.champion.player_name}
                customAvatar={recap.champion.custom_avatar}
                picture={recap.champion.picture}
                size="small"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-[#FFD700] font-semibold">Champion</div>
                <div className="text-white text-sm font-semibold truncate">{recap.champion.player_name}</div>
              </div>
              {recap.champion.elo != null && (
                <div className="text-sm font-bold text-[#FFD700]">{recap.champion.elo}</div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-[10px] border-none text-white font-bold text-base cursor-pointer shadow-[0_4px_16px_rgba(102,126,234,0.35)] active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            {played ? "Let's go" : 'Close'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

export default SeasonRecapModal;
