"""
Verify PM due-state calculation (never / ok / due_soon / overdue).
Run from backend/: python -m unittest tests.test_pm_status -v
"""
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.routes.maintenance import _fixture_pm, _pm_entry

NOW = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)


def _latest(days_ago: float, result: str = "passed"):
    record = SimpleNamespace(performed_at=NOW - timedelta(days=days_ago), overall_result=result)
    return record, "Tech"


class TestPMEntry(unittest.TestCase):
    def test_never(self):
        entry = _pm_entry("weekly", None, NOW)
        self.assertEqual(entry["state"], "never")
        self.assertIsNone(entry["days_until_due"])

    def test_weekly_states(self):
        self.assertEqual(_pm_entry("weekly", _latest(1), NOW)["state"], "ok")
        self.assertEqual(_pm_entry("weekly", _latest(5.5), NOW)["state"], "due_soon")
        overdue = _pm_entry("weekly", _latest(9), NOW)
        self.assertEqual(overdue["state"], "overdue")
        self.assertEqual(overdue["days_until_due"], -2)

    def test_monthly_states(self):
        self.assertEqual(_pm_entry("monthly", _latest(10), NOW)["state"], "ok")
        self.assertEqual(_pm_entry("monthly", _latest(27), NOW)["state"], "due_soon")
        self.assertEqual(_pm_entry("monthly", _latest(31), NOW)["state"], "overdue")

    def test_naive_datetime_treated_as_utc(self):
        record = SimpleNamespace(performed_at=(NOW - timedelta(days=1)).replace(tzinfo=None), overall_result="passed")
        self.assertEqual(_pm_entry("weekly", (record, None), NOW)["state"], "ok")


class TestFixturePM(unittest.TestCase):
    def test_fixture_state_is_most_urgent(self):
        fixture = SimpleNamespace(fixture_id=1, test_area="FBT_Mobo")
        latest_map = {(1, "weekly"): _latest(1), (1, "biweekly"): _latest(20)}
        pm = _fixture_pm(fixture, latest_map, NOW)
        self.assertEqual(pm["pm_types"], ["weekly", "biweekly"])
        self.assertEqual(pm["state"], "overdue")
        self.assertEqual(pm["days_until_due"], -6)

    def test_never_outranks_due_soon(self):
        fixture = SimpleNamespace(fixture_id=2, test_area="FBT_Agora")
        pm = _fixture_pm(fixture, {(2, "weekly"): _latest(6)}, NOW)
        self.assertEqual(pm["state"], "never")

    def test_non_pm_area(self):
        fixture = SimpleNamespace(fixture_id=3, test_area="BSI_Mobo")
        pm = _fixture_pm(fixture, {}, NOW)
        self.assertEqual(pm["pm_types"], [])
        self.assertIsNone(pm["state"])


if __name__ == "__main__":
    unittest.main()
