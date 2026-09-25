"""
Verify PM due-state calculation (never / ok / due_soon / overdue).
Run from backend/: python -m unittest tests.test_pm_status -v
"""
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.routes.maintenance import _fixture_pm, _pm_entry
from app.routes.pm_dashboard import summarize_status
from app.routes.pm_workflow import compute_weekly_compliance

NOW = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)


def _latest(days_ago: float, result: str = "passed", pm_type: str = "weekly"):
    record = SimpleNamespace(
        performed_at=NOW - timedelta(days=days_ago), overall_result=result, pm_type=pm_type
    )
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

    def test_never_done_uses_baseline(self):
        not_due = _pm_entry("biweekly", None, NOW, baseline=NOW - timedelta(days=5))
        self.assertEqual(not_due["state"], "never")
        self.assertEqual(not_due["days_until_due"], 9)

        due_soon = _pm_entry("biweekly", None, NOW, baseline=NOW - timedelta(days=12))
        self.assertEqual(due_soon["state"], "due_soon")

        overdue = _pm_entry("monthly", None, NOW, baseline=NOW - timedelta(days=33))
        self.assertEqual(overdue["state"], "overdue")
        self.assertEqual(overdue["days_until_due"], -3)
        self.assertIsNone(overdue["last_performed_at"])


class TestFixturePM(unittest.TestCase):
    def test_fixture_state_is_most_urgent(self):
        fixture = SimpleNamespace(fixture_id=1, test_area="FBT_Mobo")
        latest_map = {(1, "weekly"): _latest(1), (1, "biweekly"): _latest(20, pm_type="biweekly")}
        pm = _fixture_pm(fixture, latest_map, NOW)
        self.assertEqual(pm["pm_types"], ["weekly", "biweekly"])
        self.assertEqual(pm["state"], "overdue")
        self.assertEqual(pm["days_until_due"], -6)

    def test_due_soon_outranks_not_yet_due(self):
        fixture = SimpleNamespace(fixture_id=2, test_area="FBT_Agora")
        pm = _fixture_pm(fixture, {(2, "weekly"): _latest(6)}, NOW)
        self.assertEqual(pm["state"], "due_soon")

    def test_biweekly_also_completes_weekly(self):
        fixture = SimpleNamespace(fixture_id=4, test_area="FBT_Mobo")
        latest_map = {(4, "weekly"): _latest(10), (4, "biweekly"): _latest(2, pm_type="biweekly")}
        pm = _fixture_pm(fixture, latest_map, NOW)
        self.assertEqual(pm["status"]["weekly"]["state"], "ok")
        self.assertEqual(pm["status"]["weekly"]["covered_by"], "biweekly")
        self.assertIsNone(pm["status"]["biweekly"]["covered_by"])

    def test_tracking_start_makes_unreported_pm_overdue(self):
        fixture = SimpleNamespace(
            fixture_id=5, test_area="ICT_Mobo", created_at=NOW - timedelta(days=400)
        )
        pm = _fixture_pm(fixture, {}, NOW, tracking_start=NOW - timedelta(days=31))
        self.assertEqual(pm["state"], "overdue")

    def test_new_fixture_gets_its_own_grace_period(self):
        fixture = SimpleNamespace(fixture_id=6, test_area="ICT_Mobo", created_at=NOW - timedelta(days=3))
        pm = _fixture_pm(fixture, {}, NOW, tracking_start=NOW - timedelta(days=90))
        self.assertEqual(pm["state"], "never")
        self.assertEqual(pm["days_until_due"], 27)

    def test_non_pm_area(self):
        fixture = SimpleNamespace(fixture_id=3, test_area="BSI_Mobo")
        pm = _fixture_pm(fixture, {}, NOW)
        self.assertEqual(pm["pm_types"], [])
        self.assertIsNone(pm["state"])

    def test_paused_fixture_is_never_overdue(self):
        fixture = SimpleNamespace(fixture_id=7, test_area="FBT_Mobo", pm_paused=True)
        pm = _fixture_pm(fixture, {(7, "weekly"): _latest(30)}, NOW)
        self.assertEqual(pm["state"], "paused")
        self.assertEqual({e["state"] for e in pm["status"].values()}, {"paused"})
        self.assertIsNone(pm["days_until_due"])

    def test_resume_restarts_grace_period(self):
        fixture = SimpleNamespace(
            fixture_id=8,
            test_area="ICT_Mobo",
            created_at=NOW - timedelta(days=400),
            pm_paused=False,
            pm_resumed_at=NOW - timedelta(days=2),
        )
        pm = _fixture_pm(fixture, {}, NOW, tracking_start=NOW - timedelta(days=90))
        self.assertEqual(pm["state"], "never")
        self.assertEqual(pm["days_until_due"], 28)


def _dashboard_fixture(fixture_id, test_area, project="P1"):
    return SimpleNamespace(
        fixture_id=fixture_id,
        fixture_name=f"FX{fixture_id}",
        project_name=project,
        test_area=test_area,
        asset_tag=None,
        fixture_serial_number=None,
        manufacturer=None,
        production_line=None,
        pm_paused=False,
    )


class TestDashboardStatus(unittest.TestCase):
    def setUp(self):
        fbt = _dashboard_fixture(1, "FBT_Mobo")
        ict = _dashboard_fixture(2, "ICT_Mobo", project="P2")
        latest_map = {(1, "weekly"): _latest(9), (1, "biweekly"): _latest(1, pm_type="biweekly"), (2, "monthly"): _latest(3)}
        self.items = [(f, _fixture_pm(f, latest_map, NOW)) for f in (fbt, ict)]

    def test_all_pm_types_uses_worst_state(self):
        status = summarize_status(self.items, None)
        self.assertEqual(status["totals"]["fixtures"], 2)
        self.assertEqual(status["totals"]["ok"], 2)
        self.assertEqual(set(status["by_pm_type"]), {"weekly", "biweekly", "monthly"})
        self.assertEqual(len(status["locations"]), 2)

    def test_pm_type_filter_skips_other_fixtures(self):
        status = summarize_status(self.items, "monthly")
        self.assertEqual(status["totals"]["fixtures"], 1)
        self.assertEqual(list(status["by_pm_type"]), ["monthly"])
        self.assertEqual(status["locations"][0]["project_name"], "P2")

    def test_attention_lists_each_pm_type(self):
        fixture = _dashboard_fixture(3, "FBT_Agora")
        pm = _fixture_pm(fixture, {(3, "weekly"): _latest(10), (3, "biweekly"): _latest(20, pm_type="biweekly")}, NOW)
        status = summarize_status([(fixture, pm)], None)
        self.assertEqual(status["attention_total"], 2)
        self.assertEqual(status["attention"][0]["pm_type"], "biweekly")
        self.assertEqual(status["totals"]["overdue"], 1)


class TestWeeklyCompliance(unittest.TestCase):
    def test_up_to_date_and_counts(self):
        start = NOW - timedelta(days=30)
        pairs = [(1, "weekly", start), (2, "weekly", start), (3, "monthly", NOW - timedelta(days=3))]
        record_times = {
            (1, "weekly"): [NOW - timedelta(days=9), NOW - timedelta(days=2)],
            (2, "weekly"): [NOW - timedelta(days=12)],
        }
        completed = [
            (NOW - timedelta(days=12), False),
            (NOW - timedelta(days=9), True),
            (NOW - timedelta(days=2), False),
        ]
        last_week, this_week = compute_weekly_compliance(
            pairs, record_times, completed, [NOW - timedelta(days=7), NOW]
        )

        self.assertEqual(last_week["tracked"], 2)
        self.assertEqual(last_week["up_to_date"], 2)
        self.assertEqual(last_week["pct"], 100)
        self.assertEqual(last_week["completed"], 2)
        self.assertEqual(last_week["failed"], 1)

        self.assertEqual(this_week["tracked"], 3)
        self.assertEqual(this_week["up_to_date"], 1)
        self.assertEqual(this_week["pct"], 33)
        self.assertEqual(this_week["completed"], 1)
        self.assertEqual(this_week["failed"], 0)

    def test_biweekly_record_counts_for_weekly(self):
        pairs = [(1, "weekly", NOW - timedelta(days=30))]
        record_times = {(1, "biweekly"): [NOW - timedelta(days=3)]}
        (week,) = compute_weekly_compliance(pairs, record_times, [], [NOW])
        self.assertEqual(week["up_to_date"], 1)

    def test_no_tracked_pms_gives_no_percentage(self):
        (week,) = compute_weekly_compliance([(1, "weekly", NOW)], {}, [], [NOW - timedelta(days=7)])
        self.assertEqual(week["tracked"], 0)
        self.assertIsNone(week["pct"])


if __name__ == "__main__":
    unittest.main()
