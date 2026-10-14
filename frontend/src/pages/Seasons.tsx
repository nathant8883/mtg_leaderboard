import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerAvatar from '../components/PlayerAvatar';
import ColorPips from '../components/ColorPips';
import { NoPodPlaceholder } from '../components/NoPodPlaceholder';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import { useSeason } from '../contexts/SeasonContext';
import {
  seasonApi,
  type HallOfFameSeason,
  type SeasonAward,
  type SeasonStandings,
} from '../services/api';
import { getSeasonBadgeStyle } from '../utils/seasonBadges';

const PODIUM_ORDER = [2, 1, 3]; // Visual order: 2nd, 1st, 3rd

function PodiumSpot({ award, onClick }: { award: SeasonAward; onClick: () => void }) {
  const style = getSeasonBadgeStyle(award);
  const isFirst = award.placement === 1;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 min-w-0 flex-1 bg-transparent border-none p-0 cursor-pointer ${isFirst ? '' : 'mt-4'}`}
    >
      <span className={isFirst ? 'text-2xl' : 'text-lg'} aria-hidden>{style.emoji}</span>
      <div className="rounded-full p-[3px]" style={{ background: style.color, boxShadow: `0 0 12px ${style.glow}` }}>
        <PlayerAvatar
          playerName={award.player_name}
          customAvatar={award.player_custom_avatar ?? undefined}
          picture={award.player_picture ?? undefined}
          size={isFirst ? 'large' : 'medium'}
        />
      </div>
      <div className="text-white font-semibold text-sm truncate max-w-full">{award.player_name}</div>
      <div className="text-[11px] text-[#909296]">
        {award.stats.elo ?? '-'} Elo · {award.stats.wins ?? 0}W
      </div>
    </button>
  );
}

function DeckRow({ award }: { award: SeasonAward }) {
  const style = getSeasonBadgeStyle(award);
  return (
    <div className="flex items-center gap-3 p-2 rounded-[10px] bg-[#25262B]">
      <div
        className="w-10 h-10 rounded-full overflow-hidden border-[3px] flex-shrink-0 bg-[#141517] flex items-center justify-center"
        style={{ borderColor: style.color }}
      >
        {award.commander_image_url
          ? <img src={award.commander_image_url} alt="" className="w-full h-full object-cover" />
          : <span aria-hidden>{style.emoji}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-semibold truncate">{award.deck_name}</div>
        <div className="text-[11px] text-[#909296] truncate">by {award.player_name}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-bold" style={{ color: style.color }}>#{award.placement}</div>
        <div className="text-[11px] text-[#909296]">{award.stats.win_rate ?? 0}%</div>
      </div>
      {award.colors.length > 0 && <div className="hidden sm:block"><ColorPips colors={award.colors} /></div>}
    </div>
  );
}

function SeasonCard({ entry, onPlayerClick }: { entry: HallOfFameSeason; onPlayerClick: (id: string) => void }) {
  const players = entry.awards.filter(a => a.award_type === 'player_placement');
  const decks = entry.awards.filter(a => a.award_type === 'deck_placement').sort((a, b) => a.placement - b.placement);
  const peak = entry.awards.find(a => a.award_type === 'peak_elo');

  return (
    <div className="bg-gradient-card border border-[#2C2E33] rounded-[16px] p-4 md:p-6">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h2 className="text-white text-xl font-bold m-0">{entry.season.label}</h2>
        <span className="text-[#909296] text-sm">{entry.season.quarter_label}</span>
      </div>

      {players.length === 0 ? (
        <p className="text-[#909296] text-sm text-center py-6 m-0">No ranked players</p>
      ) : (
        <div className="flex items-start justify-center gap-2 mb-5">
          {PODIUM_ORDER.map(place => {
            const award = players.find(a => a.placement === place);
            return award
              ? <PodiumSpot key={place} award={award} onClick={() => onPlayerClick(award.player_id)} />
              : <div key={place} className="flex-1" />;
          })}
        </div>
      )}

      {peak && (
        <button
          type="button"
          onClick={() => onPlayerClick(peak.player_id)}
          className="w-full flex items-center justify-between gap-3 p-2 px-3 mb-4 rounded-[10px] border border-[rgba(167,139,250,0.3)] bg-[rgba(167,139,250,0.08)] cursor-pointer text-left"
        >
          <span className="text-sm text-[#C1C2C5]">⚡ Peak Elo: <span className="text-white font-semibold">{peak.player_name}</span></span>
          <span className="text-sm font-bold text-[#a78bfa]">{peak.stats.peak_elo}</span>
        </button>
      )}

      {decks.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[#909296] font-semibold mb-2">Top Decks</div>
          <div className="flex flex-col gap-2">
            {decks.map(d => <DeckRow key={d.id} award={d} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveStandingsCard({ standings, onPlayerClick }: { standings: SeasonStandings; onPlayerClick: (id: string) => void }) {
  const { season } = standings;
  return (
    <div className="bg-gradient-card border border-[rgba(102,126,234,0.4)] rounded-[16px] p-4 md:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-white text-xl font-bold m-0">{season.label}</h2>
        <span className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full bg-[rgba(51,217,178,0.15)] text-[#33D9B2]">
          Live
        </span>
      </div>

      {standings.players.length === 0 ? (
        <p className="text-[#909296] text-sm text-center py-4 m-0">No ranked players yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {standings.players.map((p, i) => (
            <button
              key={p.player_id}
              type="button"
              onClick={() => onPlayerClick(p.player_id)}
              className="flex items-center gap-3 p-2 rounded-[10px] bg-[#25262B] border-none cursor-pointer text-left"
            >
              <span className="w-6 text-center font-bold text-[#909296]">{i + 1}</span>
              <PlayerAvatar playerName={p.player_name} customAvatar={p.custom_avatar} picture={p.picture} size="small" />
              <span className="flex-1 min-w-0 text-white text-sm font-semibold truncate">{p.player_name}</span>
              <span className="text-sm font-bold text-[#667eea]">{p.elo ?? '-'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Hall of Fame: current season's live top 3 plus every finished season's podium and top decks. */
export function Seasons() {
  const navigate = useNavigate();
  const { currentPlayer, isGuest } = useAuth();
  const { currentPod, loading: podLoading } = usePod();
  const { currentSeason } = useSeason();
  const [history, setHistory] = useState<HallOfFameSeason[]>([]);
  const [live, setLive] = useState<SeasonStandings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [hof, standings] = await Promise.all([
          seasonApi.getHallOfFame(),
          currentSeason ? seasonApi.getStandings(currentSeason.number) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setHistory(hof);
          setLive(standings);
        }
      } catch (err) {
        console.error('Error loading hall of fame:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentPod?.id, currentSeason?.number]);

  if (!isGuest && currentPlayer && !currentPod && !podLoading) {
    return <NoPodPlaceholder />;
  }

  const goToPlayer = (id: string) => navigate(`/players/${id}`);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mt-0 mb-4">👑 Hall of Fame</h1>

      {loading ? (
        <div className="text-center py-16">
          <div className="loading-spinner mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {live && <LiveStandingsCard standings={live} onPlayerClick={goToPlayer} />}
          {history.map(entry => (
            <SeasonCard key={entry.season.number} entry={entry} onPlayerClick={goToPlayer} />
          ))}
          {!live && history.length === 0 && (
            <p className="text-[#909296] text-center py-10 md:col-span-2">
              Season 1 starts October 1, 2026.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
