# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MTG Commander Leaderboard - A full-stack web application for tracking Magic: The Gathering Commander games among friends. The application tracks players, their decks, match results, and generates leaderboards.

**Tech Stack:**
- Backend: FastAPI (Python 3.13) + Beanie ODM + Motor (async MongoDB driver)
- Frontend: React + TypeScript + Vite
- Database: MongoDB
- Package Management: `uv` (Python), `npm` (JavaScript)
- Deployment: Docker + Docker Compose

## Development Workflow

### Recommended: Local Development (Hot Reloading)

**Prerequisites:**
- MongoDB running locally on port 27017
- Python 3.13+ installed
- Node.js 20+ and npm installed
- `uv` package manager installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

**Starting the Development Environment:**

1. **Start MongoDB** (if not already running):
   ```bash
   # If you don't have MongoDB running locally, use Docker:
   docker run -d --name mtg-mongodb-dev -p 27017:27017 \
     -e MONGO_INITDB_DATABASE=mtg_leaderboard mongo:7
   ```

2. **Start Backend** (Terminal 1):
   ```bash
   cd backend
   uv run uvicorn app.main:app --reload --port 8000
   ```
   - Backend will run on http://localhost:8000
   - Hot reloading enabled - changes to Python files auto-reload
   - API docs available at http://localhost:8000/docs

3. **Start Frontend** (Terminal 2):
   ```bash
   cd frontend
   npm install  # Only needed first time
   npm run dev
   ```
   - Frontend will run on http://localhost:5173
   - Hot Module Replacement (HMR) enabled - instant updates on file changes
   - Access the app at http://localhost:5173

**Development Tips:**
- CSS changes in `frontend/src/App.css` will hot-reload instantly
- React component changes will hot-reload without full page refresh
- Backend API changes will auto-reload the server
- MongoDB data persists between restarts

**Stopping Development Servers:**
- Press Ctrl+C in each terminal to stop backend/frontend
- To stop MongoDB: `docker stop mtg-mongodb-dev`

---

### Alternative: Docker Compose (Production-like)

Use this for testing the full production build or when you need isolated environments.

```bash
# Start all services (MongoDB on :27018, Backend on :8000, Frontend on :3000)
docker compose up

# Build and start from scratch
docker compose up --build

# Rebuild frontend after CSS/code changes (no hot reload in Docker)
docker compose build frontend --no-cache && docker compose up frontend -d

# Stop all services
docker compose down

# View logs
docker compose logs -f
docker compose logs backend
docker compose logs frontend

# Check service status
docker compose ps
```

**Docker Port Mappings:**
- MongoDB: Host `27018` → Container `27017` (non-standard port to avoid conflicts)
- Backend: Host `8000` → Container `8000`
- Frontend: Host `3000` → Container `80` (Nginx)

**Note:** Docker setup uses production builds (Nginx for frontend), so changes require rebuilding containers. Use local development for faster iteration.

## Architecture & Data Flow

### Backend Architecture

**FastAPI Application Structure:**
- `app/main.py` - FastAPI app initialization, CORS middleware, router registration, lifespan management
- `app/config.py` - Pydantic Settings for environment-based configuration
- `app/database.py` - Beanie initialization with Motor async client

**Data Models (Beanie ODM):**
The application uses Beanie (async ODM for MongoDB) with three main document types:

1. **Player** (`app/models/player.py`)
   - Fields: `name`, `avatar`, `deck_ids` (list of deck IDs), `created_at`
   - Collection: `players`

2. **Deck** (`app/models/player.py`)
   - Fields: `name`, `commander`, `colors` (W/U/B/R/G), `created_at`
   - Collection: `decks`
   - Relationship: Referenced by Player via `deck_ids`

3. **Match** (`app/models/match.py`)
   - Fields: `players` (list of MatchPlayer), `winner_player_id`, `winner_deck_id`, `match_date`, `notes`, `created_at`
   - Collection: `matches`
   - Validation: Minimum 3 players required, winner must be in player list
   - Uses embedded `MatchPlayer` subdocuments containing snapshot data (player_name, deck_name)

**Important:** When a match is created, it stores denormalized player/deck names as snapshots. This allows matches to retain historical accuracy even if players or decks are renamed later.

**API Routers** (`app/routers/`):
- `players.py` - CRUD operations for players
- `decks.py` - CRUD operations for decks
- `matches.py` - Match recording and retrieval
- `leaderboard.py` - Aggregation endpoints:
  - `/api/leaderboard/players` - Calculates win rates by player
  - `/api/leaderboard/decks` - Calculates win rates by deck
  - `/api/leaderboard/stats` - Dashboard statistics (total games, leader, etc.)

**Beanie Usage Patterns:**
```python
# All routers use Beanie query methods:
await Player.find_all().to_list()        # Get all documents
await Player.get(player_id)              # Get by ID (PydanticObjectId)
await player.insert()                     # Create new document
await player.set({Player.name: "New"})   # Update fields
await player.delete()                     # Delete document
```

### Frontend Architecture

**Component Structure:**
- `App.tsx` - Main component with view state management (dashboard vs leaderboard)
- `App.css` - Dark theme styling matching the mockup design
- Uses React hooks (`useState`) for simple state management

**API Integration:**
- Vite dev server proxies `/api` requests to `http://localhost:8000` (configured in `vite.config.ts`)
- Production: Nginx proxies `/api` to backend service

**Styling Conventions:**
- Dark theme: Background `#141517`, Cards `#1A1B1E`, Borders `#2C2E33`
- Primary gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- Component classes follow BEM-like naming (`.header`, `.nav-btn`, `.stat-card`)

### Database Relationships

**Player ↔ Deck:**
- One-to-Many: Player has `deck_ids` array (list of Deck ObjectIds)
- Decks are separate documents, not embedded

**Match Recording:**
- Match stores denormalized `MatchPlayer` objects with both IDs and names
- This snapshot approach prevents data inconsistency if players/decks are modified
- Leaderboard calculations aggregate across all matches in real-time

## Environment Configuration

**Backend Environment Variables** (`.env` or docker-compose):
- `MONGODB_URL` - MongoDB connection string (default: `mongodb://mongodb:27017`)
- `DATABASE_NAME` - Database name (default: `mtg_leaderboard`)
- `CORS_ORIGINS` - JSON array of allowed origins
- `API_TITLE`, `API_VERSION`, `API_DESCRIPTION` - OpenAPI metadata

**Docker Port Mappings:**
- MongoDB: Host `27018` → Container `27017` (non-standard port to avoid conflicts)
- Backend: Host `8000` → Container `8000`
- Frontend: Host `3000` → Container `80` (Nginx)

## Key Implementation Details

### Beanie Document Registration

All Beanie document models must be registered in `app/database.py:init_db()`:
```python
await init_beanie(
    database=database,
    document_models=[Player, Deck, Match]  # Add new models here
)
```

### FastAPI Router Registration

New routers must be included in `app/main.py`:
```python
app.include_router(new_router.router, prefix="/api/endpoint", tags=["tag"])
```

### Match Validation Rules

1. Matches require minimum 3 players (`@field_validator` on `Match.players`)
2. Winner must be one of the participating players
3. Each player in a match needs both player_id and deck_id

### API Response Formats

**Note:** FastAPI endpoints without trailing slashes will return 307 redirects. Always include trailing slashes in route definitions or client requests.

## Current State & Future Work

**Completed:**
- ✅ Full backend API with all CRUD operations
- ✅ Beanie ODM integration with MongoDB
- ✅ Docker containerization with docker-compose
- ✅ Frontend shell with navigation and full-width layout
- ✅ Admin Panel with full player CRUD functionality
  - Create players with name and avatar (emoji/letter)
  - Edit existing players
  - Delete players with confirmation
  - Empty state and loading states
  - Modal forms with validation
- ✅ API service layer (TypeScript) with Axios
- ✅ Fixed MongoDB `_id` → `id` serialization for frontend compatibility
- ✅ Dark theme UI with purple gradient accents

**Pending Implementation:**
- ⏳ Dashboard UI with stat cards and recent matches
- ⏳ Match recording form (player selection, deck selection, winner marking)
- ⏳ Deck management UI (similar to player management)
- ⏳ Leaderboard tables (by player, by deck)
- ⏳ Leaderboard calculation logic implementation
- ⏳ Data visualization and charts

**Design Reference:**
The HTML mockup at `/home/nturner/Downloads/commander-leaderboard.html` contains the full UI design including:
- Dashboard stat cards (purple/pink/blue/orange gradients)
- Match recording workflow with player chips and deck dropdowns
- Leaderboard tables with rank badges (gold/silver/bronze)
- MTG color pip visualization for deck colors
