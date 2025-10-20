# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pod Pal - A full-stack web application for tracking Magic: The Gathering Commander games among friends. The application tracks players, their decks, match results, and generates leaderboards.

**Tech Stack:**
- Backend: FastAPI (Python 3.13) + Beanie ODM + Motor (async MongoDB driver)
- Frontend: React + TypeScript + Vite + Tailwind CSS V4
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
   uv run uvicorn app.main:app --reload --port 7777
   ```
   - Backend will run on http://localhost:7777
   - Hot reloading enabled - changes to Python files auto-reload
   - API docs available at http://localhost:7777/docs

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
# Start all services (MongoDB on :27018, Backend on :7777, Frontend on :3000)
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
- Backend: Host `7777` → Container `7777`
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
   - Core fields: `name`, `avatar`, `deck_ids` (list of deck IDs), `created_at`
   - OAuth fields: `email`, `google_id`, `picture` (Google profile picture URL)
   - Permissions: `is_superuser` (boolean, default False) - grants access to admin panel and bypasses ownership checks
   - Collection: `players`
   - Note: Superuser status must be set manually via database

2. **Deck** (`app/models/player.py`)
   - Fields: `name`, `player_id`, `commander`, `commander_image_url`, `colors` (W/U/B/R/G), `created_at`
   - Collection: `decks`
   - Relationship: Referenced by Player via `deck_ids`
   - Scryfall Integration: Commander names validated via Scryfall API, images and color identities auto-populated

3. **Match** (`app/models/match.py`)
   - Fields: `players` (list of MatchPlayer), `winner_player_id`, `winner_deck_id`, `match_date`, `notes`, `created_at`
   - Collection: `matches`
   - Validation: Minimum 3 players required, winner must be in player list
   - Uses embedded `MatchPlayer` subdocuments containing snapshot data (player_name, deck_name)

**Important:** When a match is created, it stores denormalized player/deck names as snapshots. This allows matches to retain historical accuracy even if players or decks are renamed later.

**API Routers** (`app/routers/`):
- `auth.py` - Authentication and authorization:
  - `/api/auth/google` - Initiate Google OAuth flow
  - `/api/auth/callback` - Handle OAuth callback, create JWT
  - `/api/auth/me` - Get current authenticated user (requires Bearer token)
  - `/api/auth/dev/login` - Development-only login bypass (only in development mode)
- `players.py` - CRUD operations for players (admin-level endpoints)
- `decks.py` - CRUD operations for decks (authentication required):
  - POST: Creates deck for authenticated user only
  - PUT/DELETE: Requires ownership or superuser status
  - Scryfall integration for commander validation and image fetching
- `matches.py` - Match recording and retrieval
- `leaderboard.py` - Aggregation endpoints:
  - `/api/leaderboard/players` - Calculates win rates by player with detailed stats
  - `/api/leaderboard/decks` - Calculates win rates by deck
  - `/api/leaderboard/stats` - Dashboard statistics (total games, leader, etc.)
  - `/api/leaderboard/players/{id}/detail` - Detailed player stats with deck performance

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
- `App.tsx` - Main component with view state management (dashboard/leaderboard/admin/player-detail)
  - Handles custom events for cross-component navigation
  - Conditional admin menu rendering based on superuser status
- `App.css` - Dark theme styling with extensive CSS classes
- `contexts/AuthContext.tsx` - Global authentication state management
  - Stores current player, JWT token (localStorage)
  - Provides login/logout/refreshPlayer functions
- `pages/Login.tsx` - Google OAuth login + dev login bypass
- `components/`:
  - `ProfileDropdown.tsx` - User profile menu with avatar fallback logic
  - `PlayerDetail.tsx` - Player profile page with deck list and stats
  - `DeckForm.tsx` - Deck creation/edit form with Scryfall autocomplete
  - `AdminPanel.tsx` - Admin interface (players and decks tabs)
  - `Leaderboard.tsx` - Player rankings table
  - `TopPlayers.tsx`, `TopDecks.tsx` - Dashboard widgets
  - `StatsCards.tsx` - Dashboard statistics cards
  - `RecentMatches.tsx` - Recent match history
  - `MatchForm.tsx` - Match recording interface
  - `ColorPips.tsx` - MTG mana symbol renderer

**Authentication Flow:**
1. User clicks "Login with Google" → redirects to Google OAuth
2. OAuth callback returns to `/login?token=JWT`
3. Login page extracts token, calls AuthContext.login()
4. Token stored in localStorage, user data fetched from `/api/auth/me`
5. Protected routes check AuthContext.currentPlayer before rendering

**API Integration:**
- `services/api.ts` - Axios-based API client with Bearer token authentication
- Vite dev server proxies `/api` requests to `http://localhost:7777` (configured in `vite.config.ts`)
- Production: Nginx proxies `/api` to backend service

**Styling Conventions:**
- Dark theme: Background `#141517`, Cards `#1A1B1E`, Borders `#2C2E33`
- Primary gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- Component classes follow BEM-like naming (`.header`, `.nav-btn`, `.stat-card`)
- Responsive design with grid layouts

**Tailwind CSS v4 Integration:**

The application uses **Tailwind CSS v4** with a hybrid approach:
- **Tailwind utilities** for simple styles (spacing, colors, flexbox, typography)
- **Custom CSS classes** for complex patterns (gradients, tier system, MTG-specific styling)
- **CSS variables** for design tokens (like `--tier-color`)

**Configuration:**
- **CSS-first approach**: No `tailwind.config.js` file
- Configuration in `frontend/src/index.css` using `@import "tailwindcss"`
- Vite plugin: `@tailwindcss/vite` configured in `vite.config.ts`

**CSS Layer Organization (`frontend/src/index.css`):**
```css
@import "tailwindcss";

@layer base {
  /* Base styles - universal resets, CSS variables */
  * { box-sizing: border-box; }
  :root {
    --accent-cyan: #33D9B2;
    --accent-purple: #667eea;
  }
}

@layer components {
  /* Custom component classes */
  .bg-gradient-card {
    background: linear-gradient(135deg, #1A1B1E 0%, #1C1D21 100%);
  }
  .s-tier {
    --tier-color: #FFD700;
    --tier-color-light: #FFA500;
  }
  .text-tier-s { color: #FFD700; }
}
```

**Critical Rules:**
1. **Never use universal resets outside `@layer base`** - CSS loaded after `index.css` will override ALL Tailwind utilities
2. **Use arbitrary values for custom values**: `rounded-[12px]`, `text-[#667eea]`, `border-[#2C2E33]`
3. **Invalid utilities don't exist**: `rounded-12` is invalid, use `rounded-[12px]` instead
4. **Complex patterns stay as custom classes**: Multi-color gradients, CSS variable-based tier colors, animations

**Common Patterns:**
```tsx
// Spacing - use Tailwind utilities
<div className="p-6 gap-3">  // padding: 24px, gap: 12px

// Custom colors - use arbitrary values
<div className="border border-[#2C2E33] text-[#667eea]">

// Responsive design
<div className="hidden md:block">  // Desktop only
<div className="flex flex-col md:hidden">  // Mobile only

// Dynamic tier classes
const tier = getWinRateTier(winRate);
<div className={`text-lg font-bold ${tier.color}`}>  // tier.color = 'text-tier-s'

// Hybrid approach - Tailwind + custom classes
<div className="inline-flex items-center gap-3 px-3 py-2 rounded-[8px] bg-gradient-card">
```

**Reference:** See `/frontend/TAILWIND_MIGRATION_GUIDE.md` for detailed migration patterns, common issues, and complete examples.

### Database Relationships

**Player ↔ Deck:**
- One-to-Many: Player has `deck_ids` array (list of Deck ObjectIds)
- Decks are separate documents, not embedded

**Match Recording:**
- Match stores denormalized `MatchPlayer` objects with both IDs and names
- This snapshot approach prevents data inconsistency if players/decks are modified
- Leaderboard calculations aggregate across all matches in real-time

## Environment Configuration

**Backend Environment Variables** (`backend/.env` or docker-compose):
- `MONGODB_URL` - MongoDB connection string (default: `mongodb://mongodb:27017`)
- `DATABASE_NAME` - Database name (default: `mtg_leaderboard`)
- `CORS_ORIGINS` - JSON array of allowed origins (e.g., `["http://localhost:5173"]`)
- `API_TITLE`, `API_VERSION`, `API_DESCRIPTION` - OpenAPI metadata
- `SECRET_KEY` - JWT signing key (generate with `openssl rand -hex 32`)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `FRONTEND_URL` - Frontend URL for OAuth redirects (default: `http://localhost:5173`)
- `environment` - Environment mode: "development" or "production" (affects dev login endpoint)

**Docker Port Mappings:**
- MongoDB: Host `27018` → Container `27017` (non-standard port to avoid conflicts)
- Backend: Host `7777` → Container `7777`
- Frontend: Host `3000` → Container `80` (Nginx)

## Key Implementation Details

### Authentication & Security

**JWT Authentication:**
- JWTs are created with player ID as subject in `app/middleware/jwt.py`
- Tokens stored in localStorage on frontend
- `get_current_player` dependency injection used to protect endpoints
- Token included in API requests via Axios interceptor: `Authorization: Bearer {token}`

**Role-Based Access Control:**
- Users can only create/edit/delete their own decks
- `is_superuser` field bypasses ownership checks
- Admin panel only visible to superusers
- Player selector in deck form only shown in admin context

**Development Login Bypass:**
- `/api/auth/dev/login` creates/returns test user "Dev User" (dev@test.local)
- Only available when `environment=development` in config
- Uses DiceBear avatar service for profile pictures

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

### Scryfall Integration

**Commander Validation** (`app/services/scryfall.py`):
- Validates commander names against Scryfall database
- Ensures card is a legendary creature
- Auto-fetches commander image (art_crop preferred, fallback to normal)
- Auto-populates color identity from Scryfall data
- Used in deck create/update endpoints

**CommanderAutocomplete Component:**
- Real-time search as user types (300ms debounce)
- Displays card images in dropdown
- Auto-fills colors when commander selected

### Match Validation Rules

1. Matches require minimum 3 players (`@field_validator` on `Match.players`)
2. Winner must be one of the participating players
3. Each player in a match needs both player_id and deck_id

### API Response Formats

**Note:** FastAPI endpoints without trailing slashes will return 307 redirects. Always include trailing slashes in route definitions or client requests.

## Current State & Features

**Completed Features:**
- ✅ **Authentication & Authorization**
  - Google OAuth 2.0 integration with JWT tokens
  - Development login bypass for local testing
  - Protected routes and API endpoints
  - Role-based access control (superuser permissions)
  - Profile dropdown with avatar fallback logic

- ✅ **Player Management**
  - Player profiles with detailed statistics
  - Win rates, total games, favorite colors
  - Deck ownership and management
  - Admin panel for player CRUD (superusers only)

- ✅ **Deck Management**
  - Deck creation with Scryfall commander validation
  - Commander autocomplete with card images
  - Auto-populated color identities from Scryfall
  - User can only manage their own decks
  - Admin panel deck management (superusers only)

- ✅ **Leaderboard System**
  - Player rankings with win rates and statistics
  - Deck performance tracking
  - Dashboard statistics cards (total games, current leader, etc.)
  - Top players and top decks widgets
  - Detailed player profile pages

- ✅ **Match Recording**
  - Match form with player/deck selection
  - Winner selection
  - Match history with recent games
  - Denormalized match data for historical accuracy

- ✅ **UI/UX**
  - Dark theme with purple gradient accents
  - Responsive grid layouts
  - Loading states and empty states
  - Modal forms with validation
  - MTG mana symbol rendering (ColorPips)
  - Navigation between views

- ✅ **Technical Infrastructure**
  - Full backend API with all CRUD operations
  - Beanie ODM integration with MongoDB
  - Docker containerization with docker-compose
  - TypeScript API service layer with Axios
  - MongoDB `_id` → `id` serialization
  - Hot reloading development environment

**Future Enhancements:**
- ⏳ Data visualization and charts (win rate trends, color distribution)
- ⏳ Advanced filtering and sorting on leaderboards
- ⏳ Match history pagination
- ⏳ Player statistics export
- ⏳ Deck archetypes and tags
