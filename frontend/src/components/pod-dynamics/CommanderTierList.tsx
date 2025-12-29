import { useState } from 'react';
import type { CommanderStats, PlayerDeckStats } from '../../services/api';
import ColorPips from '../ColorPips';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import TierBadge from '../TierBadge';
import { TIER_CONFIG, type TierLetter } from '../../utils/tierConfig';

interface CommanderTierListProps {
  commanders: CommanderStats[];
  playerDecks: PlayerDeckStats[];
  currentPlayerName?: string;
}

// Extended tier colors including '?' for unranked
const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'S': { bg: TIER_CONFIG.S.bgClass, text: TIER_CONFIG.S.textClass, border: TIER_CONFIG.S.borderClass },
  'A': { bg: TIER_CONFIG.A.bgClass, text: TIER_CONFIG.A.textClass, border: TIER_CONFIG.A.borderClass },
  'B': { bg: TIER_CONFIG.B.bgClass, text: TIER_CONFIG.B.textClass, border: TIER_CONFIG.B.borderClass },
  'C': { bg: TIER_CONFIG.C.bgClass, text: TIER_CONFIG.C.textClass, border: TIER_CONFIG.C.borderClass },
  'D': { bg: TIER_CONFIG.D.bgClass, text: TIER_CONFIG.D.textClass, border: TIER_CONFIG.D.borderClass },
  '?': { bg: 'bg-[#909296]/20', text: 'text-[#909296]', border: 'border-[#909296]/30' },
};

const isValidTier = (tier: string): tier is TierLetter => {
  return ['S', 'A', 'B', 'C', 'D'].includes(tier);
};

export function CommanderTierList({ commanders, playerDecks, currentPlayerName }: CommanderTierListProps) {
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<'pod' | 'mine'>('pod');

  if (commanders.length === 0 && playerDecks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[#909296] text-sm">
        No deck data available yet.
      </div>
    );
  }

  const displayCommanders = showAll ? commanders : commanders.slice(0, 8);

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      {playerDecks.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => setView('pod')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === 'pod'
                ? 'bg-[#667eea] text-white'
                : 'bg-[#141517] text-[#909296] hover:text-white'
            }`}
          >
            Pod Meta
          </button>
          <button
            onClick={() => setView('mine')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === 'mine'
                ? 'bg-[#667eea] text-white'
                : 'bg-[#141517] text-[#909296] hover:text-white'
            }`}
          >
            My Decks
          </button>
        </div>
      )}

      {view === 'pod' ? (
        <>
          {/* Tier Legend */}
          <div className="flex flex-wrap gap-2 text-xs">
            {['S', 'A', 'B', 'C', 'D', '?'].map((tier) => (
              <div
                key={tier}
                className={`px-2 py-1 rounded ${TIER_COLORS[tier].bg} ${TIER_COLORS[tier].text}`}
              >
                {tier === '?' ? 'Unranked' : `${tier} Tier`}
              </div>
            ))}
          </div>

          {/* Commander List */}
          <div className="space-y-2">
            {displayCommanders.map((commander, index) => {
              const tierStyle = TIER_COLORS[commander.tier] || TIER_COLORS['?'];
              const isCurrentPlayer = commander.players.includes(currentPlayerName || '');

              return (
                <div
                  key={commander.name}
                  className={`flex items-center gap-3 p-3 rounded-lg bg-[#141517] border ${
                    isCurrentPlayer ? 'border-[#667eea]/50' : 'border-transparent'
                  } hover:bg-[#1A1B1E] transition-colors`}
                >
                  {/* Rank */}
                  <div className="w-6 text-center text-[#909296] text-sm font-medium">
                    {index + 1}
                  </div>

                  {/* Tier Badge */}
                  {isValidTier(commander.tier) ? (
                    <TierBadge tier={commander.tier} variant="compact" size="md" />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center font-bold ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border} border`}
                    >
                      {commander.tier}
                    </div>
                  )}

                  {/* Commander Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">
                        {commander.name}
                      </span>
                      {commander.colors.length > 0 && (
                        <ColorPips colors={commander.colors} size="sm" />
                      )}
                    </div>
                    <div className="text-xs text-[#909296]">
                      {commander.players.length === 1
                        ? commander.players[0]
                        : `${commander.players.length} players`}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <div
                      className={`font-bold ${
                        commander.win_rate >= 30 ? 'text-[#33D9B2]' :
                        commander.win_rate >= 20 ? 'text-white' : 'text-[#FF6B6B]'
                      }`}
                    >
                      {commander.win_rate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-[#909296]">
                      {commander.wins}W / {commander.games}G
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show More/Less */}
          {commanders.length > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full py-2 text-sm text-[#667eea] hover:text-white transition-colors flex items-center justify-center gap-1"
            >
              {showAll ? (
                <>
                  Show Less <ChevronUp size={16} />
                </>
              ) : (
                <>
                  Show All ({commanders.length}) <ChevronDown size={16} />
                </>
              )}
            </button>
          )}
        </>
      ) : (
        /* My Decks View */
        <div className="space-y-2">
          {playerDecks.length === 0 ? (
            <div className="text-center py-8 text-[#909296] text-sm">
              You haven't played any games yet.
            </div>
          ) : (
            playerDecks.map((deck, index) => (
              <div
                key={deck.deck_id}
                className="flex items-center gap-3 p-3 rounded-lg bg-[#141517] hover:bg-[#1A1B1E] transition-colors"
              >
                {/* Rank */}
                <div className="w-6 text-center">
                  {index === 0 && deck.games >= 3 ? (
                    <Trophy size={16} className="text-[#FFD700] mx-auto" />
                  ) : (
                    <span className="text-[#909296] text-sm font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Deck Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">
                      {deck.name}
                    </span>
                    {deck.colors.length > 0 && (
                      <ColorPips colors={deck.colors} size="sm" />
                    )}
                  </div>
                  <div className="text-xs text-[#909296]">
                    {deck.games} games played
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <div
                    className={`font-bold ${
                      deck.win_rate >= 30 ? 'text-[#33D9B2]' :
                      deck.win_rate >= 20 ? 'text-white' : 'text-[#FF6B6B]'
                    }`}
                  >
                    {deck.win_rate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-[#909296]">
                    {deck.wins} wins
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
