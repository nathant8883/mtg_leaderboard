"""
Season calendar: quarterly seasons derived purely from dates.

Season 1 is Q4 2026 (Oct 1 - Dec 31 2026); each calendar quarter after that
is the next season. Everything played before Season 1 is the Founder's
Season (season 0): one long, already-finished season.
"""

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from app.config import settings

SEASON_1_YEAR = 2026
SEASON_1_QUARTER = 4

# Absolute quarter index of Season 1 (year * 4 + zero-based quarter)
_SEASON_1_INDEX = SEASON_1_YEAR * 4 + (SEASON_1_QUARTER - 1)

# Season 0: every match before Season 1
FOUNDERS_SEASON = 0
_FOUNDERS_START = date(2000, 1, 1)  # Earlier than any match; keeps Mongo date bounds sane


def _quarter_start(year: int, quarter: int) -> date:
    return date(year, (quarter - 1) * 3 + 1, 1)


@dataclass(frozen=True)
class Season:
    number: int
    year: int
    quarter: int
    start: date
    end_exclusive: date  # First day of the next season; ranges are [start, end_exclusive)

    @property
    def end_inclusive(self) -> date:
        return date.fromordinal(self.end_exclusive.toordinal() - 1)

    @property
    def label(self) -> str:
        if self.number == FOUNDERS_SEASON:
            return "Founder's Season"
        return f"Season {self.number}"

    @property
    def quarter_label(self) -> str:
        if self.number == FOUNDERS_SEASON:
            return "Before Season 1"
        return f"Q{self.quarter} {self.year}"

    def contains(self, d: date) -> bool:
        return self.start <= d < self.end_exclusive


def get_season(number: int) -> Season:
    if number < 0:
        raise ValueError(f"Invalid season number: {number}")
    if number == FOUNDERS_SEASON:
        return Season(
            number=FOUNDERS_SEASON,
            year=0,
            quarter=0,
            start=_FOUNDERS_START,
            end_exclusive=_quarter_start(SEASON_1_YEAR, SEASON_1_QUARTER),
        )
    idx = _SEASON_1_INDEX + (number - 1)
    year, quarter = idx // 4, idx % 4 + 1
    next_idx = idx + 1
    return Season(
        number=number,
        year=year,
        quarter=quarter,
        start=_quarter_start(year, quarter),
        end_exclusive=_quarter_start(next_idx // 4, next_idx % 4 + 1),
    )


def season_number_for_date(d: date) -> int:
    """Season number a date falls in (0 = Founder's Season, before Season 1)."""
    if isinstance(d, datetime):
        d = d.date()
    n = (d.year * 4 + (d.month - 1) // 3) - _SEASON_1_INDEX + 1
    return max(n, FOUNDERS_SEASON)


def current_season(today: date) -> Optional[Season]:
    """The quarterly season in progress (None before Season 1 starts)."""
    n = season_number_for_date(today)
    return get_season(n) if n >= 1 else None


def list_seasons(today: date) -> list[Season]:
    """Seasons that have started as of today, newest first, ending with the Founder's Season."""
    n = season_number_for_date(today)
    return [get_season(i) for i in range(n, -1, -1)] if n >= 1 else []


def days_remaining(season: Season, today: date) -> int:
    """Days left in the season including today (0 once it has ended)."""
    return max(0, (season.end_exclusive - today).days)


def season_today() -> date:
    """Today's date in the season timezone (season rollover happens at local midnight)."""
    if settings.season_today_override:
        return settings.season_today_override
    return datetime.now(ZoneInfo(settings.season_timezone)).date()


@dataclass(frozen=True)
class SeasonScope:
    """What a stats request is filtered to: one season, or all time."""
    kind: Literal["season", "all"]
    season: Optional[Season] = None

    @property
    def is_all(self) -> bool:
        return self.kind == "all"

    def date_bounds(self) -> Optional[tuple[datetime, datetime]]:
        """Datetime bounds for Mongo queries (Beanie stores `date` as midnight datetimes)."""
        if self.season is None:
            return None
        return (
            datetime.combine(self.season.start, time.min),
            datetime.combine(self.season.end_exclusive, time.min),
        )

    def includes(self, d: date) -> bool:
        if self.season is None:
            return True
        if isinstance(d, datetime):
            d = d.date()
        return self.season.contains(d)


ALL_TIME = SeasonScope(kind="all")


def season_to_dict(season: Season, today: date, finalized: Optional[bool] = None) -> dict:
    """API representation of a season."""
    data = {
        "number": season.number,
        "label": season.label,
        "quarter_label": season.quarter_label,
        "start": season.start.isoformat(),
        "end": season.end_inclusive.isoformat(),
        "is_current": season.contains(today),
        "is_complete": season.end_exclusive <= today,
        "days_remaining": days_remaining(season, today),
    }
    if finalized is not None:
        data["finalized"] = finalized
    return data


def parse_season_param(raw: Optional[str], today: date) -> SeasonScope:
    """
    Parse a `?season=` query value.

    - None / "" / "current": the current season (all time during preseason)
    - "all": all time
    - "N": season N (must have started)
    """
    value = (raw or "current").strip().lower()
    if value == "all":
        return ALL_TIME
    if value == "current":
        season = current_season(today)
        return SeasonScope(kind="season", season=season) if season else ALL_TIME
    try:
        n = int(value)
    except ValueError:
        raise ValueError(f"Invalid season: {raw!r}")
    current_n = season_number_for_date(today)
    if n < 0 or n > current_n or (current_n == 0 and n == 0):
        raise ValueError(f"Season {n} does not exist yet")
    return SeasonScope(kind="season", season=get_season(n))
