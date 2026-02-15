from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
import random

from app.models.event import Event, EventPlayer, PlayerDeckInfo, PodAssignment, Round, RoundResult, StandingsEntry, DraftSet, DraftDeck
from app.services.scryfall import scryfall_service
from app.models.match import Match
from app.models.player import Player, Deck
from app.models.pod import Pod
from app.middleware.auth import get_current_player

router = APIRouter()


# ==================== REQUEST MODELS ====================

class CreateEventRequest(BaseModel):
    """Request body for creating an event"""
    name: str
    pod_id: str
    player_ids: list[str]
    round_count: int
    event_date: Optional[date] = None
    custom_image: Optional[str] = None
    event_type: str = "tournament"  # "tournament" | "draft"
    game_mode: Optional[str] = None  # "commander" | "limited" (required for draft)
    set_codes: list[str] = Field(default_factory=list)  # Up to 4 set codes


class CompleteMatchRequest(BaseModel):
    """Request body for completing a match within an event"""
    match_id: str
    is_alt_win: bool = False


class SetDeckRequest(BaseModel):
    player_id: str
    deck_id: str


# ==================== HELPERS ====================

def serialize_event(event: Event) -> dict:
    """Serialize an Event document for API response"""
    return {
        "id": str(event.id),
        "name": event.name,
        "event_type": event.event_type,
        "pod_id": event.pod_id,
        "creator_id": event.creator_id,
        "custom_image": event.custom_image,
        "game_mode": event.game_mode,
        "sets": [
            {"code": s.code, "name": s.name, "icon_svg_uri": s.icon_svg_uri}
            for s in event.sets
        ],
        "draft_decks": [
            {
                "player_id": dd.player_id,
                "name": dd.name,
                "colors": dd.colors,
                "commander": dd.commander,
                "commander_image_url": dd.commander_image_url,
            }
            for dd in event.draft_decks
        ],
        "player_count": event.player_count,
        "round_count": event.round_count,
        "players": [
            {
                "player_id": p.player_id,
                "player_name": p.player_name,
                "avatar": p.avatar,
            }
            for p in event.players
        ],
        "status": event.status,
        "current_round": event.current_round,
        "rounds": [
            {
                "round_number": r.round_number,
                "pods": [
                    {
                        "pod_index": pa.pod_index,
                        "player_ids": pa.player_ids,
                        "match_id": pa.match_id,
                        "match_status": pa.match_status,
                        "player_decks": {
                            pid: {
                                "deck_name": info.deck_name,
                                "commander_image_url": info.commander_image_url,
                                "colors": info.colors,
                            } if isinstance(info, PlayerDeckInfo) else {"deck_name": info, "commander_image_url": "", "colors": []}
                            for pid, info in pa.player_decks.items()
                        },
                    }
                    for pa in r.pods
                ],
                "results": [
                    {
                        "player_id": rr.player_id,
                        "placement_points": rr.placement_points,
                        "kill_points": rr.kill_points,
                        "alt_win_points": rr.alt_win_points,
                        "scoop_penalty": rr.scoop_penalty,
                        "total": rr.total,
                    }
                    for rr in r.results
                ],
                "status": r.status,
            }
            for r in event.rounds
        ],
        "standings": [
            {
                "player_id": s.player_id,
                "player_name": s.player_name,
                "total_points": s.total_points,
                "wins": s.wins,
                "kills": s.kills,
                "round_points": s.round_points,
            }
            for s in event.standings
        ],
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "completed_at": event.completed_at.isoformat() if event.completed_at else None,
    }


def _calculate_match_points(match: Match, is_alt_win: bool) -> list[RoundResult]:
    """
    Calculate tournament points for each player in a match.

    Normal match scoring:
      - 1st place (elimination_order=1): 3 placement points
      - 2nd place (elimination_order=2): 2 placement points
      - 3rd place (elimination_order=3): 1 placement point
      - 4th place (elimination_order=4): 0 placement points
      - Per kill: +1 point (count players where eliminated_by_player_id matches this player AND elimination_type=="kill")
      - Per scoop: -1 point (if this player's elimination_type=="scoop")

    Alternative win scoring (is_alt_win=True):
      - Winner: 4 alt_win_points, no placement or kill points
      - Players still in game (not eliminated or elimination_order <= 1): 2 placement_points
      - Players eliminated before alt-win: normal placement points
      - No kill points for anyone
      - Scoop penalty still applies to anyone who scooped
    """
    placement_map = {1: 3, 2: 2, 3: 1, 4: 0}
    results = []

    if is_alt_win:
        for mp in match.players:
            placement_points = 0
            kill_points = 0
            alt_win_points = 0
            scoop_penalty = 0

            if mp.is_winner:
                # Winner gets alt-win bonus, no placement or kill points
                alt_win_points = 4
            elif mp.elimination_order is None or mp.elimination_order == 1:
                # Still in the game when alt-win happened: 2 placement points
                placement_points = 2
            else:
                # Eliminated before alt-win: normal placement scoring
                placement_points = placement_map.get(mp.elimination_order, 0)

            # Scoop penalty applies regardless
            if mp.elimination_type == "scoop":
                scoop_penalty = -1

            total = placement_points + kill_points + alt_win_points + scoop_penalty

            results.append(RoundResult(
                player_id=mp.player_id,
                placement_points=placement_points,
                kill_points=kill_points,
                alt_win_points=alt_win_points,
                scoop_penalty=scoop_penalty,
                total=total,
            ))
    else:
        # Normal match scoring
        # Build kill counts: for each player, count how many other players they eliminated via "kill"
        kill_counts: dict[str, int] = {}
        for mp in match.players:
            if mp.eliminated_by_player_id and mp.elimination_type == "kill":
                kill_counts[mp.eliminated_by_player_id] = kill_counts.get(mp.eliminated_by_player_id, 0) + 1

        for mp in match.players:
            placement_points = placement_map.get(mp.elimination_order, 0) if mp.elimination_order else 0
            kill_points = kill_counts.get(mp.player_id, 0)
            scoop_penalty = -1 if mp.elimination_type == "scoop" else 0

            total = placement_points + kill_points + scoop_penalty

            results.append(RoundResult(
                player_id=mp.player_id,
                placement_points=placement_points,
                kill_points=kill_points,
                alt_win_points=0,
                scoop_penalty=scoop_penalty,
                total=total,
            ))

    return results


def _create_pods_from_player_list(player_ids: list[str], round_number: int) -> list[PodAssignment]:
    """Split a list of player IDs into pods of 4"""
    pods = []
    for i in range(0, len(player_ids), 4):
        chunk = player_ids[i:i + 4]
        pods.append(PodAssignment(
            pod_index=i // 4,
            player_ids=chunk,
            match_status="pending",
        ))
    return pods


def _create_1v1_pairings(player_ids: list[str]) -> list[PodAssignment]:
    """Create 1v1 pairings from a list of player IDs"""
    pods = []
    for i in range(0, len(player_ids) - 1, 2):
        pods.append(PodAssignment(
            pod_index=i // 2,
            player_ids=[player_ids[i], player_ids[i + 1]],
            match_status="pending",
        ))
    return pods


def _swiss_pair(standings: list[StandingsEntry], previous_rounds: list[Round]) -> list[PodAssignment]:
    """
    Swiss pairing: group by wins, pair within groups, avoid rematches.
    """
    previous_pairings: set[frozenset[str]] = set()
    for r in previous_rounds:
        for pod in r.pods:
            if len(pod.player_ids) == 2:
                previous_pairings.add(frozenset(pod.player_ids))

    sorted_players = sorted(
        standings,
        key=lambda s: (s.total_points, random.random()),
        reverse=True,
    )

    paired: list[tuple[str, str]] = []
    remaining = [s.player_id for s in sorted_players]

    while len(remaining) >= 2:
        p1 = remaining.pop(0)
        partner_idx = None
        for i, p2 in enumerate(remaining):
            if frozenset([p1, p2]) not in previous_pairings:
                partner_idx = i
                break
        if partner_idx is None:
            partner_idx = 0
        p2 = remaining.pop(partner_idx)
        paired.append((p1, p2))

    pods = []
    for i, (p1, p2) in enumerate(paired):
        pods.append(PodAssignment(
            pod_index=i,
            player_ids=[p1, p2],
            match_status="pending",
        ))
    return pods


# ==================== CRUD ENDPOINTS ====================

@router.get("/busy-players")
async def get_busy_players(current_player: Player = Depends(get_current_player)):
    """Return players currently in non-completed events and organizer active event info"""
    player_id_str = str(current_player.id)
    active_events = await Event.find(
        {"status": {"$in": ["setup", "active"]}}
    ).to_list()

    busy_map: dict[str, str] = {}
    organizer_event = None
    for ev in active_events:
        if ev.creator_id == player_id_str and organizer_event is None:
            organizer_event = {"event_id": str(ev.id), "event_name": ev.name, "status": ev.status}
        for ep in ev.players:
            if ep.player_id not in busy_map:
                busy_map[ep.player_id] = ev.name

    return {
        "busy_player_ids": list(busy_map.keys()),
        "busy_player_events": busy_map,
        "organizer_active_event": organizer_event,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_event(
    request: CreateEventRequest,
    current_player: Player = Depends(get_current_player),
):
    """Create a new tournament event (any pod member)"""
    # Validate pod exists
    pod = await Pod.get(PydanticObjectId(request.pod_id))
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    player_id_str = str(current_player.id)

    # Check pod membership
    if player_id_str not in pod.member_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a pod member to create an event",
        )

    # Organizer limit: one active event at a time
    existing = await Event.find_one({"creator_id": player_id_str, "status": {"$in": ["setup", "active"]}})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'You already have an active event: "{existing.name}". Complete or delete it before creating a new one.',
        )

    # Player exclusivity: no player can be in two active events
    active_events = await Event.find({"status": {"$in": ["setup", "active"]}}).to_list()
    busy_ids = {ep.player_id for ev in active_events for ep in ev.players}
    conflicts = set(request.player_ids) & busy_ids
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Some players are already in active events", "busy_player_ids": list(conflicts)},
        )

    # Validate player count
    player_count = len(request.player_ids)

    if request.event_type == "draft":
        if player_count < 4 or player_count > 12 or player_count % 2 != 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Draft requires an even number of players (4-12)",
            )
        if not request.game_mode or request.game_mode not in ("commander", "limited"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Draft requires game_mode: 'commander' or 'limited'",
            )
        if len(request.set_codes) > 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 4 sets allowed",
            )
    else:
        if player_count not in (4, 8, 12):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Player count must be 4, 8, or 12",
            )

    # Validate all players are pod members
    for pid in request.player_ids:
        if pid not in pod.member_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Player {pid} is not a member of this pod",
            )

    # Build EventPlayer snapshots
    event_players = []
    for pid in request.player_ids:
        player = await Player.get(PydanticObjectId(pid))
        if not player:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Player {pid} not found",
            )
        event_players.append(EventPlayer(
            player_id=pid,
            player_name=player.name,
            avatar=player.custom_avatar or player.picture or player.avatar,
        ))

    # Initialize standings
    standings = [
        StandingsEntry(
            player_id=ep.player_id,
            player_name=ep.player_name,
            total_points=0,
            wins=0,
            kills=0,
            round_points=[],
        )
        for ep in event_players
    ]

    # Fetch set details from Scryfall (draft only)
    draft_sets = []
    if request.event_type == "draft" and request.set_codes:
        for code in request.set_codes:
            set_data = await scryfall_service.get_set_by_code(code)
            if set_data:
                draft_sets.append(DraftSet(**set_data))

    # Build empty rounds
    rounds = [
        Round(
            round_number=i + 1,
            pods=[],
            results=[],
            status="pending",
        )
        for i in range(request.round_count)
    ]

    event = Event(
        name=request.name,
        event_type=request.event_type,
        pod_id=request.pod_id,
        creator_id=player_id_str,
        custom_image=request.custom_image,
        player_count=player_count,
        round_count=request.round_count,
        players=event_players,
        status="setup",
        current_round=0,
        rounds=rounds,
        standings=standings,
        event_date=request.event_date or date.today(),
        game_mode=request.game_mode,
        sets=draft_sets,
    )

    await event.insert()
    return serialize_event(event)


@router.get("/pod/{pod_id}")
async def list_events_for_pod(
    pod_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """List events for a pod (pod members only), sorted by created_at desc"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    player_id_str = str(current_player.id)
    if player_id_str not in pod.member_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a pod member to view events",
        )

    events = await Event.find(
        Event.pod_id == str(pod_id)
    ).sort(-Event.created_at).to_list()

    return [serialize_event(e) for e in events]


@router.get("/sets/search")
async def search_sets(q: str = ""):
    """Search for MTG sets via Scryfall (authenticated)"""
    results = await scryfall_service.search_sets(q)
    return results


@router.get("/{event_id}")
async def get_event(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Get event details (pod members only)"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    pod = await Pod.get(PydanticObjectId(event.pod_id))
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    player_id_str = str(current_player.id)
    if player_id_str not in pod.member_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a pod member to view this event",
        )

    return serialize_event(event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Delete event (creator only, must be in 'setup' status)"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    player_id_str = str(current_player.id)
    if event.creator_id != player_id_str and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event creator can delete the event",
        )

    if event.status != "setup":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete events in 'setup' status",
        )

    await event.delete()


# ==================== TOURNAMENT FLOW ENDPOINTS ====================

@router.post("/{event_id}/start")
async def start_tournament(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Start tournament (creator only). Shuffles players and creates pods for round 1."""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    player_id_str = str(current_player.id)
    if event.creator_id != player_id_str and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event creator can start the tournament",
        )

    if event.status != "setup":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event must be in 'setup' status to start",
        )

    # Randomly shuffle player IDs for round 1 seeding
    player_ids = [ep.player_id for ep in event.players]
    random.shuffle(player_ids)

    # Create pairings for round 1
    if event.event_type == "draft":
        round1_pods = _create_1v1_pairings(player_ids)
    else:
        round1_pods = _create_pods_from_player_list(player_ids, 1)

    # Update round 1
    event.rounds[0].pods = round1_pods
    event.rounds[0].status = "in_progress"

    # Update event state
    event.status = "active"
    event.current_round = 1

    await event.save()
    return serialize_event(event)


@router.post("/{event_id}/rounds/{round_num}/pods/{pod_index}/start-match")
async def start_pod_match(
    event_id: PydanticObjectId,
    round_num: int,
    pod_index: int,
    current_player: Player = Depends(get_current_player),
):
    """Start a match for a pod (any player in that pod)"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is not active",
        )

    if round_num != event.current_round:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Round {round_num} is not the current round ({event.current_round})",
        )

    # Find the round
    current_round = None
    for r in event.rounds:
        if r.round_number == round_num:
            current_round = r
            break

    if current_round is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")

    # Find the pod
    target_pod = None
    for pa in current_round.pods:
        if pa.pod_index == pod_index:
            target_pod = pa
            break

    if target_pod is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found in this round")

    # Validate current player is in this pod
    player_id_str = str(current_player.id)
    if player_id_str not in target_pod.player_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be in this pod to start the match",
        )

    if target_pod.match_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pod match is already {target_pod.match_status}",
        )

    # Update pod status
    target_pod.match_status = "in_progress"

    # Ensure round status is in_progress
    current_round.status = "in_progress"

    await event.save()

    return {
        "event_id": str(event.id),
        "event_round": round_num,
        "pod_index": pod_index,
        "player_ids": target_pod.player_ids,
    }


@router.post("/{event_id}/rounds/{round_num}/pods/{pod_index}/cancel-match")
async def cancel_pod_match(
    event_id: PydanticObjectId,
    round_num: int,
    pod_index: int,
    current_player: Player = Depends(get_current_player),
):
    """Cancel an in-progress match, resetting pod status back to pending"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is not active",
        )

    # Find the round
    current_round = None
    for r in event.rounds:
        if r.round_number == round_num:
            current_round = r
            break

    if current_round is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")

    # Find the pod
    target_pod = None
    for pa in current_round.pods:
        if pa.pod_index == pod_index:
            target_pod = pa
            break

    if target_pod is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found in this round")

    if target_pod.match_status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pod match is not in progress (status: {target_pod.match_status})",
        )

    # Reset pod status
    target_pod.match_status = "pending"
    target_pod.match_id = None

    await event.save()

    return {"status": "cancelled", "pod_index": pod_index}


@router.post("/{event_id}/rounds/{round_num}/pods/{pod_index}/set-deck")
async def set_pod_deck(
    event_id: PydanticObjectId,
    round_num: int,
    pod_index: int,
    request: SetDeckRequest,
    current_player: Player = Depends(get_current_player),
):
    """Record a player's deck selection for a pod (called during PlayerAssignment).
    Uses atomic $set to avoid race conditions when multiple players select decks simultaneously."""
    # Fetch the deck first (independent of event state)
    deck = await Deck.get(PydanticObjectId(request.deck_id))
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    deck_info = {
        "deck_name": deck.name,
        "commander_image_url": deck.commander_image_url or "",
        "colors": deck.colors or [],
    }

    # Atomic update — targets the exact nested path using array filters
    # Use the motor collection via Beanie's settings to avoid read-modify-write races
    collection = Event.get_settings().pymongo_collection
    result = await collection.update_one(
        {"_id": event_id, "status": "active"},
        {"$set": {
            f"rounds.$[r].pods.$[p].player_decks.{request.player_id}": deck_info,
        }},
        array_filters=[
            {"r.round_number": round_num},
            {"p.pod_index": pod_index},
        ],
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event, round, or pod not found")

    return {"status": "ok", "player_id": request.player_id, "deck_name": deck.name}


@router.post("/{event_id}/rounds/{round_num}/pods/{pod_index}/complete-match")
async def complete_pod_match(
    event_id: PydanticObjectId,
    round_num: int,
    pod_index: int,
    request: CompleteMatchRequest,
    current_player: Player = Depends(get_current_player),
):
    """Complete a match for a pod and calculate scoring"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is not active",
        )

    if round_num != event.current_round:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Round {round_num} is not the current round ({event.current_round})",
        )

    # Find the round
    current_round = None
    round_idx = None
    for idx, r in enumerate(event.rounds):
        if r.round_number == round_num:
            current_round = r
            round_idx = idx
            break

    if current_round is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")

    # Find the pod
    target_pod = None
    pod_arr_idx = None
    for idx, pa in enumerate(current_round.pods):
        if pa.pod_index == pod_index:
            target_pod = pa
            pod_arr_idx = idx
            break

    if target_pod is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found in this round")

    if target_pod.match_status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This pod match is already completed",
        )

    # Fetch the match document
    match = await Match.get(PydanticObjectId(request.match_id))
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    # Link match to event
    match.event_id = str(event.id)
    match.event_round = round_num
    match.game_mode = event.game_mode
    await match.save()

    # Update pod assignment
    target_pod.match_id = request.match_id
    target_pod.match_status = "completed"

    # Build player_decks map from match data (enrich with deck details)
    for mp in match.players:
        # Only overwrite if not already set (set-deck endpoint may have pre-populated)
        if mp.player_id not in target_pod.player_decks:
            target_pod.player_decks[mp.player_id] = PlayerDeckInfo(deck_name=mp.deck_name)

    # Calculate points
    if event.event_type == "draft":
        round_results = []
        for mp in match.players:
            total = 1 if mp.player_id == match.winner_player_id else 0
            round_results.append(RoundResult(
                player_id=mp.player_id,
                placement_points=total,
                total=total,
            ))
    else:
        round_results = _calculate_match_points(match, request.is_alt_win)

    # Merge new results into the round's results
    current_round.results.extend(round_results)

    # Update event standings with the new round results
    for rr in round_results:
        for standing in event.standings:
            if standing.player_id == rr.player_id:
                standing.total_points += rr.total
                standing.kills += rr.kill_points
                # Check if this player won the match
                if match.winner_player_id == rr.player_id:
                    standing.wins += 1
                # Append this round's points to the per-round tracking
                # Only add if we haven't added for this round yet
                while len(standing.round_points) < round_num:
                    standing.round_points.append(0)
                standing.round_points[round_num - 1] += rr.total
                break

    # Check if all pods in this round are completed
    all_completed = all(pa.match_status == "completed" for pa in current_round.pods)
    if all_completed:
        current_round.status = "completed"

    await event.save()
    return serialize_event(event)


@router.post("/{event_id}/advance-round")
async def advance_round(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Advance to next round (creator only). Seeds pods by standings."""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    player_id_str = str(current_player.id)
    if event.creator_id != player_id_str and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event creator can advance the round",
        )

    if event.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is not active",
        )

    # Validate current round is completed
    current_round = None
    for r in event.rounds:
        if r.round_number == event.current_round:
            current_round = r
            break

    if current_round is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current round not found")

    if current_round.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current round is not completed yet",
        )

    # Check there is a next round
    next_round_num = event.current_round + 1
    if next_round_num > event.round_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No more rounds to advance to. Use the complete endpoint instead.",
        )

    # Create pairings/pods for the next round
    if event.event_type == "draft":
        completed_rounds = [r for r in event.rounds if r.status == "completed"]
        next_round_pods = _swiss_pair(event.standings, completed_rounds)
    else:
        sorted_standings = sorted(
            event.standings,
            key=lambda s: (s.total_points, random.random()),
            reverse=True,
        )
        sorted_player_ids = [s.player_id for s in sorted_standings]
        next_round_pods = _create_pods_from_player_list(sorted_player_ids, next_round_num)

    # Find and update the next round
    for r in event.rounds:
        if r.round_number == next_round_num:
            r.pods = next_round_pods
            r.status = "in_progress"
            break

    event.current_round = next_round_num
    await event.save()
    return serialize_event(event)


@router.post("/{event_id}/complete")
async def complete_tournament(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Close tournament (creator only). Last round must be completed."""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    player_id_str = str(current_player.id)
    if event.creator_id != player_id_str and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event creator can complete the tournament",
        )

    if event.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is not active",
        )

    # Validate last round is completed
    last_round = None
    for r in event.rounds:
        if r.round_number == event.round_count:
            last_round = r
            break

    if last_round is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Last round not found")

    if last_round.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Last round is not completed yet",
        )

    event.status = "completed"
    event.completed_at = datetime.utcnow()

    await event.save()
    return serialize_event(event)


# ==================== PUBLIC ENDPOINT ====================

@router.get("/{event_id}/live")
async def get_live_event(event_id: PydanticObjectId):
    """Public live view of an event (NO AUTH required)"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return serialize_event(event)
