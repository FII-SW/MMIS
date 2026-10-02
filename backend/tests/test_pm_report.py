"""
Unit tests for the PM report helpers (period grouping + overdue at a point in time).
Run: cd backend && python -m unittest tests.test_pm_report
"""
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.routes.pm_report import build_periods, last_covering, overdue_at
from app.utils.pm_schedule import pm_due_at

UTC = timezone.utc


def _fixture(fixture_id=1):
    return SimpleNamespace(fixture_id=fixture_id)


class TestBuildPeriods(unittest.TestCase):
    def test_weeks_start_monday_and_are_clipped_to_range(self):
        start = datetime(2026, 9, 2, 8, tzinfo=UTC)  # Wednesday
        end = datetime(2026, 9, 17, tzinfo=UTC)  # Thursday
        periods = build_periods(start, end, "week", UTC)
        self.assertEqual([p["start"] for p in periods], [
            start,
            datetime(2026, 9, 7, tzinfo=UTC),
            datetime(2026, 9, 14, tzinfo=UTC),
        ])
        self.assertEqual(periods[-1]["end"], end)
        self.assertEqual(periods[1]["label"], "WW37 · Sep 7 – Sep 13, 2026")

    def test_days_and_months(self):
        start = datetime(2026, 1, 30, tzinfo=UTC)
        end = datetime(2026, 3, 2, tzinfo=UTC)
        self.assertEqual(len(build_periods(start, end, "day", UTC)), 31)
        months = build_periods(start, end, "month", UTC)
        self.assertEqual([p["label"] for p in months], ["January 2026", "February 2026", "March 2026"])
        self.assertEqual(months[1]["start"], datetime(2026, 2, 1, tzinfo=UTC))

    def test_periods_follow_local_midnight(self):
        tz = timezone(timedelta(hours=-5))
        start = datetime(2026, 9, 1, 5, tzinfo=UTC)  # local midnight
        end = datetime(2026, 9, 3, 5, tzinfo=UTC)
        periods = build_periods(start, end, "day", tz)
        self.assertEqual([p["start"] for p in periods], [start, datetime(2026, 9, 2, 5, tzinfo=UTC)])


class TestOverdueAt(unittest.TestCase):
    # Monday of WW40, noon UTC (same date in plant time)
    NOW = datetime(2026, 9, 28, 12, tzinfo=UTC)

    def test_overdue_when_last_work_week_was_missed(self):
        baseline = self.NOW - timedelta(days=60)
        last = self.NOW - timedelta(days=9)  # Sat of WW38 -> due by end of WW39
        record_times = {(1, "weekly"): [last]}
        (row,) = overdue_at([(_fixture(), "weekly", baseline)], record_times, self.NOW)
        self.assertEqual(row[2], pm_due_at("weekly", last, baseline))
        self.assertLess(row[2], self.NOW)
        self.assertEqual(row[3], last)

    def test_not_overdue_inside_interval(self):
        record_times = {(1, "weekly"): [self.NOW - timedelta(days=3)]}
        pairs = [(_fixture(), "weekly", self.NOW - timedelta(days=60))]
        self.assertEqual(overdue_at(pairs, record_times, self.NOW), [])

    def test_state_at_an_earlier_time_ignores_later_records(self):
        record_times = {(1, "weekly"): [self.NOW - timedelta(days=20), self.NOW - timedelta(days=1)]}
        pairs = [(_fixture(), "weekly", self.NOW - timedelta(days=60))]
        self.assertEqual(overdue_at(pairs, record_times, self.NOW), [])
        self.assertEqual(len(overdue_at(pairs, record_times, self.NOW - timedelta(days=2))), 1)

    def test_never_done_is_due_by_end_of_first_work_week(self):
        pairs = [(_fixture(), "weekly", self.NOW - timedelta(hours=2))]  # this week
        self.assertEqual(overdue_at(pairs, {}, self.NOW), [])
        pairs = [(_fixture(), "weekly", self.NOW - timedelta(days=5))]  # last week, ended without a PM
        self.assertEqual(len(overdue_at(pairs, {}, self.NOW)), 1)

    def test_no_baseline_is_never_overdue(self):
        self.assertEqual(overdue_at([(_fixture(), "monthly", None)], {}, self.NOW), [])

    def test_biweekly_covers_weekly(self):
        record_times = {(1, "biweekly"): [self.NOW - timedelta(days=2)]}
        self.assertEqual(last_covering(record_times, 1, "weekly", self.NOW), self.NOW - timedelta(days=2))
        pairs = [(_fixture(), "weekly", self.NOW - timedelta(days=60))]
        self.assertEqual(overdue_at(pairs, record_times, self.NOW), [])


if __name__ == "__main__":
    unittest.main()
