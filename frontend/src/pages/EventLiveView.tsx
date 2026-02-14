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
  IconScale,
} from '@tabler/icons-react';
import { TVShuffleAnimation } from '../components/events/TVShuffleAnimation';
import ColorPips from '../components/ColorPips';
import { getColorIdentityStyle } from '../utils/manaColors';

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

// ─── Header ──────────────────────────────────────────────────────

function LiveHeader({ event }: { event: TournamentEvent }) {
  const isActive = event.status === 'active';
  const isCompleted = event.status === 'completed';

  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-[#2C2E33] bg-[#111214]">
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
        <h1 className="text-2xl font-bold text-white truncate">{event.name}</h1>
        <div className="flex items-center gap-3 text-sm text-[#909296]">
          <span className="flex items-center gap-1.5">
            <IconCalendar size={14} />
            {formatEventDate(event.event_date)}
          </span>
          <span className="text-[#2C2E33]">|</span>
          <span>{event.players.length} Players</span>
        </div>
      </div>

      {/* Round Indicator + Status */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          {isCompleted ? (
            <span className="text-lg font-bold text-[#FFD700]">Completed</span>
          ) : (
            <span className="text-lg font-bold text-white">
              Round {event.current_round} <span className="text-[#5C5F66] font-normal">of</span> {event.round_count}
            </span>
          )}
        </div>
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
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <IconTrophy size={20} className="text-[#FFD700]" />
            Standings
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <IconSwords size={40} className="text-[#2C2E33] mx-auto mb-3" />
            <p className="text-lg text-[#5C5F66] font-medium">Tournament Starting...</p>
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
          <p className="text-xs text-[#FFD700]/70 uppercase tracking-[0.2em] font-bold mb-1">Champion</p>
          <p className="text-2xl font-bold text-[#FFD700]">{standings[0].player_name}</p>
          <p className="text-sm text-[#FFD700]/50 mt-1">
            {standings[0].total_points} pts &middot; {standings[0].wins}W &middot; {standings[0].kills}K
          </p>
        </div>
      )}

      <div className="px-5 py-4 border-b border-[#2C2E33]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          {isCompleted ? (
            <IconCrown size={20} className="text-[#FFD700]" />
          ) : (
            <IconTrophy size={20} className="text-[#FFD700]" />
          )}
          {isCompleted ? 'Final Standings' : 'Standings'}
        </h2>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[2.5rem_1fr_4rem_3rem_3rem] items-center px-5 py-2.5 text-xs text-[#5C5F66] border-b border-[#2C2E33]/50 uppercase tracking-wider font-semibold">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Pts</span>
        <span className="text-right">W</span>
        <span className="text-right">K</span>
      </div>

      {/* Table Rows */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {standings.map((entry, idx) => {
          const rank = idx + 1;
          const medal = rankMedal(rank);
          const delta = latestCompletedRound
            ? getRoundDelta(event, latestCompletedRound.round_number, entry.player_id)
            : null;
          const isChampion = isCompleted && rank === 1;

          return (
            <div
              key={entry.player_id}
              className={`grid grid-cols-[2.5rem_1fr_4rem_3rem_3rem] items-center px-5 py-3 border-b border-[#2C2E33]/20 last:border-b-0 transition-colors ${
                isChampion ? 'bg-[#FFD700]/5' : ''
              }`}
            >
              <span className={`text-base font-bold ${rankColor(rank)}`}>
                {medal ?? rank}
              </span>
              <span
                className={`text-base truncate ${
                  isChampion
                    ? 'text-[#FFD700] font-bold'
                    : rank <= 3
                      ? 'text-white font-semibold'
                      : 'text-[#C1C2C5]'
                }`}
              >
                {entry.player_name}
              </span>
              <div className="text-right">
                <span className={`text-base font-bold ${isChampion ? 'text-[#FFD700]' : 'text-white'}`}>
                  {entry.total_points}
                </span>
                {delta !== null && delta > 0 && (
                  <span className="text-xs text-[#51CF66] ml-1">+{delta}</span>
                )}
              </div>
              <span className="text-base text-right text-[#C1C2C5]">{entry.wins}</span>
              <span className="text-base text-right text-[#C1C2C5]">{entry.kills}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scoring Rules ──────────────────────────────────────────────

function ScoringRulesPanel() {
  return (
    <div className="border-t border-[#2C2E33] px-5 py-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
        <IconScale size={16} className="text-[#667eea]" />
        Scoring
      </h3>

      {/* Placement */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-[#667eea] uppercase tracking-wider mb-1.5">Placement</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            ['1st', '3'],
            ['2nd', '2'],
            ['3rd', '1'],
            ['4th', '0'],
          ].map(([label, pts]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-[#909296]">{label}</span>
              <span className="text-xs font-bold text-white">{pts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bonuses */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-[#667eea] uppercase tracking-wider mb-1.5">Bonuses</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#909296]">Kill</span>
            <span className="text-xs font-bold text-[#51CF66]">+1</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#909296]">Alt Win</span>
            <span className="text-xs font-bold text-[#51CF66]">+4</span>
          </div>
        </div>
      </div>

      {/* Penalties */}
      <div>
        <p className="text-[10px] font-semibold text-[#667eea] uppercase tracking-wider mb-1.5">Penalties</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#909296]">Scoop</span>
          <span className="text-xs font-bold text-[#E03131]">−1</span>
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
  const playerName = findPlayerName(event, playerId);
  const deckInfo: PlayerDeckInfo | undefined = pod.player_decks[playerId];
  const result = round.results.find((r) => r.player_id === playerId);
  const hasDeck = deckInfo && deckInfo.deck_name;
  const isPodCompleted = pod.match_status === 'completed';

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-[8px] transition-all duration-300 ${
        isWinner
          ? 'bg-[rgba(255,215,0,0.08)] border-l-[3px] border-[rgba(255,165,0,0.5)]'
          : 'bg-[rgba(37,38,43,0.3)]'
      }`}
    >
      {/* Commander artwork or placeholder */}
      <div className="flex-shrink-0">
        {hasDeck && deckInfo.commander_image_url ? (
          <div
            className="deck-color-border-wrapper p-[2px] rounded-[8px]"
            style={getColorIdentityStyle(deckInfo.colors || [])}
          >
            <div className="w-[40px] h-[40px] rounded-[6px] overflow-hidden">
              <img
                src={deckInfo.commander_image_url}
                alt=""
                className="w-full h-full object-cover object-[center_20%]"
              />
            </div>
          </div>
        ) : (
          <div className="w-[44px] h-[44px] rounded-[8px] bg-[#25262B] border border-[#2C2E33] flex items-center justify-center">
            <span className="text-[#3C3F44] text-lg">?</span>
          </div>
        )}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isWinner && <IconCrown size={13} className="text-[#FFD700] flex-shrink-0" />}
          <span
            className={`text-sm truncate ${
              isWinner ? 'text-[#FFD700] font-bold' : isPodCompleted ? 'text-[#909296] font-medium' : 'text-white font-medium'
            }`}
          >
            {playerName}
          </span>
        </div>
        {hasDeck ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-[#909296] truncate">{deckInfo.deck_name}</span>
            {deckInfo.colors && deckInfo.colors.length > 0 && (
              <div className="flex-shrink-0">
                <ColorPips colors={deckInfo.colors} size={10} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-[#3C3F44] italic mt-0.5 block">Selecting deck...</span>
        )}
      </div>

      {/* Points */}
      {result && (
        <span
          className={`text-xs font-bold flex-shrink-0 ${
            isWinner ? 'text-[#FFD700]' : 'text-[#51CF66]/70'
          }`}
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

  return (
    <div
      className={`rounded-[12px] border p-5 transition-all ${
        isCurrent
          ? 'border-[#667eea]/50 bg-[#141517] shadow-[0_0_20px_rgba(102,126,234,0.1)]'
          : isCompleted
            ? 'border-[#2C2E33]/50 bg-[#111214]'
            : 'border-[#2C2E33] bg-[#141517]'
      }`}
    >
      {/* Round Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3
            className={`text-lg font-bold ${
              isCurrent ? 'text-white' : isCompleted ? 'text-[#909296]' : 'text-[#5C5F66]'
            }`}
          >
            Round {round.round_number}
          </h3>
          {isInProgress && isCurrent && <LiveBadge />}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#2B8A3E]/20 text-[#51CF66]">
              Complete
            </span>
          )}
          {round.status === 'pending' && (
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
                    ? 'border-[#2C2E33]/40 bg-[#0D0E10]/50'
                    : 'border-[#2C2E33] bg-[#1A1B1E]/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isCurrent && !isCompleted ? 'text-[#667eea]' : 'text-[#5C5F66]'
                  }`}
                >
                  Pod {pod.pod_index + 1}
                </span>
                {isPodLive && <LiveBadge />}
                {isPodPending && (
                  <span className="text-xs text-[#5C5F66]">Pending</span>
                )}
              </div>

              {/* Players in pod */}
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
              Pod {pod.pod_index + 1}
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
      <div className="min-h-screen bg-[#0D0E10] flex items-center justify-center">
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
      <div className="min-h-screen bg-[#0D0E10] flex items-center justify-center">
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

  // Build sorted standings
  const sortedStandings = [...event.standings].sort((a, b) => b.total_points - a.total_points);
  const showFooter = hasAnyInProgress(event);

  return (
    <div className="min-h-screen bg-[#0D0E10] flex flex-col overflow-hidden">
      {/* Header */}
      <LiveHeader event={event} />

      {/* Main Content — landscape grid on desktop, stacked on mobile */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[35%_1fr] min-h-0 overflow-hidden">
        {/* Standings Column */}
        <div className="border-b md:border-b-0 md:border-r border-[#2C2E33] bg-[#111214] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
            <StandingsPanel event={event} standings={sortedStandings} />
          </div>
          <ScoringRulesPanel />
        </div>

        {/* Round Timeline / Animation */}
        <div className="overflow-y-auto scrollbar-hide">
          {animationState !== 'none' ? (
            <TVShuffleAnimation
              event={event}
              animationType={animationState}
              previousStandings={previousStandings ?? undefined}
              onComplete={() => setAnimationState('none')}
            />
          ) : (
            <RoundTimeline event={event} />
          )}
        </div>
      </div>

      {/* Footer — shown only when matches are in progress */}
      {showFooter && <LiveFooter event={event} />}
    </div>
  );
}
