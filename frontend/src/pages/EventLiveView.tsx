import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { eventApi } from '../services/api';
import type { TournamentEvent, EventRound, PodAssignment, StandingsEntry, PlayerDeckInfo } from '../services/api';
import {
  IconTrophy,
  IconCrown,
  IconLoader2,
  IconClock,
  IconSwords,
  IconCalendar,
  IconClipboardList,
} from '@tabler/icons-react';
import { TVShuffleAnimation } from '../components/events/TVShuffleAnimation';
import ColorPips from '../components/ColorPips';
import PlayerAvatar from '../components/PlayerAvatar';
import { getColorIdentityStyle } from '../utils/manaColors';
import { getSetColors, getSetGradientCSS } from '../utils/setColors';

// ─── Helpers ────────────────────────────────────────────────────

function rankMedal(rank: number): string | null {
  if (rank === 1) return '\uD83E\uDD47';
  if (rank === 2) return '\uD83E\uDD48';
  if (rank === 3) return '\uD83E\uDD49';
  return null;
}

function rankColor(rank: number): string {
  if (rank === 1) return 'text-[#FFD700]';
  if (rank === 2) return 'text-[#C0C0C0]';
  if (rank === 3) return 'text-[#CD7F32]';
  return 'text-[#909296]';
}

function findPlayerName(event: TournamentEvent, playerId: string): string {
  return event.players.find((p) => p.player_id === playerId)?.player_name ?? 'Unknown';
}

function findPlayerAvatar(event: TournamentEvent, playerId: string): string | undefined {
  return event.players.find((p) => p.player_id === playerId)?.avatar;
}

function getRoundDelta(event: TournamentEvent, roundNumber: number, playerId: string): number | null {
  const round = event.rounds.find((r) => r.round_number === roundNumber);
  if (!round) return null;
  const result = round.results.find((r) => r.player_id === playerId);
  return result ? result.total : null;
}

function getPodWinner(
  event: TournamentEvent,
  round: EventRound,
  pod: PodAssignment,
): { name: string; playerId: string; points: number } | null {
  if (pod.match_status !== 'completed') return null;
  const podResults = round.results.filter((r) => pod.player_ids.includes(r.player_id));
  if (podResults.length === 0) return null;
  const winner = podResults.reduce((best, r) => (r.total > best.total ? r : best), podResults[0]);
  return {
    name: findPlayerName(event, winner.player_id),
    playerId: winner.player_id,
    points: winner.total,
  };
}

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function hasAnyInProgress(event: TournamentEvent): boolean {
  return event.rounds.some((r) =>
    r.pods.some((p) => p.match_status === 'in_progress'),
  );
}

function getInProgressPods(event: TournamentEvent): Array<{ round: EventRound; pod: PodAssignment }> {
  const result: Array<{ round: EventRound; pod: PodAssignment }> = [];
  for (const round of event.rounds) {
    for (const pod of round.pods) {
      if (pod.match_status === 'in_progress') {
        result.push({ round, pod });
      }
    }
  }
  return result;
}

// ─── LIVE Badge ──────────────────────────────────────────────────

function LiveBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#E03131]/20 text-[#FF6B6B] border border-[#E03131]/40 ${className}`}
    >
      <span className="w-2 h-2 rounded-full bg-[#FF6B6B] animate-pulse" />
      LIVE
    </span>
  );
}

// ─── Status Dot ──────────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#51CF66] opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#51CF66]" />
      </span>
    );
  }
  return <span className="inline-flex rounded-full h-3 w-3 bg-[#5C5F66]" />;
}

// ─── Round Progress Bar ─────────────────────────────────────────

function RoundProgressBar({ event }: { event: TournamentEvent }) {
  if (event.status === 'completed') {
    return (
      <span className="text-lg font-bold text-[#FFD700]" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
        Completed
      </span>
    );
  }

  const totalRounds = event.round_count;
  const currentRound = event.current_round;

  // Connector width scales with round count — big for TV
  const connectorWidth = totalRounds <= 5 ? 48 : totalRounds <= 7 ? 32 : 20;

  // Build round status array
  const rounds = Array.from({ length: totalRounds }, (_, i) => {
    const roundNumber = i + 1;
    const roundData = event.rounds.find((r) => r.round_number === roundNumber);
    if (roundData?.status === 'completed') return 'completed' as const;
    if (roundNumber === currentRound && event.status === 'active') return 'current' as const;
    return 'pending' as const;
  });

  return (
    <div className="flex items-center">
      {rounds.map((status, i) => (
        <div key={i} className="flex items-center">
          {/* Connector line */}
          {i > 0 && (
            <div
              className="h-[4px] rounded-full"
              style={{
                width: `${connectorWidth}px`,
                backgroundColor:
                  rounds[i - 1] === 'completed' && (status === 'completed' || status === 'current')
                    ? '#667eea'
                    : '#2C2E33',
              }}
            />
          )}
          {/* Dot */}
          {status === 'current' ? (
            <span className="relative flex h-7 w-7">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#667eea] opacity-75" />
              <span className="relative inline-flex rounded-full h-7 w-7 bg-[#667eea]" />
            </span>
          ) : status === 'completed' ? (
            <span className="inline-flex rounded-full h-7 w-7 bg-[#667eea]" />
          ) : (
            <span className="inline-flex rounded-full h-6 w-6 border-[3px] border-[#5C5F66] bg-transparent" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────

function LiveHeader({ event }: { event: TournamentEvent }) {
  const isActive = event.status === 'active';
  const isCompleted = event.status === 'completed';
  const isDraft = event.event_type === 'draft';
  const hasSets = isDraft && event.sets && event.sets.length > 0;
  const headerGradient = hasSets ? getSetGradientCSS(event.sets) : '';

  return (
    <div
      className="relative overflow-hidden flex items-center gap-4 px-6 py-4 border-b border-[#2C2E33]"
      style={{
        background: headerGradient
          ? `${headerGradient}, #111214`
          : '#111214',
      }}
    >
      {/* Watermark — faint set codes behind content */}
      {hasSets && (
        <div
          className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none select-none"
          style={{ opacity: 0.04 }}
        >
          <span
            className="text-white font-bold uppercase whitespace-nowrap"
            style={{ fontSize: '80px', fontFamily: "'Chakra Petch', sans-serif", letterSpacing: '0.1em' }}
          >
            {event.sets.map(s => s.code).join(' ')}
          </span>
        </div>
      )}

      {/* Logo / Trophy */}
      {event.custom_image ? (
        <div className="w-12 h-12 rounded-[10px] overflow-hidden border border-[#2C2E33] flex-shrink-0">
          <img src={event.custom_image} alt={event.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-[10px] bg-[#1A1B1E] border border-[#2C2E33] flex items-center justify-center flex-shrink-0">
          <IconTrophy size={24} className="text-[#667eea]" />
        </div>
      )}

      {/* Event Name */}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-white truncate" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>{event.name}</h1>
        <div className="flex items-center gap-3 text-sm text-[#909296]">
          <span className="flex items-center gap-1.5">
            <IconCalendar size={14} />
            {formatEventDate(event.event_date)}
          </span>
          <span className="text-[#2C2E33]">|</span>
          <span>{event.players.length} Players</span>
          {isDraft && event.game_mode && (
            <>
              <span className="text-[#2C2E33]">|</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#667eea]/15 text-[#667eea] capitalize">
                {event.game_mode}
              </span>
            </>
          )}
          {hasSets && event.sets.length > 1 && (
            <>
              <span className="text-[#2C2E33]">|</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#f59f00]/15 text-[#ffd43b] border border-[#f59f00]/30">
                Chaos
              </span>
            </>
          )}
        </div>
      </div>

      {/* Round Indicator + Status */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {isActive && (
          <span
            className="text-lg font-bold text-[#5C5F66]"
            style={{ fontFamily: "'Chakra Petch', sans-serif" }}
          >
            Round {event.current_round}/{event.round_count}
          </span>
        )}
        <RoundProgressBar event={event} />
        <StatusDot active={isActive} />
      </div>
    </div>
  );
}

// ─── Standings Column ────────────────────────────────────────────

function StandingsPanel({
  event,
  standings,
}: {
  event: TournamentEvent;
  standings: StandingsEntry[];
}) {
  const isCompleted = event.status === 'completed';
  const hasRounds = event.rounds.length > 0 && event.rounds.some((r) => r.results.length > 0);

  if (!hasRounds) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-5 py-4 border-b border-[#2C2E33]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
            <IconTrophy size={20} className="text-[#FFD700]" />
            Standings
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <IconSwords size={40} className="text-[#2C2E33] mx-auto mb-3" />
            <p className="text-lg text-[#5C5F66] font-medium" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>Tournament Starting...</p>
            <p className="text-sm text-[#3C3F44] mt-1">Standings will appear after Round 1</p>
          </div>
        </div>
      </div>
    );
  }

  // Determine the latest completed round for delta display
  const latestCompletedRound = [...event.rounds]
    .filter((r) => r.results.length > 0)
    .sort((a, b) => b.round_number - a.round_number)[0];

  return (
    <div className="flex flex-col h-full">
      {/* Champion banner for completed events */}
      {isCompleted && standings.length > 0 && (
        <div
          className="px-5 py-5 text-center relative overflow-hidden border-b border-[#FFD700]/20"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(255,165,0,0.08) 100%)',
          }}
        >
          <IconTrophy size={32} className="text-[#FFD700] mx-auto mb-2" />
          <p className="text-xs text-[#FFD700]/70 uppercase tracking-[0.2em] font-bold mb-1" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>Champion</p>
          <p className="text-2xl font-bold text-[#FFD700]" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>{standings[0].player_name}</p>
          <p className="text-sm text-[#FFD700]/50 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {event.event_type === 'draft'
              ? `${standings[0].wins}-${standings[0].round_points.length - standings[0].wins}`
              : `${standings[0].total_points} pts \u00B7 ${standings[0].wins}W \u00B7 ${standings[0].kills}K`
            }
          </p>
        </div>
      )}

      <div className="px-5 py-4 border-b border-[#2C2E33]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
          {isCompleted ? (
            <IconCrown size={20} className="text-[#FFD700]" />
          ) : (
            <IconTrophy size={20} className="text-[#FFD700]" />
          )}
          {isCompleted ? 'Final Standings' : 'Standings'}
        </h2>
      </div>

      {/* Table Header */}
      {event.event_type === 'draft' ? (
        <div
          className="grid grid-cols-[2.5rem_3.5rem_1fr_5rem] items-center px-6 py-3 text-xs text-[#5C5F66] border-b border-[#2C2E33]/50 uppercase font-bold"
          style={{ fontFamily: "'Chakra Petch', sans-serif", letterSpacing: '0.15em' }}
        >
          <span>#</span>
          <span></span>
          <span>Player</span>
          <span className="text-right">W-L</span>
        </div>
      ) : (
        <div
          className="grid grid-cols-[2.5rem_3.5rem_1fr_3.5rem_3.5rem_3.5rem_4rem] items-center px-6 py-3 text-xs text-[#5C5F66] border-b border-[#2C2E33]/50 uppercase font-bold"
          style={{ fontFamily: "'Chakra Petch', sans-serif", letterSpacing: '0.15em' }}
        >
          <span>#</span>
          <span></span>
          <span>Player</span>
          <span className="text-right text-[#667eea]" title="Placement Points">Plc</span>
          <span className="text-right text-[#51CF66]" title="Bonus Points">Bon</span>
          <span className="text-right text-[#E03131]" title="Penalties">Pen</span>
          <span className="text-right">Tot</span>
        </div>
      )}

      {/* Table Rows */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {standings.map((entry, idx) => {
          const rank = idx + 1;
          const medal = rankMedal(rank);
          const delta = latestCompletedRound
            ? getRoundDelta(event, latestCompletedRound.round_number, entry.player_id)
            : null;
          const isChampion = isCompleted && rank === 1;
          const isTopThree = rank <= 3;
          const player = event.players.find((p) => p.player_id === entry.player_id);

          if (event.event_type === 'draft') {
            return (
              <div
                key={entry.player_id}
                className={`grid grid-cols-[2.5rem_3.5rem_1fr_5rem] items-center px-6 py-4 border-b border-[#2C2E33]/20 last:border-b-0 transition-colors ${
                  isChampion
                    ? 'bg-[#FFD700]/8'
                    : isTopThree
                      ? 'bg-[#667eea]/5'
                      : ''
                }`}
              >
                <span className={`text-2xl font-bold ${rankColor(rank)}`}>
                  {medal ?? rank}
                </span>
                <PlayerAvatar
                  playerName={entry.player_name}
                  customAvatar={player?.avatar}
                  size="small"
                  className="!w-10 !h-10 !text-base border border-[#2C2E33]"
                />
                <span
                  className={`truncate ${
                    isChampion
                      ? 'text-[#FFD700] font-bold'
                      : isTopThree
                        ? 'text-white font-semibold'
                        : 'text-[#C1C2C5]'
                  }`}
                  style={{ fontSize: '20px', fontFamily: "'Chakra Petch', sans-serif" }}
                >
                  {entry.player_name}
                </span>
                <span
                  className={`text-right font-bold ${isChampion ? 'text-[#FFD700]' : 'text-white'}`}
                  style={{ fontSize: '24px', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {entry.wins}-{entry.round_points.length - entry.wins}
                </span>
              </div>
            );
          }

          // Tournament: Full point breakdown
          let placementPts = 0;
          let bonusPts = 0;
          let penaltyPts = 0;
          for (const round of event.rounds) {
            const result = round.results.find((r) => r.player_id === entry.player_id);
            if (result) {
              placementPts += result.placement_points;
              bonusPts += result.kill_points + result.alt_win_points;
              penaltyPts += result.scoop_penalty;
            }
          }

          return (
            <div
              key={entry.player_id}
              className={`grid grid-cols-[2.5rem_3.5rem_1fr_3.5rem_3.5rem_3.5rem_4rem] items-center px-6 py-4 border-b border-[#2C2E33]/20 last:border-b-0 transition-colors ${
                isChampion
                  ? 'bg-[#FFD700]/8'
                  : isTopThree
                    ? 'bg-[#667eea]/5'
                    : ''
              }`}
            >
              <span className={`text-2xl font-bold ${rankColor(rank)}`}>
                {medal ?? rank}
              </span>
              <PlayerAvatar
                playerName={entry.player_name}
                customAvatar={player?.avatar}
                size="small"
                className="!w-10 !h-10 !text-base border border-[#2C2E33]"
              />
              <span
                className={`truncate ${
                  isChampion
                    ? 'text-[#FFD700] font-bold'
                    : isTopThree
                      ? 'text-white font-semibold'
                      : 'text-[#C1C2C5]'
                }`}
                style={{ fontSize: '20px', fontFamily: "'Chakra Petch', sans-serif" }}
              >
                {entry.player_name}
              </span>
              <span className="text-right text-[#667eea] font-medium" style={{ fontSize: '18px', fontFamily: "'JetBrains Mono', monospace" }}>{placementPts}</span>
              <span className="text-right text-[#51CF66] font-medium" style={{ fontSize: '18px', fontFamily: "'JetBrains Mono', monospace" }}>{bonusPts > 0 ? `+${bonusPts}` : '0'}</span>
              <span className="text-right text-[#E03131] font-medium" style={{ fontSize: '18px', fontFamily: "'JetBrains Mono', monospace" }}>{penaltyPts < 0 ? penaltyPts : '0'}</span>
              <div className="text-right flex items-center justify-end gap-1.5">
                <span
                  className={`font-bold ${isChampion ? 'text-[#FFD700]' : 'text-white'}`}
                  style={{ fontSize: '22px', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {entry.total_points}
                </span>
                {delta !== null && delta > 0 && (
                  <span
                    className="text-[11px] font-bold text-[#51CF66] bg-[#51CF66]/15 px-1.5 py-0.5 rounded-full leading-none"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    +{delta}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scoring Rules ──────────────────────────────────────────────

function ScoringRulesPanel() {
  const placements: [string, string, string][] = [
    ['1st', '3', '#FFD700'],
    ['2nd', '2', '#C0C0C0'],
    ['3rd', '1', '#CD7F32'],
    ['4th', '0', '#555'],
  ];

  return (
    <div
      className="border-t border-[rgba(102,126,234,0.25)] px-6 py-6"
      style={{ background: 'linear-gradient(180deg, rgba(102,126,234,0.06) 0%, rgba(102,126,234,0.02) 100%)' }}
    >
      <h3
        className="text-base font-bold text-white flex items-center gap-2 mb-4 uppercase"
        style={{ fontFamily: "'Chakra Petch', sans-serif", letterSpacing: '0.15em' }}
      >
        <IconClipboardList size={18} className="text-[#667eea]" />
        Scoring
      </h3>

      {/* Placement */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-[#667eea] uppercase tracking-wider mb-2.5">Placement</p>
        <div className="grid grid-cols-2 gap-2.5">
          {placements.map(([label, pts, color]) => (
            <div
              key={label}
              className="flex items-center justify-between bg-[#1A1B1E] rounded-[8px] px-4 py-3"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              <span className="text-sm font-medium" style={{ color }}>{label}</span>
              <span className="text-sm">
                <span className="font-bold text-white">{pts}</span>
                <span className="text-[#555] ml-1">pts</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bonuses & Penalties side-by-side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bonuses */}
        <div>
          <p className="text-xs font-semibold text-[#51CF66] uppercase tracking-wider mb-2.5">Bonuses</p>
          <div className="space-y-2">
            {[
              ['Kill', '+1'],
              ['Alt Win', '+4'],
            ].map(([label, pts]) => (
              <div
                key={label}
                className="flex items-center justify-between bg-[#1A1B1E] rounded-[8px] px-4 py-3"
                style={{ borderLeft: '4px solid #51CF66' }}
              >
                <span className="text-sm text-[#909296]">{label}</span>
                <span className="text-sm font-bold text-[#51CF66]">{pts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Penalties */}
        <div>
          <p className="text-xs font-semibold text-[#E03131] uppercase tracking-wider mb-2.5">Penalties</p>
          <div className="space-y-2">
            <div
              className="flex items-center justify-between bg-[#1A1B1E] rounded-[8px] px-4 py-3"
              style={{ borderLeft: '4px solid #E03131' }}
            >
              <span className="text-sm text-[#909296]">Scoop</span>
              <span className="text-sm font-bold text-[#E03131]">−1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pod Player Card ────────────────────────────────────────────

function PodPlayerCard({
  playerId,
  event,
  round,
  pod,
  isWinner,
}: {
  playerId: string;
  event: TournamentEvent;
  round: EventRound;
  pod: PodAssignment;
  isWinner: boolean;
}) {
  const player = event.players.find((p) => p.player_id === playerId);
  const playerName = player?.player_name ?? 'Unknown';
  const deckInfo: PlayerDeckInfo | undefined = pod.player_decks[playerId];
  const result = round.results.find((r) => r.player_id === playerId);
  const hasDeck = deckInfo && deckInfo.deck_name;
  const isPodCompleted = pod.match_status === 'completed';

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-[10px] transition-all duration-300 ${
        isWinner
          ? 'bg-[rgba(255,215,0,0.08)] border-l-[4px] border-[rgba(255,165,0,0.5)]'
          : 'bg-[rgba(37,38,43,0.3)]'
      }`}
    >
      {/* Commander artwork or placeholder */}
      <div className="flex-shrink-0">
        {hasDeck && deckInfo.commander_image_url ? (
          <div
            className="deck-color-border-wrapper p-[2px] rounded-[10px]"
            style={getColorIdentityStyle(deckInfo.colors || [])}
          >
            <div className="w-[60px] h-[60px] rounded-[8px] overflow-hidden">
              <img
                src={deckInfo.commander_image_url}
                alt=""
                className="w-full h-full object-cover object-[center_20%]"
              />
            </div>
          </div>
        ) : (
          <PlayerAvatar
            playerName={playerName}
            customAvatar={player?.avatar}
            size="small"
            className="!w-[64px] !h-[64px] !text-2xl border-2 border-[#2C2E33]"
          />
        )}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isWinner && <IconCrown size={22} className="text-[#FFD700] flex-shrink-0" />}
          <span
            className={`text-xl truncate ${
              isWinner ? 'text-[#FFD700] font-bold' : isPodCompleted ? 'text-[#909296] font-medium' : 'text-white font-medium'
            }`}
            style={{ fontFamily: "'Chakra Petch', sans-serif" }}
          >
            {playerName}
          </span>
        </div>
        {hasDeck ? (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-[#909296] truncate">{deckInfo.deck_name}</span>
            {deckInfo.colors && deckInfo.colors.length > 0 && (
              <div className="flex-shrink-0">
                <ColorPips colors={deckInfo.colors} size="sm" />
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-[#3C3F44] italic mt-1 block">Selecting deck...</span>
        )}
      </div>

      {/* Points */}
      {result && event.event_type !== 'draft' && (
        <span
          className={`text-lg font-bold flex-shrink-0 ${
            isWinner ? 'text-[#FFD700]' : 'text-[#51CF66]/70'
          }`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          +{result.total}
        </span>
      )}
    </div>
  );
}

// ─── Round Card ──────────────────────────────────────────────────

function RoundCard({
  event,
  round,
  isCurrent,
}: {
  event: TournamentEvent;
  round: EventRound;
  isCurrent: boolean;
}) {
  const isCompleted = round.status === 'completed';
  const isInProgress = round.status === 'in_progress';
  const isPending = round.status === 'pending';

  // Pending rounds collapse to a compact chip
  if (isPending && !isCurrent) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-[8px] bg-[#111214] border border-[#2C2E33]/30">
        <IconClock size={14} className="text-[#3C3F44]" />
        <span className="text-sm font-semibold text-[#3C3F44]" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
          Round {round.round_number}
        </span>
        <span className="text-xs text-[#2C2E33]">Pending</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[12px] border p-5 transition-all ${
        isCurrent && isInProgress
          ? 'border-[#667eea]/60 bg-[#141517]'
          : isCompleted && !isCurrent
            ? 'border-[#2C2E33]/30 bg-[#111214]'
            : 'border-[#2C2E33] bg-[#141517]'
      }`}
      style={
        isCurrent && isInProgress
          ? {
              boxShadow: '0 0 20px rgba(102,126,234,0.15), inset 0 0 0 1px rgba(102,126,234,0.1)',
              animation: 'tv-pulse-border 3s ease-in-out infinite',
            }
          : isCompleted && !isCurrent
            ? { opacity: 0.6, filter: 'saturate(0.6)' }
            : {}
      }
    >
      {/* Round Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3
            className={`text-lg font-bold ${
              isCurrent ? 'text-white' : isCompleted ? 'text-[#909296]' : 'text-[#5C5F66]'
            }`}
            style={{ fontFamily: "'Chakra Petch', sans-serif" }}
          >
            Round {round.round_number}
          </h3>
          {isInProgress && isCurrent && <LiveBadge />}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#2B8A3E]/20 text-[#51CF66]">
              Complete
            </span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#25262B] text-[#5C5F66]">
              <IconClock size={12} />
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Pods */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {round.pods.map((pod) => {
          const winner = getPodWinner(event, round, pod);
          const isPodLive = pod.match_status === 'in_progress';
          const isPodCompleted = pod.match_status === 'completed';
          const isPodPending = pod.match_status === 'pending';

          return (
            <div
              key={pod.pod_index}
              className={`rounded-[10px] border p-4 ${
                isPodLive
                  ? 'border-[#E03131]/30 bg-[#E03131]/5'
                  : isPodCompleted
                    ? 'border-[#2C2E33]/40 bg-[#0a0a10]/50'
                    : 'border-[#2C2E33] bg-[#1A1B1E]/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isCurrent && !isCompleted ? 'text-[#667eea]' : 'text-[#5C5F66]'
                  }`}
                  style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                >
                  {event.event_type === 'draft' ? `Match ${pod.pod_index + 1}` : `Pod ${pod.pod_index + 1}`}
                </span>
                {isPodLive && <LiveBadge />}
                {isPodCompleted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#2B8A3E]/20 text-[#51CF66]">
                    Complete
                  </span>
                )}
                {isPodPending && (
                  <span className="text-xs text-[#5C5F66]">Pending</span>
                )}
              </div>

              {/* Players in pod */}
              {event.event_type === 'draft' && pod.player_ids.length === 2 ? (
                <div className="flex items-center justify-center gap-4">
                  {pod.player_ids.map((pid, i) => {
                    const isThisWinner = winner?.playerId === pid;
                    const isLoser = isPodCompleted && !isThisWinner;
                    return (
                      <div key={pid} className="contents">
                        {i === 1 && <span className="text-lg text-[#5C5F66] font-bold">vs</span>}
                        <div
                          className={`flex items-center gap-3 px-4 py-3 rounded-[10px] ${
                            isThisWinner
                              ? 'bg-[rgba(255,215,0,0.12)] border border-[rgba(255,215,0,0.4)]'
                              : isLoser
                                ? 'bg-[rgba(37,38,43,0.2)] opacity-50'
                                : 'bg-[rgba(37,38,43,0.3)]'
                          }`}
                        >
                          {isThisWinner && <span className="text-xl">👑</span>}
                          <PlayerAvatar
                            playerName={findPlayerName(event, pid)}
                            customAvatar={findPlayerAvatar(event, pid)}
                            size="small"
                            className={`!w-12 !h-12 !text-lg border-2 ${isThisWinner ? 'border-[#FFD700]' : 'border-[#2C2E33]'}`}
                          />
                          <span
                            className={`text-xl font-medium ${
                              isThisWinner ? 'text-[#FFD700] font-bold' : isLoser ? 'text-[#5C5F66]' : 'text-white'
                            }`}
                            style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                          >
                            {findPlayerName(event, pid)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {pod.player_ids.map((pid) => {
                    const isWinner = winner?.playerId === pid;
                    return (
                      <PodPlayerCard
                        key={pid}
                        playerId={pid}
                        event={event}
                        round={round}
                        pod={pod}
                        isWinner={isWinner}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Round Timeline ──────────────────────────────────────────────

function RoundTimeline({ event }: { event: TournamentEvent }) {
  if (event.rounds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <IconClock size={40} className="text-[#2C2E33] mx-auto mb-3" />
          <p className="text-lg text-[#5C5F66] font-medium">Rounds not started yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5 overflow-y-auto h-full scrollbar-hide">
      {event.rounds.map((round) => (
        <RoundCard
          key={round.round_number}
          event={event}
          round={round}
          isCurrent={round.round_number === event.current_round && event.status === 'active'}
        />
      ))}
    </div>
  );
}

// ─── Footer Bar ──────────────────────────────────────────────────

function LiveFooter({ event }: { event: TournamentEvent }) {
  const inProgressPods = getInProgressPods(event);
  if (inProgressPods.length === 0) return null;

  return (
    <div
      className="flex items-center gap-4 px-6 py-3 border-t border-[#E03131]/20 overflow-x-auto"
      style={{
        background: 'linear-gradient(135deg, rgba(224,49,49,0.08) 0%, rgba(224,49,49,0.03) 100%)',
      }}
    >
      <LiveBadge className="flex-shrink-0" />
      <div className="flex items-center gap-6 flex-1 min-w-0">
        {inProgressPods.map(({ round, pod }) => (
          <div key={`r${round.round_number}-p${pod.pod_index}`} className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-[#5C5F66] font-semibold uppercase tracking-wider">
              {event.event_type === 'draft' ? `Match ${pod.pod_index + 1}` : `Pod ${pod.pod_index + 1}`}
            </span>
            <span className="text-[#2C2E33]">&mdash;</span>
            <span className="text-sm text-[#C1C2C5]">
              {pod.player_ids.map((pid) => findPlayerName(event, pid)).join(' vs ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Splash Screen (pre-start) ──────────────────────────────────

function TVSplashScreen({ event }: { event: TournamentEvent }) {
  const manaColors = ['W', 'U', 'B', 'R', 'G'];
  const manaColorMap: Record<string, string> = {
    W: 'ms-w', U: 'ms-u', B: 'ms-b', R: 'ms-r', G: 'ms-g',
  };

  return (
    <div className="min-h-screen bg-[#0a0a10] flex flex-col items-center justify-center relative overflow-hidden">
      <style>{`
        @keyframes splash-glow-text {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.85; }
        }
        @keyframes splash-mana-glow {
          0%, 100% { filter: drop-shadow(0 0 0px transparent); transform: scale(1); }
          5%  { filter: drop-shadow(0 0 8px currentColor); transform: scale(1.15); }
          10% { filter: drop-shadow(0 0 0px transparent); transform: scale(1); }
        }
      `}</style>

      {/* Event Logo / Trophy */}
      {event.custom_image ? (
        <div
          className="w-56 h-56 rounded-[24px] overflow-hidden border-2 border-[#2C2E33] mb-10"
          style={{ boxShadow: '0 0 60px rgba(102,126,234,0.2)' }}
        >
          <img src={event.custom_image} alt={event.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div
          className="w-56 h-56 rounded-[24px] bg-[#1A1B1E] border-2 border-[#2C2E33] flex items-center justify-center mb-10"
          style={{ boxShadow: '0 0 60px rgba(102,126,234,0.2)' }}
        >
          <IconTrophy size={96} className="text-[#667eea]" />
        </div>
      )}

      {/* Event Name */}
      <h1 className="text-8xl font-bold text-white mb-5 text-center px-6" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>{event.name}</h1>

      {/* Date + Player count + Rounds */}
      <div className="flex items-center gap-4 text-2xl text-[#909296] mb-16">
        <span className="flex items-center gap-2">
          <IconCalendar size={24} className="text-[#667eea]" />
          {formatEventDate(event.event_date)}
        </span>
        <span className="text-[#2C2E33]">&middot;</span>
        <span>{event.players.length} Players</span>
        <span className="text-[#2C2E33]">&middot;</span>
        <span>{event.round_count} Rounds</span>
      </div>

      {/* Mana symbols as waiting indicator */}
      <div className="flex gap-4 mb-6">
        {manaColors.map((color, i) => (
          <i
            key={color}
            className={`ms ${manaColorMap[color]} ms-cost ms-shadow`}
            style={{
              fontSize: '40px',
              animation: 'splash-mana-glow 10s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <p
        className="text-2xl text-[#5C5F66] font-medium tracking-wide"
        style={{ animation: 'splash-glow-text 2s ease-in-out infinite', fontFamily: "'Chakra Petch', sans-serif" }}
      >
        {event.event_type === 'draft' ? 'Waiting for draft to start...' : 'Waiting for tournament to start...'}
      </p>

      {/* Pod Pal branding — small, bottom */}
      <div className="absolute bottom-8 flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
        >
          <img src="/logo.png" alt="" className="w-full h-full object-contain" style={{ transform: 'scale(1.15)' }} />
        </div>
        <span
          className="text-sm font-bold tracking-wider"
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Pod Pal
        </span>
      </div>
    </div>
  );
}

// ─── Set Banner (Draft only) ────────────────────────────────────

function SetBanner({ event }: { event: TournamentEvent }) {
  if (event.event_type !== 'draft' || !event.sets || event.sets.length === 0) return null;

  const isChaos = event.sets.length > 1;

  return (
    <div
      className="flex items-center gap-3 px-6 py-2.5 border-b border-[#2C2E33]/50 overflow-x-auto scrollbar-hide"
      style={{ background: '#0d0d12' }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5C5F66] flex-shrink-0"
        style={{ fontFamily: "'Chakra Petch', sans-serif" }}
      >
        {isChaos ? 'Drafting' : 'Set'}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        {event.sets.map((s, i) => {
          const { color } = getSetColors(s.code);
          return (
            <div key={s.code} className="contents">
              {i > 0 && isChaos && (
                <span className="text-[10px] font-bold text-[#3C3F44]">&times;</span>
              )}
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
                style={{
                  background: `${color}12`,
                  border: `1px solid ${color}30`,
                }}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}25` }}
                >
                  <img src={s.icon_svg_uri} alt="" className="w-4 h-4" style={{ filter: 'invert(1)' }} />
                </div>
                <span className="text-sm font-medium text-[#C1C2C5] whitespace-nowrap">{s.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function EventLiveView() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<TournamentEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const [animationState, setAnimationState] = useState<'none' | 'shuffle' | 'reseed'>('none');
  const [previousStandings, setPreviousStandings] = useState<StandingsEntry[] | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const prevRoundRef = useRef<number>(0);

  // Track whether we've ever loaded successfully (ref avoids stale closure)
  const hasLoadedRef = useRef(false);

  // Poll every 5 seconds
  useEffect(() => {
    if (!eventId) return;

    const fetchLive = async () => {
      try {
        const data = await eventApi.getLive(eventId);

        // Detect state transitions for animation
        if (prevStatusRef.current !== null) {
          // Tournament just started
          if (prevStatusRef.current === 'setup' && data.status === 'active') {
            setAnimationState('shuffle');
          }
          // Round advanced
          else if (data.current_round > prevRoundRef.current && prevRoundRef.current > 0) {
            // Save current standings before updating for the re-seed animation
            if (event) {
              setPreviousStandings([...event.standings].sort((a, b) => b.total_points - a.total_points));
            }
            setAnimationState('reseed');
          }
        }

        prevStatusRef.current = data.status;
        prevRoundRef.current = data.current_round;
        setEvent(data);
        setError(null);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error('Live view polling error:', err);
        // Only set error if we haven't loaded data yet; keep showing stale data on subsequent errors
        if (!hasLoadedRef.current) {
          setError('Tournament not found or unavailable');
        }
      } finally {
        setInitialLoad(false);
      }
    };

    fetchLive(); // Initial fetch

    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [eventId]);

  // ─── Loading State ──────────────────────────────────────────
  if (initialLoad) {
    return (
      <div className="min-h-screen bg-[#0a0a10] flex items-center justify-center">
        <div className="text-center">
          <IconLoader2 size={48} className="animate-spin text-[#667eea] mx-auto mb-4" />
          <p className="text-lg text-[#5C5F66] font-medium">Loading tournament...</p>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────
  if (error && !event) {
    return (
      <div className="min-h-screen bg-[#0a0a10] flex items-center justify-center">
        <div className="text-center">
          <IconTrophy size={48} className="text-[#2C2E33] mx-auto mb-4" />
          <p className="text-xl text-[#5C5F66] font-medium mb-2">Tournament Not Found</p>
          <p className="text-sm text-[#3C3F44]">
            This tournament may have been removed or the link is invalid.
          </p>
          <p className="text-xs text-[#2C2E33] mt-4">Retrying automatically...</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  // Show splash screen while tournament hasn't started (and no animation playing)
  if (event.status === 'setup' && animationState === 'none') {
    return <TVSplashScreen event={event} />;
  }

  // Show full-screen animation overlay during shuffle/reseed
  if (animationState !== 'none') {
    return (
      <div className="min-h-screen bg-[#0a0a10] flex flex-col overflow-hidden">
        <LiveHeader event={event} />
        <SetBanner event={event} />
        <div className="flex-1 flex items-center justify-center">
          <TVShuffleAnimation
            event={event}
            animationType={animationState}
            previousStandings={previousStandings ?? undefined}
            onComplete={() => setAnimationState('none')}
          />
        </div>
      </div>
    );
  }

  // Build sorted standings
  const sortedStandings = [...event.standings].sort((a, b) => b.total_points - a.total_points);
  const showFooter = hasAnyInProgress(event);

  return (
    <div className="min-h-screen bg-[#0a0a10] flex flex-col overflow-hidden">
      <style>{`
        @keyframes tv-pulse-border {
          0%, 100% { box-shadow: 0 0 15px rgba(102,126,234,0.1), inset 0 0 0 1px rgba(102,126,234,0.1); }
          50% { box-shadow: 0 0 25px rgba(102,126,234,0.25), inset 0 0 0 1px rgba(102,126,234,0.25); }
        }
      `}</style>

      {/* Header */}
      <LiveHeader event={event} />
      <SetBanner event={event} />

      {/* Main Content — landscape grid on desktop, stacked on mobile */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[35%_1fr] min-h-0 overflow-hidden">
        {/* Standings Column */}
        <div
          className="border-b md:border-b-0 md:border-r border-[#2C2E33]/50 flex flex-col overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #0e0e14 0%, #0c0c12 100%)' }}
        >
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
            <StandingsPanel event={event} standings={sortedStandings} />
          </div>
          {event.event_type !== 'draft' && <ScoringRulesPanel />}
        </div>

        {/* Round Timeline */}
        <div
          className="overflow-y-auto scrollbar-hide"
          style={{ background: 'linear-gradient(180deg, #0c0c12 0%, #0a0a10 100%)' }}
        >
          <RoundTimeline event={event} />
        </div>
      </div>

      {/* Footer — shown only when matches are in progress */}
      {showFooter && <LiveFooter event={event} />}
    </div>
  );
}
