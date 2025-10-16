from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, close_db
from app.routers import players, decks, matches, leaderboard, scryfall


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(players.router, prefix="/api/players", tags=["players"])
app.include_router(decks.router, prefix="/api/decks", tags=["decks"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(scryfall.router, prefix="/api/scryfall", tags=["scryfall"])


@app.get("/")
async def root():
    return {
        "message": "MTG Commander Leaderboard API",
        "version": settings.api_version,
        "docs": "/docs"
    }
