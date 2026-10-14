from datetime import date, datetime

import pytest

from app.services.seasons import (
    days_remaining,
    get_season,
    list_seasons,
    parse_season_param,
    season_number_for_date,
)


@pytest.mark.parametrize("d, expected", [
    (date(2026, 9, 30), None),
    (date(2020, 1, 1), None),
    (date(2026, 10, 1), 1),
    (date(2026, 12, 31), 1),
    (date(2027, 1, 1), 2),
    (date(2027, 3, 31), 2),
    (date(2027, 4, 1), 3),
    (date(2027, 12, 31), 5),
    (date(2028, 2, 29), 6),
    (datetime(2026, 10, 1, 0, 0), 1),
])
def test_season_number_for_date(d, expected):
    assert season_number_for_date(d) == expected


def test_season_1_bounds():
    s = get_season(1)
    assert (s.year, s.quarter) == (2026, 4)
    assert s.start == date(2026, 10, 1)
    assert s.end_exclusive == date(2027, 1, 1)
    assert s.end_inclusive == date(2026, 12, 31)
    assert s.label == "Season 1"
    assert s.quarter_label == "Q4 2026"


@pytest.mark.parametrize("n", range(1, 41))
def test_get_season_round_trip(n):
    s = get_season(n)
    assert season_number_for_date(s.start) == n
    assert season_number_for_date(s.end_inclusive) == n
    assert season_number_for_date(s.end_exclusive) == n + 1


def test_get_season_invalid():
    with pytest.raises(ValueError):
        get_season(0)


def test_list_seasons():
    assert list_seasons(date(2026, 9, 1)) == []
    assert [s.number for s in list_seasons(date(2027, 5, 1))] == [3, 2, 1]


def test_days_remaining():
    s = get_season(1)
    assert days_remaining(s, date(2026, 12, 31)) == 1
    assert days_remaining(s, date(2026, 10, 14)) == 79
    assert days_remaining(s, date(2027, 1, 5)) == 0


class TestParseSeasonParam:
    today = date(2027, 2, 1)  # Season 2

    def test_current_default(self):
        for raw in (None, "", "current", "CURRENT"):
            scope = parse_season_param(raw, self.today)
            assert scope.kind == "season" and scope.season.number == 2

    def test_all(self):
        scope = parse_season_param("all", self.today)
        assert scope.is_all and scope.season is None and scope.date_bounds() is None

    def test_number(self):
        scope = parse_season_param("1", self.today)
        assert scope.season.number == 1
        start, end = scope.date_bounds()
        assert start == datetime(2026, 10, 1) and end == datetime(2027, 1, 1)
        assert scope.includes(date(2026, 12, 31))
        assert not scope.includes(date(2027, 1, 1))

    @pytest.mark.parametrize("raw", ["0", "-1", "3", "99", "abc", "1.5"])
    def test_invalid(self, raw):
        with pytest.raises(ValueError):
            parse_season_param(raw, self.today)

    def test_preseason_current_is_all_time(self):
        assert parse_season_param("current", date(2026, 9, 1)).is_all
