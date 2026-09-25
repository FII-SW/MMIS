"""
Verify FBT (weekly/biweekly) and ICT (monthly) PM checklist configuration.
Run from backend/: python -m unittest tests.test_pm_checklists -v
"""
import unittest

from app.utils.pm_checklists import (
    get_checklist,
    get_pm_types,
    is_fbt_test_area,
    is_ict_test_area,
)


class TestPMChecklists(unittest.TestCase):
    def test_pm_types_per_test_area(self):
        for area in ("FBT_Mobo", "FBT_Agora"):
            self.assertTrue(is_fbt_test_area(area))
            self.assertEqual(get_pm_types(area), ["weekly", "biweekly"])
        for area in ("ICT_Mobo", "ICT_Agora"):
            self.assertTrue(is_ict_test_area(area))
            self.assertEqual(get_pm_types(area), ["monthly"])
        for area in ("BSI_Mobo", "TOOLS", "ORT", "L10_Racks", None, ""):
            self.assertEqual(get_pm_types(area), [])
            self.assertIsNone(get_checklist("weekly", area))
            self.assertIsNone(get_checklist("monthly", area))

    def test_types_do_not_cross_families(self):
        self.assertIsNone(get_checklist("monthly", "FBT_Mobo"))
        self.assertIsNone(get_checklist("weekly", "ICT_Mobo"))
        self.assertIsNone(get_checklist("biweekly", "ICT_Agora"))

    def test_task_counts(self):
        self.assertEqual(len(get_checklist("weekly", "FBT_Mobo")["items"]), 3 + 7)
        self.assertEqual(len(get_checklist("biweekly", "FBT_Mobo")["items"]), 3 + 14)
        ict = get_checklist("monthly", "ICT_Mobo")
        self.assertEqual(len(ict["items"]), 11)
        self.assertEqual(ict["interval_days"], 30)
        self.assertIn("DOC-001523", ict["reference"])

    def test_item_ids_are_unique(self):
        for area in ("FBT_Agora", "ICT_Agora"):
            for pm_type in get_pm_types(area):
                ids = [item["id"] for item in get_checklist(pm_type, area)["items"]]
                self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main()
