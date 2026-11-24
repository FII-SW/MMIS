"""PM due dates — calendar work weeks; monthly/quarterly roll from last performed date."""
import unittest
from datetime import datetime, timezone

from app.utils.pm_schedule import pm_due_at

UTC = timezone.utc


def _at(y, m, d, h=12):
    return datetime(y, m, d, h, tzinfo=UTC)


def _end(y, m, d):
    """End of calendar day d in UTC (matches pm_due_at with tz=UTC)."""
    return datetime(y, m, d, 23, 59, 59, tzinfo=UTC)


class PmDueAtTests(unittest.TestCase):
    def test_weekly_done_this_week_due_end_of_next_week(self):
        # Wed Sep 23 → this week Mon Sep 21 → +2 weeks = Mon Oct 5 → due Sun Oct 4
        self.assertEqual(pm_due_at("weekly", _at(2026, 9, 23), None, UTC), _end(2026, 10, 4))

    def test_weekly_done_sunday_still_same_week(self):
        self.assertEqual(pm_due_at("weekly", _at(2026, 9, 27), None, UTC), _end(2026, 10, 4))

    def test_biweekly_done_this_period_due_end_of_next_period(self):
        # Sep 23 week start Sep 21 → +3 weeks (count+1) = Oct 12 → due Oct 11 (end WW41)
        self.assertEqual(pm_due_at("biweekly", _at(2026, 9, 23), None, UTC), _end(2026, 10, 11))

    def test_monthly_rolls_one_month_from_performed_date(self):
        # Early-in-month completion must not jump to end of next month (~60 days).
        self.assertEqual(pm_due_at("monthly", _at(2026, 9, 3), None, UTC), _end(2026, 10, 3))
        self.assertEqual(pm_due_at("monthly", _at(2026, 9, 15), None, UTC), _end(2026, 10, 15))
        self.assertEqual(pm_due_at("monthly", _at(2026, 12, 10), None, UTC), _end(2027, 1, 10))

    def test_monthly_clamps_short_months(self):
        self.assertEqual(pm_due_at("monthly", _at(2026, 1, 31), None, UTC), _end(2026, 2, 28))
        self.assertEqual(pm_due_at("monthly", _at(2024, 1, 31), None, UTC), _end(2024, 2, 29))

    def test_quarterly_rolls_three_months_from_performed_date(self):
        self.assertEqual(pm_due_at("quarterly", _at(2026, 9, 10), None, UTC), _end(2026, 12, 10))
        self.assertEqual(pm_due_at("quarterly", _at(2026, 11, 5), None, UTC), _end(2027, 2, 5))

    def test_never_done_due_end_of_current_period(self):
        now = _at(2026, 9, 24)
        self.assertEqual(pm_due_at("weekly", None, now, UTC), _end(2026, 9, 27))
        self.assertEqual(pm_due_at("monthly", None, now, UTC), _end(2026, 9, 30))
        self.assertEqual(pm_due_at("quarterly", None, now, UTC), _end(2026, 9, 30))

    def test_resume_baseline_pushes_due_to_end_of_resume_period(self):
        # Last PM long ago would be overdue; resume mid-September → due end of Sep
        last = _at(2026, 1, 5)
        resume = _at(2026, 9, 10)
        self.assertEqual(pm_due_at("monthly", last, resume, UTC), _end(2026, 9, 30))

    def test_resume_does_not_shorten_when_last_already_covers_further(self):
        # Done Sep 20 → rolling due Oct 20; resume Sep 10 must not pull due back to Sep 30
        last = _at(2026, 9, 20)
        resume = _at(2026, 9, 10)
        self.assertEqual(pm_due_at("monthly", last, resume, UTC), _end(2026, 10, 20))


if __name__ == "__main__":
    unittest.main()
