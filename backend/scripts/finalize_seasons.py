"""
Finalize (or re-finalize) season awards.

Awards are normally finalized lazily by the API; use this to force a
recompute after data fixes.

Usage:
    uv run python -m scripts.finalize_seasons                 # every pod, every completed season (missing/stale only)
    uv run python -m scripts.finalize_seasons --force         # recompute everything
    uv run python -m scripts.finalize_seasons --pod ID --season 1 --force
"""

import argparse
import asyncio

from app.database import init_db
from app.models.pod import Pod
from app.services.season_awards import ensure_pod_seasons_finalized, finalize_season
from app.services.seasons import list_seasons, season_today


async def main(pod: str | None, season: int | None, force: bool) -> None:
    await init_db()

    today = season_today()
    pod_ids = [pod] if pod else [str(p.id) for p in await Pod.find_all().to_list()]
    completed = [s.number for s in list_seasons(today) if s.end_exclusive <= today]
    seasons = [season] if season else completed
    print(f"Today (season tz): {today}; completed seasons: {completed or 'none'}")

    for pid in pod_ids:
        if not force and season is None:
            await ensure_pod_seasons_finalized(pid)
            print(f"Pod {pid}: ensured finalized")
            continue
        for n in seasons:
            awards = await finalize_season(pid, n, force=force)
            print(f"Pod {pid} season {n}: {len(awards)} awards")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pod", help="Pod ID (default: all pods)")
    parser.add_argument("--season", type=int, help="Season number (default: all completed seasons)")
    parser.add_argument("--force", action="store_true", help="Recompute even if already finalized")
    args = parser.parse_args()
    asyncio.run(main(args.pod, args.season, args.force))
