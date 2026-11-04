"""
Verify FBT / ICT / KEYSIGHT / BSI PM checklist configuration.
Run from backend/: python -m unittest tests.test_pm_checklists -v
"""
import unittest

from app.utils.pm_checklists import (
    get_checklist,
    get_pm_types,
    is_bsi_test_area,
    is_fbt_test_area,
    is_ict_test_area,
    is_keysight_test_area,
)


class TestPMChecklists(unittest.TestCase):
    def test_pm_types_per_test_area(self):
        for area in ("FBT_Mobo", "FBT_Agora"):
            self.assertTrue(is_fbt_test_area(area))
            self.assertEqual(get_pm_types(area), ["weekly", "biweekly"])
        for area in ("ICT_Mobo", "ICT_Agora"):
            self.assertTrue(is_ict_test_area(area))
            self.assertEqual(get_pm_types(area, "Bondi Beach"), ["monthly"])
            self.assertEqual(get_pm_types(area, "Astoria"), ["monthly"])
        self.assertTrue(is_keysight_test_area("3070"))
        self.assertEqual(get_pm_types("3070", "Keysight"), ["monthly"])
        for area in ("BSI_Mobo", "BSI_Zebra", "BSI"):
            self.assertTrue(is_bsi_test_area(area))
            self.assertEqual(get_pm_types(area), ["weekly", "biweekly", "monthly"])
        for area in ("TOOLS", "ORT", "L10_Racks", None, ""):
            self.assertEqual(get_pm_types(area), [])
            self.assertIsNone(get_checklist("weekly", area))
            self.assertIsNone(get_checklist("monthly", area))

    def test_ict_fixture_excluded_projects(self):
        for project in ("IC Programming", "Hi-Lo", "Keysight", "Flying Probe"):
            self.assertEqual(get_pm_types("ICT_Mobo", project), [])
            self.assertIsNone(get_checklist("monthly", "ICT_Mobo", project_name=project))
            self.assertEqual(get_pm_types("ICT_Agora", project), [])

    def test_types_do_not_cross_families(self):
        self.assertIsNone(get_checklist("monthly", "FBT_Mobo"))
        self.assertIsNone(get_checklist("weekly", "ICT_Mobo", project_name="Bondi Beach"))
        self.assertIsNone(get_checklist("biweekly", "ICT_Agora", project_name="Astoria"))
        self.assertIsNone(get_checklist("quarterly", "BSI_Mobo"))
        self.assertIsNone(get_checklist("weekly", "3070", project_name="Keysight"))

    def test_task_counts(self):
        self.assertEqual(len(get_checklist("weekly", "FBT_Mobo")["items"]), 3 + 7)
        self.assertEqual(len(get_checklist("biweekly", "FBT_Mobo")["items"]), 3 + 14)
        ict = get_checklist("monthly", "ICT_Mobo", project_name="Bondi Beach")
        self.assertEqual(ict["title"], "GL6 ICT Fixtures PM - Monthly PM")
        self.assertEqual(len(ict["items"]), 15)
        self.assertEqual(ict["interval_days"], 30)
        self.assertTrue(ict["requires_details"])
        keysight = get_checklist("monthly", "3070", project_name="Keysight")
        self.assertEqual(len(keysight["items"]), 11)
        self.assertEqual(keysight["title"], "Keysight i3070 System PM - Monthly PM")
        self.assertIn("DOC-001523", keysight["reference"])
        self.assertFalse(keysight["requires_details"])
        for pm_type in ("weekly", "biweekly", "monthly"):
            bsi = get_checklist(pm_type, "BSI_Mobo")
            self.assertEqual(len(bsi["items"]), 13)
            self.assertTrue(bsi["requires_details"])

    def test_item_ids_are_unique(self):
        samples = (
            ("FBT_Agora", None),
            ("ICT_Agora", "Bondi Beach"),
            ("BSI_Mobo", None),
            ("3070", "Keysight"),
        )
        for area, project in samples:
            for pm_type in get_pm_types(area, project):
                ids = [
                    item["id"]
                    for item in get_checklist(pm_type, area, project_name=project)["items"]
                ]
                self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main()
