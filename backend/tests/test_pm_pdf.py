"""
Verify a PM record renders to a PDF.
Run from backend/: python -m unittest tests.test_pm_pdf -v
"""
import importlib.util
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

HAS_REPORTLAB = importlib.util.find_spec("reportlab") is not None


@unittest.skipUnless(HAS_REPORTLAB, "reportlab not installed")
class TestPMPdf(unittest.TestCase):
    def _record(self, pm_type, test_area, result="passed"):
        return {
            "pm_id": 1,
            "fixture_id": 10,
            "pm_type": pm_type,
            "overall_result": result,
            "checklist": [
                {"item_id": "a", "section": "S", "task": "Clean fans & filters <test>", "result": result},
                {"item_id": "b", "section": "S", "task": "Run AutoAdjust", "result": "na"},
            ],
            "notes": "Replaced\nfilter" if result == "failed" else None,
            "parts_replaced": None,
            "indysoft_recorded": True,
            "project_name": "Athena",
            "test_area": test_area,
            "performed_by": "cinthya.barbosa",
            "performed_at": datetime(2026, 9, 2, 15, 30, tzinfo=timezone.utc),
        }

    def test_renders_ict_and_fbt(self):
        from app.utils.pm_pdf import build_pm_record_pdf

        fixture = SimpleNamespace(fixture_name="KEYSIGHT 3070 10", asset_tag="A-1", test_area="ICT_Mobo", project_name="Athena")
        for pm_type, area, result in (("monthly", "ICT_Mobo", "passed"), ("weekly", "FBT_Mobo", "failed")):
            pdf = build_pm_record_pdf(self._record(pm_type, area, result), fixture, "America/Chicago")
            self.assertTrue(pdf.startswith(b"%PDF"))

    def test_invalid_timezone_falls_back(self):
        from app.utils.pm_pdf import build_pm_record_pdf

        pdf = build_pm_record_pdf(self._record("monthly", "ICT_Agora"), None, "Not/AZone")
        self.assertTrue(pdf.startswith(b"%PDF"))


if __name__ == "__main__":
    unittest.main()
