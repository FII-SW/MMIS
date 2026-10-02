"""
Calendar PM due dates (work week / month / quarter).
Run from backend/: python -m unittest tests.test_pm_schedule -v
"""
import unittest
from datetime import datetime, timedelta, timezone

from app.utils.pm_schedule import pm_due_at

UTC = timezone.utc


def _at(year, month, day, hour=12):
    return datetime(year, month, day, hour, tzinfo=UTC)


def _end(year, month, day):
    return datetime(year, month, day, 23, 59, 59, tzinfo=UTC)


class TestPMDueAt(unittest.TestCase):
    def test_weekly_due_by_end_of_next_work_week(self):
        # Wed WW38 -> due Sunday of WW39
        self.assertEqual(pm_due_at("weekly", _at(2026, 9, 16), None, UTC), _end(2026, 9, 27))
        # Sunday is still the same work week
        self.assertEqual(pm_due_at("weekly", _at(2026, 9, 20), None, UTC), _end(2026, 9, 27))
        # Monday starts a new one
        self.assertEqual(pm_due_at("weekly", _at(2026, 9, 21), None, UTC), _end(2026, 10, 4))

    def test_never_done_is_due_by_end_of_first_week(self):
        self.assertEqual(pm_due_at("weekly", None, _at(2026, 9, 24), UTC), _end(2026, 9, 27))

    def test_biweekly_within_two_work_weeks(self):
        self.assertEqual(pm_due_at("biweekly", _at(2026, 9, 16), None, UTC), _end(2026, 10, 4))
        self.assertEqual(pm_due_at("biweekly", None, _at(2026, 9, 24), UTC), _end(2026, 10, 4))

    def test_monthly_follows_calendar_months(self):
        self.assertEqual(pm_due_at("monthly", _at(2026, 9, 3), None, UTC), _end(2026, 10, 31))
        self.assertEqual(pm_due_at("monthly", None, _at(2026, 9, 24), UTC), _end(2026, 9, 30))
        self.assertEqual(pm_due_at("monthly", _at(2026, 12, 10), None, UTC), _end(2027, 1, 31))

    def test_quarterly_follows_calendar_quarters(self):
        self.assertEqual(pm_due_at("quarterly", _at(2026, 8, 5), None, UTC), _end(2026, 12, 31))
        self.assertEqual(pm_due_at("quarterly", None, _at(2026, 11, 2), UTC), _end(2026, 12, 31))

    def test_resume_pushes_due_date_to_resume_week(self):
        self.assertEqual(pm_due_at("weekly", _at(2026, 9, 2), _at(2026, 9, 24), UTC), _end(2026, 9, 27))

    def test_old_baseline_does_not_override_recent_record(self):
        self.assertEqual(pm_due_at("weekly", _at(2026, 9, 23), _at(2026, 6, 1), UTC), _end(2026, 10, 4))

    def test_work_week_is_in_plant_time(self):
        plant = timezone(timedelta(hours=-5))
        late_sunday = datetime(2026, 9, 21, 3, tzinfo=UTC)  # Sun Sep 20, 22:00 local -> WW38
        due = pm_due_at("weekly", late_sunday, None, plant)
        self.assertEqual(due, datetime(2026, 9, 27, 23, 59, 59, tzinfo=plant))

    def test_nothing_known(self):
        self.assertIsNone(pm_due_at("weekly", None, None, UTC))


if __name__ == "__main__":
    unittest.main()
