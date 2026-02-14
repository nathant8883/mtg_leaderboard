import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { eventApi } from '../services/api';
import type { TournamentEvent, EventRound, PodAssignment, StandingsEntry } from '../services/api';
import toast from 'react-hot-toast';
import PlayerAvatar from '../components/PlayerAvatar';
import {
  IconArrowLeft,
  IconTrophy,
  IconCrown,
  IconLoader2,
  IconLink,
  IconChevronDown,
  IconChevronUp,
  IconTrash,
  IconPlayerPlay,
  IconCheck,
  IconClock,
  IconUsers,
  IconSwords,
  IconSkull,
} from '@tabler/icons-react';

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

function podStatusBadge(status: PodAssignment['match_status']) {
  switch (status) {
    case 'pending':
      return {
        label: 'Waiting',
        classes: 'bg-[#25262B] text-[#909296]',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        classes: 'bg-[#E67700]/15 text-[#FFA94D] animate-pulse',
      };
    case 'completed':
      return {
        label: 'Completed',
        classes: 'bg-[#2B8A3E]/20 text-[#51CF66]',
      };
  }
}

function findPlayerName(event: TournamentEvent, playerId: string): string {
  return event.players.find((p) => p.player_id === playerId)?.player_name ?? 'Unknown';
}

function findPlayerAvatar(event: TournamentEvent, playerId: string): string | undefined {
  return event.players.find((p) => p.player_id === playerId)?.avatar;
}

/** Get the current round delta points for a player from the latest round results. */
function getRoundDelta(event: TournamentEvent, playerId: string): number | null {
  const round = event.rounds.find((r) => r.round_number === event.current_round);
  if (!round) return null;
  const result = round.results.find((r) => r.player_id === playerId);
  return result ? result.total : null;
}

/** Find the winner of a completed pod from the match results */
function getPodWinner(event: TournamentEvent, round: EventRound, pod: PodAssignment): { name: string; points: number } | null {
  if (pod.match_status !== 'completed') return null;
  // Look for the result with the highest placement_points in this round for players in this pod
  const podResults = round.results.filter((r) => pod.player_ids.includes(r.player_id));
  if (podResults.length === 0) return null;
  // The player with highest total is the winner
  const winner = podResults.reduce((best, r) => (r.total > best.total ? r : best), podResults[0]);
  return {
    name: findPlayerName(event, winner.player_id),
    points: winner.total,
  };
}

// ─── Sub-components ─────────────────────────────────────────────

function StatusBadge({ status }: { status: PodAssignment['match_status'] }) {
  const badge = podStatusBadge(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}>
      {status === 'pending' && <IconClock size={12} />}
      {status === 'in_progress' && <IconLoader2 size={12} className="animate-spin" />}
      {status === 'completed' && <IconCheck size={12} />}
      {badge.label}
    </span>
  );
}

// ─── Setup View ─────────────────────────────────────────────────

function SetupView({
  event,
  isCreator,
  onStart,
  onDelete,
  navigate,
}: {
  event: TournamentEvent;
  isCreator: boolean;
  onStart: () => void;
  onDelete: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await onStart();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          aria-label="Go back"
          className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-[#25262B] border border-[#2C2E33] text-[#909296] hover:text-white hover:border-[#667eea] transition-colors"
        >
          <IconArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{event.name}</h1>
          <p className="text-sm text-[#909296]">Tournament Setup</p>
        </div>
      </div>

      {/* Event Info Card */}
      <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] p-4 mb-4">
        {event.custom_image && (
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-[12px] overflow-hidden border border-[#2C2E33]">
              <img src={event.custom_image} alt={event.name} className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#909296]">Players</span>
          <span className="text-sm text-white font-medium">{event.players.length}</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#909296]">Rounds</span>
          <span className="text-sm text-white font-medium">{event.round_count}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#909296]">Pods per Round</span>
          <span className="text-sm text-white font-medium">{Math.ceil(event.players.length / 4)}</span>
        </div>
      </div>

      {/* Player List */}
      <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] p-4 mb-6">
        <h2 className="flex items-center gap-2 text-sm text-[#909296] mb-3">
          <IconUsers size={16} />
          Registered Players
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {event.players.map((p) => (
            <div
              key={p.player_id}
              className="flex items-center gap-2.5 p-2 rounded-[8px] bg-[#25262B] border border-[#2C2E33]"
            >
              <PlayerAvatar playerName={p.player_name} customAvatar={p.avatar} size="small" />
              <span className="text-sm text-[#C1C2C5] truncate">{p.player_name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Creator Actions */}
      {isCreator && (
        <div className="space-y-3">
          <button
            onClick={handleStart}
            disabled={starting}
            className={`w-full py-3.5 rounded-[10px] font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
              starting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.98]'
            }`}
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            {starting ? (
              <>
                <IconLoader2 size={18} className="animate-spin" />
                Starting Tournament...
              </>
            ) : (
              <>
                <IconPlayerPlay size={18} />
                Start Tournament
              </>
            )}
          </button>

          <button
            onClick={onDelete}
            className="w-full py-3 rounded-[10px] font-medium text-[#FF6B6B] bg-[#25262B] border border-[#2C2E33] hover:border-[#FF6B6B]/50 transition-colors flex items-center justify-center gap-2"
          >
            <IconTrash size={16} />
            Delete Event
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Active View ────────────────────────────────────────────────

function ActiveView({
  event,
  currentPlayerId,
  isCreator,
  onStartMatch,
  onAdvanceRound,
  onCompleteEvent,
  navigate,
}: {
  event: TournamentEvent;
  currentPlayerId: string | undefined;
  isCreator: boolean;
  onStartMatch: (podIndex: number) => void;
  onAdvanceRound: () => void;
  onCompleteEvent: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());
  const [advancing, setAdvancing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const currentRound = event.rounds.find((r) => r.round_number === event.current_round);
  const allPodsCompleted = currentRound?.pods.every((p) => p.match_status === 'completed') ?? false;
  const isLastRound = event.current_round >= event.round_count;
  const previousRounds = event.rounds.filter((r) => r.round_number < event.current_round);

  const toggleRound = (roundNum: number) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundNum)) {
        next.delete(roundNum);
      } else {
        next.add(roundNum);
      }
      return next;
    });
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await onAdvanceRound();
    } finally {
      setAdvancing(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onCompleteEvent();
    } finally {
      setCompleting(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        window.location.origin + '/event/' + event.id + '/live',
      );
      toast.success('Live link copied!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // Build sorted standings
  const sortedStandings = [...event.standings].sort((a, b) => b.total_points - a.total_points);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/')}
          aria-label="Go back"
          className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-[#25262B] border border-[#2C2E33] text-[#909296] hover:text-white hover:border-[#667eea] transition-colors"
        >
          <IconArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {event.custom_image && (
            <div className="w-10 h-10 rounded-[8px] overflow-hidden border border-[#2C2E33] flex-shrink-0">
              <img src={event.custom_image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{event.name}</h1>
            <p className="text-xs text-[#909296]">
              Round {event.current_round} of {event.round_count}
            </p>
          </div>
        </div>
        <button
          onClick={handleCopyLink}
          aria-label="Copy live link"
          className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-[#25262B] border border-[#2C2E33] text-[#909296] hover:text-[#667eea] hover:border-[#667eea] transition-colors"
        >
          <IconLink size={18} />
        </button>
      </div>

      {/* Standings Table */}
      <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2C2E33]">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <IconTrophy size={16} className="text-[#FFD700]" />
            Standings
          </h2>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[2rem_1fr_3rem_2.5rem_2.5rem] items-center px-4 py-2 text-xs text-[#5C5F66] border-b border-[#2C2E33]/50">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Pts</span>
          <span className="text-right">W</span>
          <span className="text-right">K</span>
        </div>

        {/* Table Rows */}
        {sortedStandings.map((entry, idx) => {
          const rank = idx + 1;
          const isCurrentUser = entry.player_id === currentPlayerId;
          const delta = getRoundDelta(event, entry.player_id);
          const medal = rankMedal(rank);

          return (
            <div
              key={entry.player_id}
              className={`grid grid-cols-[2rem_1fr_3rem_2.5rem_2.5rem] items-center px-4 py-2.5 border-b border-[#2C2E33]/30 last:border-b-0 ${
                isCurrentUser ? 'bg-[#667eea]/10 border-l-2 border-l-[#667eea]' : ''
              }`}
            >
              <span className={`text-sm font-semibold ${rankColor(rank)}`}>
                {medal ?? rank}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <PlayerAvatar
                  playerName={entry.player_name}
                  customAvatar={findPlayerAvatar(event, entry.player_id)}
                  size="small"
                  className="!w-7 !h-7 !text-xs"
                />
                <span className={`text-sm truncate ${isCurrentUser ? 'text-white font-medium' : 'text-[#C1C2C5]'}`}>
                  {entry.player_name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-white">{entry.total_points}</span>
                {delta !== null && delta > 0 && (
                  <span className="text-[10px] text-[#51CF66] ml-0.5">+{delta}</span>
                )}
              </div>
              <span className="text-sm text-right text-[#C1C2C5]">{entry.wins}</span>
              <span className="text-sm text-right text-[#C1C2C5]">{entry.kills}</span>
            </div>
          );
        })}

        {sortedStandings.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-[#5C5F66]">
            No standings yet
          </div>
        )}
      </div>

      {/* Current Round Pods */}
      {currentRound && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <IconSwords size={16} className="text-[#667eea]" />
            Round {event.current_round} Pods
          </h2>

          <div className="space-y-3">
            {currentRound.pods.map((pod) => {
              const isUserInPod = currentPlayerId ? pod.player_ids.includes(currentPlayerId) : false;
              const canStart = pod.match_status === 'pending' && isUserInPod;
              const winner = getPodWinner(event, currentRound, pod);

              return (
                <div
                  key={pod.pod_index}
                  className={`bg-[#1A1B1E] rounded-[12px] border p-4 transition-colors ${
                    isUserInPod
                      ? 'border-[#667eea]/40 shadow-[0_0_12px_rgba(102,126,234,0.08)]'
                      : 'border-[#2C2E33]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[#909296] uppercase tracking-wider">
                      Pod {pod.pod_index + 1}
                    </span>
                    <StatusBadge status={pod.match_status} />
                  </div>

                  {/* Player list */}
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {pod.player_ids.map((pid) => (
                      <div key={pid} className="flex items-center gap-2 min-w-0">
                        <PlayerAvatar
                          playerName={findPlayerName(event, pid)}
                          customAvatar={findPlayerAvatar(event, pid)}
                          size="small"
                          className="!w-6 !h-6 !text-[10px]"
                        />
                        <span
                          className={`text-xs truncate ${
                            pid === currentPlayerId ? 'text-white font-medium' : 'text-[#C1C2C5]'
                          }`}
                        >
                          {findPlayerName(event, pid)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Winner info for completed pods */}
                  {winner && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#2B8A3E]/10 border border-[#2B8A3E]/20 mb-3">
                      <IconCrown size={14} className="text-[#FFD700]" />
                      <span className="text-xs text-[#51CF66] font-medium">{winner.name}</span>
                      <span className="text-xs text-[#51CF66]/60 ml-auto">+{winner.points} pts</span>
                    </div>
                  )}

                  {/* Start Match button */}
                  {canStart && (
                    <button
                      onClick={() => onStartMatch(pod.pod_index)}
                      className="w-full py-2.5 rounded-[8px] font-medium text-white text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
                      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                    >
                      <IconPlayerPlay size={16} />
                      Start Match
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin Actions */}
      {isCreator && (
        <div className="mb-4 space-y-3">
          {allPodsCompleted && !isLastRound && (
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className={`w-full py-3 rounded-[10px] font-semibold text-white flex items-center justify-center gap-2 transition-all ${
                advancing ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.98]'
              }`}
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              {advancing ? (
                <>
                  <IconLoader2 size={18} className="animate-spin" />
                  Advancing...
                </>
              ) : (
                <>
                  <IconPlayerPlay size={18} />
                  Next Round
                </>
              )}
            </button>
          )}

          {allPodsCompleted && isLastRound && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className={`w-full py-3 rounded-[10px] font-semibold text-white flex items-center justify-center gap-2 transition-all ${
                completing ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.98]'
              }`}
              style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' }}
            >
              {completing ? (
                <>
                  <IconLoader2 size={18} className="animate-spin" />
                  Finishing...
                </>
              ) : (
                <>
                  <IconTrophy size={18} />
                  Close Event
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Previous Rounds (Collapsible) */}
      {previousRounds.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#909296] mb-3">Previous Rounds</h2>
          <div className="space-y-2">
            {previousRounds.map((round) => {
              const isExpanded = expandedRounds.has(round.round_number);
              return (
                <div
                  key={round.round_number}
                  className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] overflow-hidden"
                >
                  <button
                    onClick={() => toggleRound(round.round_number)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#25262B]/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-[#C1C2C5]">
                      Round {round.round_number}
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={round.status} />
                      {isExpanded ? (
                        <IconChevronUp size={16} className="text-[#909296]" />
                      ) : (
                        <IconChevronDown size={16} className="text-[#909296]" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-[#2C2E33]/50">
                      {round.pods.map((pod) => {
                        const winner = getPodWinner(event, round, pod);
                        return (
                          <div
                            key={pod.pod_index}
                            className="mt-3 p-3 rounded-[8px] bg-[#25262B]/50 border border-[#2C2E33]/50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-[#5C5F66] uppercase tracking-wider">
                                Pod {pod.pod_index + 1}
                              </span>
                              {winner && (
                                <div className="flex items-center gap-1">
                                  <IconCrown size={12} className="text-[#FFD700]" />
                                  <span className="text-xs text-[#FFD700]">{winner.name}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {pod.player_ids.map((pid) => {
                                const result = round.results.find((r) => r.player_id === pid);
                                return (
                                  <div key={pid} className="flex items-center gap-1.5">
                                    <span className="text-xs text-[#C1C2C5]">
                                      {findPlayerName(event, pid)}
                                    </span>
                                    {result && (
                                      <span className="text-[10px] text-[#51CF66] font-medium">
                                        +{result.total}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Completed View ─────────────────────────────────────────────

function CompletedView({
  event,
  currentPlayerId,
  navigate,
}: {
  event: TournamentEvent;
  currentPlayerId: string | undefined;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const sortedStandings = [...event.standings].sort((a, b) => b.total_points - a.total_points);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());

  const toggleRound = (roundNum: number) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundNum)) {
        next.delete(roundNum);
      } else {
        next.add(roundNum);
      }
      return next;
    });
  };

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          aria-label="Go back"
          className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-[#25262B] border border-[#2C2E33] text-[#909296] hover:text-white hover:border-[#667eea] transition-colors"
        >
          <IconArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {event.custom_image && (
            <div className="w-10 h-10 rounded-[8px] overflow-hidden border border-[#2C2E33] flex-shrink-0">
              <img src={event.custom_image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{event.name}</h1>
            <p className="text-xs text-[#909296] flex items-center gap-1">
              <IconTrophy size={12} className="text-[#FFD700]" />
              Tournament Complete
            </p>
          </div>
        </div>
      </div>

      {/* Champion Banner */}
      {sortedStandings.length > 0 && (
        <div
          className="rounded-[12px] p-5 mb-4 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,165,0,0.1) 100%)',
            border: '1px solid rgba(255,215,0,0.3)',
          }}
        >
          <div className="relative z-10">
            <IconTrophy size={36} className="text-[#FFD700] mx-auto mb-2" />
            <p className="text-xs text-[#FFD700]/70 uppercase tracking-widest font-semibold mb-1">
              Champion
            </p>
            <div className="flex items-center justify-center gap-3 mb-1">
              <PlayerAvatar
                playerName={sortedStandings[0].player_name}
                customAvatar={findPlayerAvatar(event, sortedStandings[0].player_id)}
                size="small"
              />
              <span className="text-xl font-bold text-[#FFD700]">
                {sortedStandings[0].player_name}
              </span>
            </div>
            <p className="text-sm text-[#FFD700]/60">
              {sortedStandings[0].total_points} points &middot; {sortedStandings[0].wins}W &middot; {sortedStandings[0].kills}K
            </p>
          </div>
        </div>
      )}

      {/* Final Standings Table */}
      <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2C2E33]">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <IconCrown size={16} className="text-[#FFD700]" />
            Final Standings
          </h2>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[2rem_1fr_3rem_2.5rem_2.5rem] items-center px-4 py-2 text-xs text-[#5C5F66] border-b border-[#2C2E33]/50">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Pts</span>
          <span className="text-right">W</span>
          <span className="text-right">K</span>
        </div>

        {sortedStandings.map((entry, idx) => {
          const rank = idx + 1;
          const isCurrentUser = entry.player_id === currentPlayerId;
          const medal = rankMedal(rank);

          return (
            <div
              key={entry.player_id}
              className={`grid grid-cols-[2rem_1fr_3rem_2.5rem_2.5rem] items-center px-4 py-3 border-b border-[#2C2E33]/30 last:border-b-0 ${
                rank === 1
                  ? 'bg-[#FFD700]/5'
                  : isCurrentUser
                    ? 'bg-[#667eea]/10 border-l-2 border-l-[#667eea]'
                    : ''
              }`}
            >
              <span className={`text-sm font-bold ${rankColor(rank)}`}>
                {medal ?? rank}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <PlayerAvatar
                  playerName={entry.player_name}
                  customAvatar={findPlayerAvatar(event, entry.player_id)}
                  size="small"
                  className="!w-7 !h-7 !text-xs"
                />
                <span
                  className={`text-sm truncate ${
                    rank === 1 ? 'text-[#FFD700] font-bold' : isCurrentUser ? 'text-white font-medium' : 'text-[#C1C2C5]'
                  }`}
                >
                  {entry.player_name}
                </span>
              </div>
              <span className={`text-sm font-bold text-right ${rank === 1 ? 'text-[#FFD700]' : 'text-white'}`}>
                {entry.total_points}
              </span>
              <span className="text-sm text-right text-[#C1C2C5]">{entry.wins}</span>
              <span className="text-sm text-right text-[#C1C2C5]">{entry.kills}</span>
            </div>
          );
        })}
      </div>

      {/* Round-by-Round Breakdown */}
      {event.rounds.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#909296] mb-3">Round-by-Round Breakdown</h2>
          <div className="space-y-2">
            {event.rounds.map((round) => {
              const isExpanded = expandedRounds.has(round.round_number);
              return (
                <div
                  key={round.round_number}
                  className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] overflow-hidden"
                >
                  <button
                    onClick={() => toggleRound(round.round_number)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#25262B]/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-[#C1C2C5]">
                      Round {round.round_number}
                    </span>
                    {isExpanded ? (
                      <IconChevronUp size={16} className="text-[#909296]" />
                    ) : (
                      <IconChevronDown size={16} className="text-[#909296]" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-[#2C2E33]/50">
                      {round.pods.map((pod) => {
                        const winner = getPodWinner(event, round, pod);
                        return (
                          <div
                            key={pod.pod_index}
                            className="mt-3 p-3 rounded-[8px] bg-[#25262B]/50 border border-[#2C2E33]/50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-[#5C5F66] uppercase tracking-wider">
                                Pod {pod.pod_index + 1}
                              </span>
                              {winner && (
                                <div className="flex items-center gap-1">
                                  <IconCrown size={12} className="text-[#FFD700]" />
                                  <span className="text-xs text-[#FFD700]">{winner.name}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {pod.player_ids.map((pid) => {
                                const result = round.results.find((r) => r.player_id === pid);
                                return (
                                  <div key={pid} className="flex items-center gap-1.5">
                                    <span className="text-xs text-[#C1C2C5]">
                                      {findPlayerName(event, pid)}
                                    </span>
                                    {result && (
                                      <span className="text-[10px] text-[#51CF66] font-medium">
                                        +{result.total}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Back to Dashboard */}
      <button
        onClick={() => navigate('/')}
        className="w-full py-3 rounded-[10px] font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        <IconArrowLeft size={16} />
        Back to Dashboard
      </button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function EventDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { currentPlayer } = useAuth();

  const [event, setEvent] = useState<TournamentEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPlayerId = currentPlayer?.id;
  const isCreator = event?.creator_id === currentPlayerId;

  // Fetch event data
  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await eventApi.getById(eventId);
      setEvent(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching event:', err);
      const message = err?.response?.data?.detail || 'Failed to load event';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Polling: refresh every 5s when any pod in the current round is in_progress
  useEffect(() => {
    if (!event || event.status !== 'active') return;

    const currentRound = event.rounds.find((r) => r.round_number === event.current_round);
    const hasInProgress = currentRound?.pods.some((p) => p.match_status === 'in_progress');

    if (!hasInProgress) return;

    const interval = setInterval(async () => {
      try {
        const updated = await eventApi.getById(event.id);
        setEvent(updated);
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [event?.id, event?.status, event?.current_round, event?.rounds]);

  // ─── Handlers ──────────────────────────────────────────────

  const handleStartTournament = async () => {
    if (!event) return;
    try {
      const updated = await eventApi.start(event.id);
      setEvent(updated);
      toast.success('Tournament started!');
    } catch (err: any) {
      console.error('Error starting tournament:', err);
      toast.error(err?.response?.data?.detail || 'Failed to start tournament');
    }
  };

  const handleDeleteEvent = async () => {
    if (!event) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${event.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await eventApi.delete(event.id);
      toast.success('Event deleted');
      navigate('/');
    } catch (err: any) {
      console.error('Error deleting event:', err);
      toast.error(err?.response?.data?.detail || 'Failed to delete event');
    }
  };

  const handleStartMatch = async (podIndex: number) => {
    if (!event) return;
    try {
      await eventApi.startMatch(event.id, event.current_round, podIndex);
      navigate(`/event/${event.id}/match/${podIndex}`);
    } catch (err: any) {
      console.error('Error starting match:', err);
      toast.error(err?.response?.data?.detail || 'Failed to start match');
    }
  };

  const handleAdvanceRound = async () => {
    if (!event) return;
    try {
      const updated = await eventApi.advanceRound(event.id);
      setEvent(updated);
      toast.success(`Round ${updated.current_round} started!`);
    } catch (err: any) {
      console.error('Error advancing round:', err);
      toast.error(err?.response?.data?.detail || 'Failed to advance round');
    }
  };

  const handleCompleteEvent = async () => {
    if (!event) return;
    try {
      const updated = await eventApi.complete(event.id);
      setEvent(updated);
      toast.success('Tournament complete!');
    } catch (err: any) {
      console.error('Error completing event:', err);
      toast.error(err?.response?.data?.detail || 'Failed to complete event');
    }
  };

  // ─── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <IconLoader2 size={32} className="animate-spin text-[#667eea]" />
        <p className="text-sm text-[#909296]">Loading event...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-[#FF6B6B] text-sm">{error || 'Event not found'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-[8px] bg-[#25262B] border border-[#2C2E33] text-[#909296] hover:text-white hover:border-[#667eea] transition-colors text-sm"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  switch (event.status) {
    case 'setup':
      return (
        <SetupView
          event={event}
          isCreator={isCreator}
          onStart={handleStartTournament}
          onDelete={handleDeleteEvent}
          navigate={navigate}
        />
      );
    case 'active':
      return (
        <ActiveView
          event={event}
          currentPlayerId={currentPlayerId}
          isCreator={isCreator}
          onStartMatch={handleStartMatch}
          onAdvanceRound={handleAdvanceRound}
          onCompleteEvent={handleCompleteEvent}
          navigate={navigate}
        />
      );
    case 'completed':
      return (
        <CompletedView
          event={event}
          currentPlayerId={currentPlayerId}
          navigate={navigate}
        />
      );
    default:
      return null;
  }
}
