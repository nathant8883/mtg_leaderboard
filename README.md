# Pod Pal

A web application for tracking Magic: The Gathering Commander games and managing leaderboards among friends.

## Features

- Create and manage players
- Track decks with commanders and color identities
- Record matches with 3+ players
- View leaderboards by player and by deck
- Dashboard with statistics and recent matches

## Technology Stack

- **Backend**: FastAPI (Python 3.13) with Beanie ODM
- **Frontend**: React with TypeScript and Vite
- **Database**: MongoDB
- **Package Management**: uv (Python), npm (JavaScript)
- **Containerization**: Docker & Docker Compose

## Project Structure

```
MTGLeaderboard/
├── backend/
│   ├── app/
│   │   ├── models/          # Beanie Document models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── services/        # Business logic
│   │   ├── main.py          # FastAPI application
│   │   ├── config.py        # Configuration settings
│   │   └── database.py      # Database initialization
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## Getting Started

### Prerequisites

- Docker and Docker Compose installed on your system

### Quick Start with Docker

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd MTGLeaderboard
   ```

2. Create environment file (optional):
   ```bash
   cp .env.example .env
   # Edit .env if you need custom configuration
   ```

3. Build and run with Docker Compose:
   ```bash
   docker compose up --build
   ```

4. Access the application:
   - Frontend: http://localhost
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Development Setup (Without Docker)

#### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies with uv:
   ```bash
   uv sync
   ```

3. Start MongoDB (if not using Docker):
   ```bash
   # Make sure MongoDB is running on localhost:27017
   ```

4. Run the backend server:
   ```bash
   uv run uvicorn app.main:app --reload --port 8000
   ```

#### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Access the frontend at http://localhost:5173

## API Endpoints

### Players
- `GET /api/players` - Get all players
- `GET /api/players/{id}` - Get a specific player
- `POST /api/players` - Create a new player
- `PUT /api/players/{id}` - Update a player
- `DELETE /api/players/{id}` - Delete a player

### Decks
- `GET /api/decks` - Get all decks
- `GET /api/decks/{id}` - Get a specific deck
- `POST /api/decks` - Create a new deck
- `PUT /api/decks/{id}` - Update a deck
- `DELETE /api/decks/{id}` - Delete a deck

### Matches
- `GET /api/matches` - Get all matches (paginated)
- `GET /api/matches/recent` - Get recent matches
- `GET /api/matches/{id}` - Get a specific match
- `POST /api/matches` - Record a new match
- `DELETE /api/matches/{id}` - Delete a match

### Leaderboard
- `GET /api/leaderboard/players` - Get player leaderboard
- `GET /api/leaderboard/decks` - Get deck leaderboard
- `GET /api/leaderboard/stats` - Get dashboard statistics

## Environment Variables

See `.env.example` for available configuration options:

- `MONGODB_URL` - MongoDB connection string
- `DATABASE_NAME` - Database name
- `CORS_ORIGINS` - Allowed CORS origins
- `API_TITLE`, `API_VERSION`, `API_DESCRIPTION` - API metadata

## Docker Services

The application consists of three Docker services:

1. **mongodb** - MongoDB database (port 27017)
2. **backend** - FastAPI application (port 8000)
3. **frontend** - React application served by Nginx (port 80)

## Development Notes

- The backend uses Beanie ODM for MongoDB operations
- Frontend proxies API requests to the backend during development
- In production, Nginx handles both static files and API proxying
- Hot reload is enabled for both backend and frontend in development mode

## Future Enhancements

- Full implementation of dashboard statistics
- Complete match recording UI with deck selection
- Player and deck management interfaces
- Match history and details view
- Data visualization and charts
- Export/import functionality

## License

MIT
