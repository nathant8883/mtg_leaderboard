# Tournament Events Design

**Date:** 2026-02-14
**Status:** Approved

## Overview

Add tournament events to Pod Pal. Events are pod-scoped and run a points-based Commander tournament across multiple rounds of 4-player pods. A public TV-friendly live view allows spectating on a shared screen. Drafts will be a future event type built on the same foundation.

## Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Format | Multiples of 4 players (4/8/12), always 4-player pods, user picks round count |
| 2 | Scope | Pod-scoped — events belong to a pod, draw from pod members |
| 3 | Alt Win | Post-game classification on results screen |
| 4 | TV View | Separate shareable URL, no auth required |
| 5 | Match Start | From event screen only — event is the hub |
| 6 | Visualization | Hybrid: standings leaderboard + round pod timeline |
| 7 | Scoop Penalty | Always -1 for any scoop in tournament |
| 8 | Decks | Pick each round through normal deck selection |
| 9 | Live Updates | Polling (5-10s) |
| 10 | Permissions | Event creator = tournament operator (start, advance, close). Any pod player in a pod can start their match |

## Architecture: Rich Event Document (Approach A)

The `Event` document is a self-contained state machine storing everything needed to render the TV view in a single fetch. Standings are denormalized and updated on match completion. Matches get a backlink via `event_id` + `event_round`.

## Data Model

### Event Document (collection: `events`)

```python
class EventPlayer(BaseModel):
    player_id: str
    player_name: str
    avatar: Optional[str] = None

class PodAssignment(BaseModel):
    pod_index: int                      # 0-based pod number
    player_ids: list[str]               # 4 player IDs
    match_id: Optional[str] = None      # Linked match once started
    match_status: str = "pending"       # "pending" | "in_progress" | "completed"
    player_decks: dict[str, str] = {}   # player_id -> deck_name (populated when match starts)

class RoundResult(BaseModel):
    player_id: str
    placement_points: int = 0           # 0-3 based on finish position
    kill_points: int = 0                # +1 per elimination
    alt_win_points: int = 0             # +4 if alt-win winner
    scoop_penalty: int = 0              # -1 per scoop
    total: int = 0                      # Sum of above

class Round(BaseModel):
    round_number: int                   # 1-based
    pods: list[PodAssignment]
    results: list[RoundResult] = []     # Populated as matches complete
    status: str = "pending"             # "pending" | "in_progress" | "completed"

class StandingsEntry(BaseModel):
    player_id: str
    player_name: str
    total_points: int = 0
    wins: int = 0
    kills: int = 0
    round_points: list[int] = []        # Points per round (index = round-1)

class Event(Document):
    name: str
    event_type: str = "tournament"      # "tournament" (later: "draft")
    pod_id: str                         # Pod this event belongs to
    creator_id: str                     # Tournament operator
    custom_image: Optional[str] = None  # Base64 logo (same pattern as Pod)

    # Tournament config
    player_count: int                   # 4, 8, or 12
    round_count: int
    players: list[EventPlayer]

    # Tournament state
    status: str = "setup"               # "setup" | "active" | "completed"
    current_round: int = 0              # 0 = not started, 1+ = active round
    rounds: list[Round] = []
    standings: list[StandingsEntry] = []

    # Metadata
    event_date: date
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Settings:
        name = "events"
```

### Match Model Additions

```python
# Added to Match document:
event_id: Optional[str] = None
event_round: Optional[int] = None

# Added to MatchPlayer:
is_alt_win: bool = False
```

## API Design

### Router: `/api/events/`

```
# CRUD
POST   /api/events/                                              Create event
GET    /api/events/{id}                                          Get event
GET    /api/events/pod/{pod_id}                                  List events for pod
DELETE /api/events/{id}                                          Delete event

# Tournament Flow (creator only unless noted)
POST   /api/events/{id}/start                                    Start tournament (random round 1)
POST   /api/events/{id}/rounds/{round}/pods/{pod_index}/start-match    Start match (any pod player)
POST   /api/events/{id}/rounds/{round}/pods/{pod_index}/complete-match Complete match + score
POST   /api/events/{id}/advance-round                            Seed next round by standings
POST   /api/events/{id}/complete                                 Close tournament

# Public
GET    /api/events/{id}/live                                     TV view (no auth)
```

### Scoring Rules (server-side, on complete-match)

**Normal match:**
- 1st place: 3 points
- 2nd place: 2 points
- 3rd place: 1 point
- 4th place: 0 points
- Per elimination (kill): +1 point
- Per scoop: -1 point

**Alternative win match:**
- Winner: 4 points (no placement or kill points)
- All players still in game: 2 points (2nd place)
- Players eliminated before alt-win: normal placement points
- No elimination points awarded to anyone

### Seeding Rules (on advance-round)

- Round 1: Random shuffle
- Round 2+: Sort by total points descending, tiebreak random
  - Pod 1 = top 4, Pod 2 = next 4, Pod 3 = next 4 (if 12 players)

## Frontend Architecture

### Routes

```
/event/create              Event creation form (mobile, auth)
/event/{id}                Event dashboard (mobile, auth, pod members)
/event/{id}/live           TV live view (public, no auth)
/event/{id}/match/{pod}    Match tracker from event context
```

### Mobile Event Dashboard (`/event/{id}`)

The command center. All interaction happens here.

**Permissions:**
- Creator sees: "Start Tournament", "Next Round", "Close Event"
- Players in a pod see: "Start Match" on their pod
- All pod members see: standings, round status, results

**Active round:**
- Player's own pod pinned to top: "You're in Pod 1 with Bob, Carol, Dave"
- Big "Start Match" button
- Other pods below with status indicators
- Compact standings list

### TV Live View (`/event/{id}/live`)

Read-only spectator display. No buttons, no auth.

**Layout:**
- Header: logo, event name, date, current round
- Left column: live standings leaderboard
- Right column: round-by-round pod timeline (scrolls horizontally)
- Bottom bar: in-progress matches with player + deck/commander names
- Polls every 5 seconds

### Match Tracker Integration

When "Start Match" tapped from mobile event dashboard:
1. Navigate to `/event/{id}/match/{pod_index}`
2. Players pre-assigned (skip GameSetup + player selection)
3. Deck selection still happens (SmashDeckSelect phase)
4. On deck select: `start-match` API called, event pod updated with deck info
5. Game plays normally through ActiveGame
6. WinnerScreen adds "Alt Win" toggle
7. On save: `complete-match` API called, scoring computed server-side
8. Redirect back to event dashboard

### Start Tournament Animation

On "Start Tournament": player names/avatars shuffle in a grid for 2-3 seconds, then settle into pod cards.

## State Machine

```
Event:  setup → active → completed
Round:  pending → in_progress → completed
Pod:    pending → in_progress → completed
```

| Trigger | Who | Validation |
|---------|-----|------------|
| Start Tournament | Creator | Event in setup |
| Start Match | Any player in pod | Pod is pending |
| Match Finishes | System | Valid match results |
| Advance Round | Creator | All pods in round completed |
| Close Event | Creator | All rounds completed |

## Edge Cases

- **Match abandoned:** Pod stays `in_progress`, "Start Match" reappears for retry
- **Stuck pod:** Creator asks players to finish/restart. No admin override in v1
- **Tiebreakers in seeding:** Random among tied players
- **4-player tournament:** Single pod per round, same scoring, no seeding decisions
