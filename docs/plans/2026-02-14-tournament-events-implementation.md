# Tournament Events Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add pod-scoped tournament events with a points-based scoring system, mobile command center, and public TV live view.

**Architecture:** Rich Event document (self-contained state machine) stores all tournament state. Matches get `event_id`/`event_round` backlinks. TV view fetches a single document and polls every 5s. All scoring computed server-side on match completion.

**Tech Stack:** FastAPI + Beanie ODM (backend), React + TypeScript + Tailwind CSS v4 (frontend), MongoDB

**Design Doc:** `docs/plans/2026-02-14-tournament-events-design.md`

**Note:** This project has no test infrastructure. Tasks focus on implementation with manual verification via the FastAPI docs UI (`/docs`) and browser.

---

## Task 1: Backend — Event Data Model

**Files:**
- Create: `backend/app/models/event.py`
- Modify: `backend/app/models/match.py`
- Modify: `backend/app/database.py`

**Step 1: Create `backend/app/models/event.py`**

```python
from datetime import datetime, date
from typing import Optional, Any
from beanie import Document
from pydantic import BaseModel, Field, field_validator


class EventPlayer(BaseModel):
    """Snapshot of a player registered in the event"""
    player_id: str
    player_name: str
    avatar: Optional[str] = None


class PodAssignment(BaseModel):
    """A single pod (table) within a tournament round"""
    pod_index: int  # 0-based pod number
    player_ids: list[str] = Field(default_factory=list)  # 4 player IDs in this pod
    match_id: Optional[str] = None  # Linked match document once started
    match_status: str = "pending"  # "pending" | "in_progress" | "completed"
    player_decks: dict[str, str] = Field(default_factory=dict)  # player_id -> deck_name


class RoundResult(BaseModel):
    """Per-player points earned in a single round"""
    player_id: str
    placement_points: int = 0  # 0-3 based on finish position
    kill_points: int = 0  # +1 per elimination
    alt_win_points: int = 0  # +4 if alt-win winner
    scoop_penalty: int = 0  # -1 per scoop
    total: int = 0  # Sum of above


class Round(BaseModel):
    """A tournament round containing pods and results"""
    round_number: int  # 1-based
    pods: list[PodAssignment] = Field(default_factory=list)
    results: list[RoundResult] = Field(default_factory=list)
    status: str = "pending"  # "pending" | "in_progress" | "completed"


class StandingsEntry(BaseModel):
    """Running standings for a player across the tournament"""
    player_id: str
    player_name: str
    total_points: int = 0
    wins: int = 0
    kills: int = 0
    round_points: list[int] = Field(default_factory=list)  # Points per round


class Event(Document):
    """Tournament event document"""
    name: str
    event_type: str = "tournament"  # "tournament" (later: "draft")
    pod_id: str  # Pod this event belongs to
    creator_id: str  # Tournament operator (player who created it)
    custom_image: Optional[str] = None  # Base64 logo (same pattern as Pod)

    # Tournament config
    player_count: int  # 4, 8, or 12
    round_count: int  # User-configured number of rounds
    players: list[EventPlayer] = Field(default_factory=list)

    # Tournament state
    status: str = "setup"  # "setup" | "active" | "completed"
    current_round: int = 0  # 0 = not started, 1+ = active round
    rounds: list[Round] = Field(default_factory=list)
    standings: list[StandingsEntry] = Field(default_factory=list)

    # Metadata
    event_date: date = Field(default_factory=date.today)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    @field_validator('player_count')
    @classmethod
    def validate_player_count(cls, v):
        if v not in (4, 8, 12):
            raise ValueError('Player count must be 4, 8, or 12')
        return v

    @field_validator('round_count')
    @classmethod
    def validate_round_count(cls, v):
        if v < 1 or v > 10:
            raise ValueError('Round count must be between 1 and 10')
        return v

    class Settings:
        name = "events"
        use_state_management = True
        use_revision = False

    def model_dump(self, **kwargs) -> dict[str, Any]:
        data = super().model_dump(**kwargs)
        if '_id' in data:
            data['id'] = str(data.pop('_id'))
        return data
```

**Step 2: Add `event_id`, `event_round` to Match and `is_alt_win` to MatchPlayer in `backend/app/models/match.py`**

Add to `MatchPlayer` class:
```python
is_alt_win: bool = False  # True if this match ended via alternative win condition
```

Add to `Match` class (after `first_player_position`):
```python
event_id: Optional[str] = None  # Links match to a tournament event
event_round: Optional[int] = None  # Which round of the event (1-based)
```

**Step 3: Register Event in `backend/app/database.py`**

Add import:
```python
from app.models.event import Event
```

Add `Event` to the `document_models` list in `init_beanie()`.

**Step 4: Verify**

Run: `cd backend && uv run python -c "from app.models.event import Event, EventPlayer, PodAssignment, Round, RoundResult, StandingsEntry; print('OK')"`

**Step 5: Commit**

```bash
git add backend/app/models/event.py backend/app/models/match.py backend/app/database.py
git commit -m "feat: add Event model and match-event backlinks"
```

---

## Task 2: Backend — Events CRUD Router

**Files:**
- Create: `backend/app/routers/events.py`
- Modify: `backend/app/main.py`

**Step 1: Create `backend/app/routers/events.py` with CRUD endpoints**

```python
from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId
from pydantic import BaseModel
from typing import Optional
from datetime import date

from app.models.event import Event, EventPlayer, StandingsEntry
from app.models.pod import Pod
from app.models.player import Player
from app.middleware.auth import get_current_player, get_optional_player

router = APIRouter()


class CreateEventRequest(BaseModel):
    name: str
    pod_id: str
    player_ids: list[str]  # Selected player IDs from pod members
    round_count: int
    event_date: Optional[date] = None
    custom_image: Optional[str] = None


def serialize_event(event: Event) -> dict:
    """Serialize event for API response"""
    return {
        "id": str(event.id),
        "name": event.name,
        "event_type": event.event_type,
        "pod_id": event.pod_id,
        "creator_id": event.creator_id,
        "custom_image": event.custom_image,
        "player_count": event.player_count,
        "round_count": event.round_count,
        "players": [p.model_dump() for p in event.players],
        "status": event.status,
        "current_round": event.current_round,
        "rounds": [r.model_dump() for r in event.rounds],
        "standings": [s.model_dump() for s in event.standings],
        "event_date": event.event_date.isoformat(),
        "created_at": event.created_at.isoformat(),
        "completed_at": event.completed_at.isoformat() if event.completed_at else None,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_event(
    request: CreateEventRequest,
    current_player: Player = Depends(get_current_player),
):
    """Create a new tournament event (any pod member)"""
    player_id_str = str(current_player.id)

    # Validate pod exists and user is a member
    pod = await Pod.get(PydanticObjectId(request.pod_id))
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    if player_id_str not in pod.member_ids:
        raise HTTPException(status_code=403, detail="You must be a pod member")

    # Validate player count is multiple of 4
    if len(request.player_ids) not in (4, 8, 12):
        raise HTTPException(status_code=400, detail="Player count must be 4, 8, or 12")

    # Validate all selected players are pod members
    for pid in request.player_ids:
        if pid not in pod.member_ids:
            raise HTTPException(status_code=400, detail=f"Player {pid} is not a pod member")

    # Build EventPlayer list with snapshots
    event_players = []
    for pid in request.player_ids:
        player = await Player.get(PydanticObjectId(pid))
        if not player:
            raise HTTPException(status_code=404, detail=f"Player {pid} not found")
        event_players.append(EventPlayer(
            player_id=pid,
            player_name=player.name,
            avatar=player.custom_avatar or player.picture or player.avatar,
        ))

    # Initialize standings
    standings = [
        StandingsEntry(player_id=ep.player_id, player_name=ep.player_name)
        for ep in event_players
    ]

    event = Event(
        name=request.name,
        pod_id=request.pod_id,
        creator_id=player_id_str,
        custom_image=request.custom_image,
        player_count=len(request.player_ids),
        round_count=request.round_count,
        players=event_players,
        standings=standings,
        event_date=request.event_date or date.today(),
    )
    await event.insert()

    return serialize_event(event)


@router.get("/pod/{pod_id}")
async def get_pod_events(
    pod_id: str,
    current_player: Player = Depends(get_current_player),
):
    """List all events for a pod"""
    player_id_str = str(current_player.id)

    pod = await Pod.get(PydanticObjectId(pod_id))
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    if player_id_str not in pod.member_ids:
        raise HTTPException(status_code=403, detail="You must be a pod member")

    events = await Event.find(Event.pod_id == pod_id).sort(-Event.created_at).to_list()
    return [serialize_event(e) for e in events]


@router.get("/{event_id}")
async def get_event(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Get event details (pod members only)"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    player_id_str = str(current_player.id)
    pod = await Pod.get(PydanticObjectId(event.pod_id))
    if not pod or player_id_str not in pod.member_ids:
        raise HTTPException(status_code=403, detail="You must be a pod member")

    return serialize_event(event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Delete an event (creator only, must be in setup status)"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.creator_id != str(current_player.id):
        raise HTTPException(status_code=403, detail="Only the event creator can delete it")

    if event.status != "setup":
        raise HTTPException(status_code=400, detail="Can only delete events in setup status")

    await event.delete()
```

**Step 2: Register router in `backend/app/main.py`**

Add import:
```python
from app.routers import players, decks, matches, leaderboard, scryfall, auth, pods, analytics, pod_dynamics, events
```

Add router:
```python
app.include_router(events.router, prefix="/api/events", tags=["events"])
```

**Step 3: Verify**

Start backend: `cd backend && uv run uvicorn app.main:app --reload --port 7777`
Check `/docs` — events endpoints should appear.

**Step 4: Commit**

```bash
git add backend/app/routers/events.py backend/app/main.py
git commit -m "feat: add events CRUD router"
```

---

## Task 3: Backend — Tournament Start Endpoint

**Files:**
- Modify: `backend/app/routers/events.py`

**Step 1: Add start tournament endpoint**

Add to `events.py`:

```python
import random

@router.post("/{event_id}/start")
async def start_tournament(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Start the tournament — randomly assign players to pods for round 1"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.creator_id != str(current_player.id):
        raise HTTPException(status_code=403, detail="Only the event creator can start the tournament")

    if event.status != "setup":
        raise HTTPException(status_code=400, detail="Tournament has already been started")

    # Randomly shuffle players for round 1
    player_ids = [p.player_id for p in event.players]
    random.shuffle(player_ids)

    # Create pods of 4
    pods_list = []
    for i in range(0, len(player_ids), 4):
        pods_list.append(PodAssignment(
            pod_index=len(pods_list),
            player_ids=player_ids[i:i + 4],
        ))

    round_1 = Round(
        round_number=1,
        pods=pods_list,
        status="in_progress",
    )

    await event.set({
        Event.status: "active",
        Event.current_round: 1,
        Event.rounds: [round_1],
    })

    # Re-fetch to return updated state
    event = await Event.get(event_id)
    return serialize_event(event)
```

**Step 2: Verify**

Use FastAPI docs (`/docs`) to:
1. Create an event with 8 player IDs
2. Call `POST /api/events/{id}/start`
3. Confirm round 1 has 2 pods of 4 with shuffled players

**Step 3: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat: add start tournament endpoint with random shuffle"
```

---

## Task 4: Backend — Start Match + Complete Match Endpoints

**Files:**
- Modify: `backend/app/routers/events.py`
- Modify: `backend/app/routers/matches.py` (add `event_id`/`event_round` to serialization)

**Step 1: Add start-match endpoint to `events.py`**

```python
from app.models.match import Match, MatchPlayer
from app.models.player import Deck

class StartMatchResponse(BaseModel):
    match_id: str
    player_ids: list[str]
    event_id: str
    event_round: int
    pod_index: int


@router.post("/{event_id}/rounds/{round_num}/pods/{pod_index}/start-match")
async def start_event_match(
    event_id: PydanticObjectId,
    round_num: int,
    pod_index: int,
    current_player: Player = Depends(get_current_player),
):
    """Start a match for a tournament pod. Any player in the pod can initiate."""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status != "active":
        raise HTTPException(status_code=400, detail="Tournament is not active")

    if round_num != event.current_round:
        raise HTTPException(status_code=400, detail="Not the current round")

    # Find the round and pod
    current_round = next((r for r in event.rounds if r.round_number == round_num), None)
    if not current_round:
        raise HTTPException(status_code=404, detail="Round not found")

    if pod_index < 0 or pod_index >= len(current_round.pods):
        raise HTTPException(status_code=404, detail="Pod not found")

    pod = current_round.pods[pod_index]
    player_id_str = str(current_player.id)

    if player_id_str not in pod.player_ids:
        raise HTTPException(status_code=403, detail="You are not in this pod")

    if pod.match_status != "pending":
        raise HTTPException(status_code=400, detail="Match already started or completed for this pod")

    # Update pod status
    pod.match_status = "in_progress"

    # Update round status if any pod is now in progress
    current_round.status = "in_progress"

    await event.save()

    return {
        "event_id": str(event.id),
        "event_round": round_num,
        "pod_index": pod_index,
        "player_ids": pod.player_ids,
    }
```

**Step 2: Add complete-match endpoint with scoring logic**

```python
class CompleteMatchRequest(BaseModel):
    match_id: str  # The match document ID from the match tracker save
    is_alt_win: bool = False  # Whether the match ended via alternative win


@router.post("/{event_id}/rounds/{round_num}/pods/{pod_index}/complete-match")
async def complete_event_match(
    event_id: PydanticObjectId,
    round_num: int,
    pod_index: int,
    request: CompleteMatchRequest,
    current_player: Player = Depends(get_current_player),
):
    """Complete a match and calculate tournament points"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status != "active":
        raise HTTPException(status_code=400, detail="Tournament is not active")

    current_round = next((r for r in event.rounds if r.round_number == round_num), None)
    if not current_round:
        raise HTTPException(status_code=404, detail="Round not found")

    if pod_index < 0 or pod_index >= len(current_round.pods):
        raise HTTPException(status_code=404, detail="Pod not found")

    pod_assignment = current_round.pods[pod_index]

    if pod_assignment.match_status == "completed":
        raise HTTPException(status_code=400, detail="Match already completed")

    # Fetch the match document
    match = await Match.get(PydanticObjectId(request.match_id))
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Link match to event
    match.event_id = str(event.id)
    match.event_round = round_num
    await match.save()

    # Update pod assignment
    pod_assignment.match_id = request.match_id
    pod_assignment.match_status = "completed"
    pod_assignment.player_decks = {
        p.player_id: p.deck_name for p in match.players
    }

    # Calculate points for each player in this match
    round_results = _calculate_match_points(match, request.is_alt_win)

    # Add results to round
    current_round.results.extend(round_results)

    # Check if all pods in round are complete
    all_complete = all(p.match_status == "completed" for p in current_round.pods)
    if all_complete:
        current_round.status = "completed"

    # Update standings
    for result in round_results:
        standing = next((s for s in event.standings if s.player_id == result.player_id), None)
        if standing:
            standing.total_points += result.total
            standing.kills += result.kill_points
            # Check if this player won their match
            if match.winner_player_id == result.player_id:
                standing.wins += 1
            # Extend round_points list if needed
            while len(standing.round_points) < round_num:
                standing.round_points.append(0)
            standing.round_points[round_num - 1] = result.total

    # Sort standings by total points descending
    event.standings.sort(key=lambda s: s.total_points, reverse=True)

    await event.save()

    event = await Event.get(event_id)
    return serialize_event(event)


def _calculate_match_points(match: Match, is_alt_win: bool) -> list[RoundResult]:
    """Calculate tournament points for each player in a completed match"""
    results = []

    # Placement points mapping (elimination_order: 1=winner, 2=2nd, 3=3rd, 4=4th)
    placement_map = {1: 3, 2: 2, 3: 1, 4: 0}

    if is_alt_win:
        # Alt win: winner gets 4 points, no kill/placement points
        # Players still alive get 2nd place (2 points)
        # Players eliminated before alt-win get normal placement
        for mp in match.players:
            result = RoundResult(player_id=mp.player_id)

            if mp.is_winner:
                result.alt_win_points = 4
            elif mp.elimination_order is None or mp.elimination_order == 1:
                # Still in game (no elimination order or winner) = 2nd place
                result.placement_points = 2
            else:
                # Eliminated before alt-win = normal placement points
                result.placement_points = placement_map.get(mp.elimination_order, 0)

            # Scoop penalty applies regardless
            if mp.elimination_type == "scoop":
                result.scoop_penalty = -1

            result.total = (
                result.placement_points
                + result.kill_points
                + result.alt_win_points
                + result.scoop_penalty
            )
            results.append(result)
    else:
        # Normal match
        for mp in match.players:
            result = RoundResult(player_id=mp.player_id)

            # Placement points
            if mp.elimination_order is not None:
                result.placement_points = placement_map.get(mp.elimination_order, 0)

            # Kill points: count how many players this player eliminated
            kills = sum(
                1 for other in match.players
                if other.eliminated_by_player_id == mp.player_id
                and other.elimination_type == "kill"
            )
            result.kill_points = kills

            # Scoop penalty
            if mp.elimination_type == "scoop":
                result.scoop_penalty = -1

            result.total = (
                result.placement_points
                + result.kill_points
                + result.alt_win_points
                + result.scoop_penalty
            )
            results.append(result)

    return results
```

**Step 3: Update `serialize_match` in `backend/app/routers/matches.py`**

Add `event_id` and `event_round` to the serialized output:
```python
"event_id": match.event_id,
"event_round": match.event_round,
```

**Step 4: Verify**

Test the full flow via `/docs`:
1. Create event → start tournament → start match on a pod
2. Create a regular match via `POST /matches/` with elimination data
3. Call complete-match with the match ID
4. Verify points are calculated correctly in the response

**Step 5: Commit**

```bash
git add backend/app/routers/events.py backend/app/routers/matches.py
git commit -m "feat: add start-match and complete-match with scoring"
```

---

## Task 5: Backend — Advance Round, Complete Event, Live Endpoint

**Files:**
- Modify: `backend/app/routers/events.py`

**Step 1: Add advance-round endpoint**

```python
@router.post("/{event_id}/advance-round")
async def advance_round(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Advance to next round — seed pods by standings"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.creator_id != str(current_player.id):
        raise HTTPException(status_code=403, detail="Only the event creator can advance rounds")

    if event.status != "active":
        raise HTTPException(status_code=400, detail="Tournament is not active")

    current_round = next(
        (r for r in event.rounds if r.round_number == event.current_round), None
    )
    if not current_round or current_round.status != "completed":
        raise HTTPException(status_code=400, detail="Current round is not complete")

    next_round_num = event.current_round + 1
    if next_round_num > event.round_count:
        raise HTTPException(status_code=400, detail="All rounds completed. Use the complete endpoint.")

    # Seed by standings (sorted by total_points desc, tiebreak random)
    sorted_standings = sorted(event.standings, key=lambda s: (s.total_points, random.random()), reverse=True)
    sorted_player_ids = [s.player_id for s in sorted_standings]

    # Create pods of 4
    pods_list = []
    for i in range(0, len(sorted_player_ids), 4):
        pods_list.append(PodAssignment(
            pod_index=len(pods_list),
            player_ids=sorted_player_ids[i:i + 4],
        ))

    new_round = Round(
        round_number=next_round_num,
        pods=pods_list,
        status="in_progress",
    )

    event.rounds.append(new_round)
    event.current_round = next_round_num
    await event.save()

    event = await Event.get(event_id)
    return serialize_event(event)
```

**Step 2: Add complete-event endpoint**

```python
from datetime import datetime

@router.post("/{event_id}/complete")
async def complete_event(
    event_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player),
):
    """Close the tournament"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.creator_id != str(current_player.id):
        raise HTTPException(status_code=403, detail="Only the event creator can close the tournament")

    if event.status != "active":
        raise HTTPException(status_code=400, detail="Tournament is not active")

    # Verify last round is complete
    last_round = next(
        (r for r in event.rounds if r.round_number == event.current_round), None
    )
    if not last_round or last_round.status != "completed":
        raise HTTPException(status_code=400, detail="Current round is not complete")

    await event.set({
        Event.status: "completed",
        Event.completed_at: datetime.utcnow(),
    })

    event = await Event.get(event_id)
    return serialize_event(event)
```

**Step 3: Add public live endpoint (no auth)**

```python
@router.get("/{event_id}/live")
async def get_event_live(event_id: PydanticObjectId):
    """Public endpoint for TV live view — no auth required"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return serialize_event(event)
```

**Step 4: Verify**

Full tournament flow via `/docs`:
1. Create event (8 players, 2 rounds)
2. Start tournament
3. Start + complete both pod matches in round 1
4. Advance round → verify pods are seeded by points
5. Start + complete round 2 matches
6. Complete event → verify final standings
7. Hit `/api/events/{id}/live` without auth → should return event data

**Step 5: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat: add advance-round, complete-event, and live endpoints"
```

---

## Task 6: Frontend — Event API Types & Service Layer

**Files:**
- Modify: `frontend/src/services/api.ts`

**Step 1: Add event types after the existing Match types**

```typescript
// Event Types
export interface EventPlayer {
  player_id: string;
  player_name: string;
  avatar?: string;
}

export interface PodAssignment {
  pod_index: number;
  player_ids: string[];
  match_id?: string;
  match_status: 'pending' | 'in_progress' | 'completed';
  player_decks: Record<string, string>;
}

export interface RoundResult {
  player_id: string;
  placement_points: number;
  kill_points: number;
  alt_win_points: number;
  scoop_penalty: number;
  total: number;
}

export interface EventRound {
  round_number: number;
  pods: PodAssignment[];
  results: RoundResult[];
  status: 'pending' | 'in_progress' | 'completed';
}

export interface StandingsEntry {
  player_id: string;
  player_name: string;
  total_points: number;
  wins: number;
  kills: number;
  round_points: number[];
}

export interface TournamentEvent {
  id: string;
  name: string;
  event_type: string;
  pod_id: string;
  creator_id: string;
  custom_image?: string;
  player_count: number;
  round_count: number;
  players: EventPlayer[];
  status: 'setup' | 'active' | 'completed';
  current_round: number;
  rounds: EventRound[];
  standings: StandingsEntry[];
  event_date: string;
  created_at: string;
  completed_at?: string;
}

export interface CreateEventRequest {
  name: string;
  pod_id: string;
  player_ids: string[];
  round_count: number;
  event_date?: string;
  custom_image?: string;
}
```

**Step 2: Add event API functions**

```typescript
// Event API Functions
export const eventApi = {
  create: async (request: CreateEventRequest): Promise<TournamentEvent> => {
    const response = await api.post('/events/', request);
    return response.data;
  },

  getById: async (id: string): Promise<TournamentEvent> => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },

  getByPod: async (podId: string): Promise<TournamentEvent[]> => {
    const response = await api.get(`/events/pod/${podId}`);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/events/${id}`);
  },

  start: async (id: string): Promise<TournamentEvent> => {
    const response = await api.post(`/events/${id}/start`);
    return response.data;
  },

  startMatch: async (
    eventId: string,
    round: number,
    podIndex: number,
  ): Promise<{ event_id: string; event_round: number; pod_index: number; player_ids: string[] }> => {
    const response = await api.post(`/events/${eventId}/rounds/${round}/pods/${podIndex}/start-match`);
    return response.data;
  },

  completeMatch: async (
    eventId: string,
    round: number,
    podIndex: number,
    matchId: string,
    isAltWin: boolean,
  ): Promise<TournamentEvent> => {
    const response = await api.post(
      `/events/${eventId}/rounds/${round}/pods/${podIndex}/complete-match`,
      { match_id: matchId, is_alt_win: isAltWin },
    );
    return response.data;
  },

  advanceRound: async (id: string): Promise<TournamentEvent> => {
    const response = await api.post(`/events/${id}/advance-round`);
    return response.data;
  },

  complete: async (id: string): Promise<TournamentEvent> => {
    const response = await api.post(`/events/${id}/complete`);
    return response.data;
  },

  getLive: async (id: string): Promise<TournamentEvent> => {
    // Use raw axios (no auth interceptor needed, but it won't hurt)
    const response = await axios.get(`/api/events/${id}/live`);
    return response.data;
  },
};
```

Note: import `axios` at the top of the file (raw axios for the unauthenticated live endpoint).

**Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add event types and API service layer"
```

---

## Task 7: Frontend — Event Creation Page

**Files:**
- Create: `frontend/src/pages/EventCreate.tsx`
- Modify: `frontend/src/main.tsx` (add route)

**Step 1: Create `frontend/src/pages/EventCreate.tsx`**

Build a mobile-optimized form page:
- Text input for event name
- Image upload for logo (reuse the pattern from `ArtSelectorModal.tsx` / `PodManagementModal.tsx`)
- Number input for rounds (1-10)
- Multi-select player picker from current pod members (must select exactly 4, 8, or 12)
- Validation: count must be 4/8/12, show live count badge
- Submit → `eventApi.create()` → navigate to `/event/{id}`

Follow existing page patterns (dark theme, card-based layout). Use `usePod()` context to get current pod and its members.

**Step 2: Add routes to `frontend/src/main.tsx`**

Inside the `MainLayout` protected routes block, add:
```tsx
<Route path="event/create" element={<EventCreate />} />
```

Add outside MainLayout (standalone full-screen like match-tracker):
```tsx
<Route path="event/:eventId/live" element={<EventLiveView />} />
```

Inside MainLayout:
```tsx
<Route path="event/:eventId" element={<EventDashboard />} />
```

For now, just add the create route. The other pages will be added in their respective tasks. Import lazily or add placeholder components.

**Step 3: Commit**

```bash
git add frontend/src/pages/EventCreate.tsx frontend/src/main.tsx
git commit -m "feat: add event creation page with player selection"
```

---

## Task 8: Frontend — Mobile Event Dashboard

**Files:**
- Create: `frontend/src/pages/EventDashboard.tsx`
- Modify: `frontend/src/main.tsx` (add route if not already)

**Step 1: Create `frontend/src/pages/EventDashboard.tsx`**

This is the main command center. It fetches the event by ID from URL params and renders based on `event.status`:

**Setup state:**
- Show event name, logo, player list, round count
- "Start Tournament" button (visible only to `event.creator_id === currentPlayer.id`)

**Active state:**
- **Standings section** at top: compact table with rank, player name, total points, W/K columns
- **Current Round section**: for each pod in `event.rounds[current_round-1].pods`:
  - Card showing player names (highlight current user's pod)
  - Status badge: "Waiting" / "In Progress" / "Done"
  - "Start Match" button if pod status is `pending` AND current player is in `pod.player_ids`
  - Results summary if completed (winner name, points)
- **Previous Rounds**: collapsible accordion cards for completed rounds
- **Admin actions** (creator only):
  - "Next Round" button — visible when current round status is `completed` AND `current_round < round_count`
  - "Close Event" button — visible when last round is completed
- **Share link** — copy `/event/{id}/live` URL for TV viewing

**Start Match flow:**
1. Call `eventApi.startMatch(eventId, round, podIndex)`
2. Navigate to `/event/{eventId}/match/${podIndex}` (built in Task 9)

**Polling:** When any pod in the current round has `match_status === "in_progress"`, poll `eventApi.getById()` every 5 seconds to reflect match completions.

Follow the app's dark theme styling patterns. Use `useParams()` for event ID, `useAuth()` for current player.

**Step 2: Add route to `main.tsx` if not done in Task 7**

**Step 3: Commit**

```bash
git add frontend/src/pages/EventDashboard.tsx frontend/src/main.tsx
git commit -m "feat: add mobile event dashboard with standings and round view"
```

---

## Task 9: Frontend — Event Match Tracker Integration

**Files:**
- Create: `frontend/src/pages/EventMatchTracker.tsx`
- Modify: `frontend/src/components/match-tracker/WinnerScreen.tsx` (add alt-win toggle)
- Modify: `frontend/src/main.tsx` (add route)

**Step 1: Create `frontend/src/pages/EventMatchTracker.tsx`**

This is a modified version of `MatchTracker.tsx` that:
- Reads `eventId` and `podIndex` from URL params
- Fetches the event to get the pod's player list
- **Skips GameSetup** — hardcoded to 4 players, 40 life
- **Skips player selection in PlayerAssignment** — players are pre-loaded from the event pod
- **Still shows deck selection** — players pick their deck via SmashDeckSelect
- On deck selection for all players:
  - Calls `eventApi.startMatch()` if not already called (pod transitions to in_progress)
- Game plays normally through `ActiveGame`
- On `WinnerScreen`:
  - Shows an "Alternative Win" toggle (new prop)
  - "Save Match" calls `matchApi.createMatch()` first (normal save), then calls `eventApi.completeMatch()` with the new match ID + `isAltWin` flag
  - On success, navigate back to `/event/{eventId}` instead of home

Use the existing `MatchTracker` component internals (PlayerAssignment, ActiveGame, WinnerScreen) as much as possible. The key difference is the initialization: instead of starting at the `setup` step, start at `assignment` with pre-filled player slots.

**Important implementation detail:** The `PlayerSlot[]` should be constructed from the event pod's `player_ids` — fetch each player's data to populate `playerName`, `commanderImageUrl`, etc. Only `deckId`, `deckName` are blank initially.

**Step 2: Add alt-win toggle to `WinnerScreen.tsx`**

Add a new optional prop to `WinnerScreenProps`:
```typescript
showAltWinToggle?: boolean;
isAltWin?: boolean;
onAltWinChange?: (value: boolean) => void;
```

Render a toggle/switch between the stats cards and the action buttons when `showAltWinToggle` is true:
```tsx
{showAltWinToggle && (
  <div className="flex justify-between items-center py-2 px-3 bg-[#1A1B1E] rounded-[8px] border border-[#2C2E33]">
    <div className="text-[11px] text-[#909296]">Alternative Win</div>
    <button
      className={`w-[48px] h-[26px] rounded-full transition-colors ${
        isAltWin ? 'bg-[#667eea]' : 'bg-[#2C2E33]'
      }`}
      onClick={() => onAltWinChange?.(!isAltWin)}
    >
      <div className={`w-[22px] h-[22px] rounded-full bg-white transition-transform ${
        isAltWin ? 'translate-x-[24px]' : 'translate-x-[2px]'
      }`} />
    </button>
  </div>
)}
```

**Step 3: Add route to `main.tsx`**

```tsx
<Route
  path="/event/:eventId/match/:podIndex"
  element={
    <RequireAuth allowGuest={false}>
      <EventMatchTracker />
    </RequireAuth>
  }
/>
```

Place this alongside the existing `/match-tracker` route (standalone, outside MainLayout).

**Step 4: Commit**

```bash
git add frontend/src/pages/EventMatchTracker.tsx frontend/src/components/match-tracker/WinnerScreen.tsx frontend/src/main.tsx
git commit -m "feat: add event match tracker with alt-win toggle"
```

---

## Task 10: Frontend — TV Live View

**Files:**
- Create: `frontend/src/pages/EventLiveView.tsx`
- Modify: `frontend/src/main.tsx` (add public route)

**Step 1: Create `frontend/src/pages/EventLiveView.tsx`**

Full-screen, landscape-optimized, no auth. Polls `/api/events/{id}/live` every 5 seconds.

**Layout (CSS Grid):**
```
┌──────────────────────────────────────────────────┐
│  [LOGO]  EVENT NAME              DATE  Round X/Y │  ← Header row
├──────────────────┬───────────────────────────────┤
│                  │                               │
│  STANDINGS       │   ROUND CARDS                 │  ← Main content
│  (left col)      │   (right col, scrollable)     │
│                  │                               │
├──────────────────┴───────────────────────────────┤
│  IN PROGRESS: Pod 1 — Player(Deck) vs ...        │  ← Footer bar
└──────────────────────────────────────────────────┘
```

**Standings column:**
- Numbered list with player names and total points
- Current round points shown as delta (`+5`)
- Winner highlighted with gold styling if event is completed

**Round timeline (right column):**
- Horizontal scroll if many rounds
- Each round is a vertical card showing its pods
- Pod cards show 4 player names, winner highlighted if done, "LIVE" badge if in progress

**Footer bar:**
- Only shown when any pod has `match_status === "in_progress"`
- Shows player names + deck names from `pod.player_decks`

**Polling:**
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const data = await eventApi.getLive(eventId);
    setEvent(data);
  }, 5000);
  return () => clearInterval(interval);
}, [eventId]);
```

**Styling:** Dark theme but with more dramatic styling — larger fonts, more spacing, subtle animations on standings changes. Designed to be readable from across a room.

**Step 2: Add public route to `main.tsx`**

```tsx
{/* Event Live View - Public, no auth, full-screen */}
<Route path="/event/:eventId/live" element={<EventLiveView />} />
```

Place this outside the `ProtectedRoute` wrapper and outside `MainLayout`.

**Step 3: Commit**

```bash
git add frontend/src/pages/EventLiveView.tsx frontend/src/main.tsx
git commit -m "feat: add TV live view with polling"
```

---

## Task 11: Frontend — Navigation Entry Points

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx` (add events section or button)
- Modify: `frontend/src/components/MainLayout.tsx` (add nav item if appropriate)

**Step 1: Add event entry points from the Dashboard**

Add a section to the Dashboard that shows:
- "Create Event" button (navigates to `/event/create`)
- List of active/recent events for the current pod (fetched via `eventApi.getByPod(currentPod.id)`)
- Each event card shows: name, status badge, date, player count
- Tapping an event navigates to `/event/{id}`

Keep this lightweight — a small card section, not a full page.

**Step 2: Verify full flow**

End-to-end test from the browser:
1. Dashboard → Create Event → fill form → submit
2. Event Dashboard → Start Tournament (see shuffle)
3. Start Match → deck select → play game → winner screen → alt-win toggle → save
4. Event Dashboard → see updated standings
5. Open `/event/{id}/live` in separate browser tab → see TV view
6. Complete round → advance → repeat
7. Close event → see final standings

**Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/components/MainLayout.tsx
git commit -m "feat: add event navigation from dashboard"
```

---

## Task 12: Frontend — Start Tournament Shuffle Animation

**Files:**
- Create: `frontend/src/components/events/ShuffleAnimation.tsx`
- Modify: `frontend/src/pages/EventDashboard.tsx` (integrate animation)

**Step 1: Create shuffle animation component**

When the creator hits "Start Tournament", before showing the pod assignments:
1. Show a grid of all player avatars/names
2. Animate them shuffling (CSS transforms — random positions, opacity flickers) for 2-3 seconds
3. Resolve into their pod groups with a reveal animation
4. Transition to showing the normal round view

Use `framer-motion` or pure CSS keyframe animations (check if framer-motion is already a dependency; if not, use CSS).

**Step 2: Integrate into EventDashboard**

After calling `eventApi.start()`, show the ShuffleAnimation overlay with the round 1 pod assignments. When animation completes, transition to normal active state view.

**Step 3: Commit**

```bash
git add frontend/src/components/events/ShuffleAnimation.tsx frontend/src/pages/EventDashboard.tsx
git commit -m "feat: add tournament start shuffle animation"
```

---

## Task 13: Version Bump & Final Commit

**Files:**
- Modify: `backend/app/config.py` (bump version)

**Step 1: Bump version**

Update `api_version` in `backend/app/config.py` to the next version.

**Step 2: Final commit**

```bash
git add backend/app/config.py
git commit -m "Bump version to X.X.X - Add tournament events system"
```
