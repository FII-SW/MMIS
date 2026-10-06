"""
Run: cd backend && python -m unittest tests.test_super_admin
"""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.utils.app_settings import clean_setting, setting_int
from app.utils.audit import changed_fields
from app.utils.auth_deps import _password_change_allowed
from app.utils.notifications import fixture_list
from app.utils.roles import can_edit, is_admin, is_super_admin, normalize_role


class TestRoles(unittest.TestCase):
    def test_normalize_spellings(self):
        for spelling in ("superadmin", "Super Admin", "super_admin", "SUPER-ADMIN", " SuperAdmin "):
            self.assertEqual(normalize_role(spelling), "superadmin")
        self.assertEqual(normalize_role("Admin"), "admin")
        self.assertEqual(normalize_role(None), "")

    def test_super_admin_has_admin_access(self):
        self.assertTrue(is_admin("superadmin"))
        self.assertTrue(is_admin("admin"))
        self.assertFalse(is_admin("user"))
        self.assertFalse(is_admin(None))

    def test_viewer_is_read_only(self):
        self.assertEqual(normalize_role("Viewer"), "viewer")
        self.assertFalse(can_edit("viewer"))
        self.assertFalse(is_admin("viewer"))
        for role in ("user", "admin", "superadmin"):
            self.assertTrue(can_edit(role))

    def test_only_super_admin_is_super(self):
        self.assertTrue(is_super_admin("Super Admin"))
        self.assertFalse(is_super_admin("admin"))
        self.assertFalse(is_super_admin("user"))


class TestChangedFields(unittest.TestCase):
    def test_only_differences(self):
        obj = SimpleNamespace(item_name="Pogo pin", item_min_count=5, item_unit=None)
        changes = changed_fields(obj, {"item_name": "Pogo pin", "item_min_count": 10, "item_unit": "pcs"})
        self.assertEqual(
            changes,
            {"item_min_count": {"from": 5, "to": 10}, "item_unit": {"from": None, "to": "pcs"}},
        )

    def test_no_changes(self):
        obj = SimpleNamespace(employee_name="Alex")
        self.assertEqual(changed_fields(obj, {"employee_name": "Alex"}), {})


class TestCleanSetting(unittest.TestCase):
    def test_bool(self):
        self.assertEqual(clean_setting("low_stock_emails", True), "true")
        self.assertEqual(clean_setting("low_stock_emails", "False"), "false")
        with self.assertRaises(HTTPException):
            clean_setting("low_stock_emails", "maybe")

    def test_date(self):
        self.assertEqual(clean_setting("pm_start_date", "2026-09-28"), "2026-09-28")
        self.assertEqual(clean_setting("pm_start_date", ""), "")
        with self.assertRaises(HTTPException):
            clean_setting("pm_start_date", "28/09/2026")

    def test_unknown_key(self):
        with self.assertRaises(HTTPException):
            clean_setting("not_a_setting", "x")

    def test_assignment_email_toggle(self):
        self.assertEqual(clean_setting("pm_assignment_emails", False), "false")

    def test_overdue_alert_days(self):
        self.assertEqual(clean_setting("pm_overdue_alert_days", " 5 "), "5")
        self.assertEqual(clean_setting("pm_overdue_alert_days", 60), "60")
        for bad in ("0", "61", "three", "", "2.5"):
            with self.assertRaises(HTTPException):
                clean_setting("pm_overdue_alert_days", bad)


class TestSettingInt(unittest.TestCase):
    def _value(self, stored):
        with patch("app.utils.app_settings.get_setting", return_value=stored):
            return setting_int(None, "pm_overdue_alert_days")

    def test_saved_value(self):
        self.assertEqual(self._value("7"), 7)

    def test_out_of_range_is_clamped(self):
        self.assertEqual(self._value("0"), 1)
        self.assertEqual(self._value("500"), 60)

    def test_garbage_falls_back_to_default(self):
        self.assertEqual(self._value("abc"), 3)


class TestPasswordChangeAllowed(unittest.TestCase):
    def _allowed(self, method, path):
        return _password_change_allowed(SimpleNamespace(method=method, url=SimpleNamespace(path=path)))

    def test_change_password_and_me_are_allowed(self):
        self.assertTrue(self._allowed("PUT", "/api/employees/12/change-password"))
        self.assertTrue(self._allowed("GET", "/api/auth/me"))

    def test_reading_profile_and_notifications_is_allowed(self):
        self.assertTrue(self._allowed("GET", "/api/employees/12"))
        self.assertTrue(self._allowed("GET", "/api/notifications/"))

    def test_everything_else_is_blocked(self):
        self.assertFalse(self._allowed("PUT", "/api/employees/12"))
        self.assertFalse(self._allowed("POST", "/api/notifications/read-all"))
        self.assertFalse(self._allowed("GET", "/api/inventory/items"))
        self.assertFalse(self._allowed("GET", "/api/maintenance/my-fixtures"))


class TestFixtureList(unittest.TestCase):
    def test_short_list(self):
        self.assertEqual(fixture_list(["A", "B"]), "A, B")

    def test_long_list_is_trimmed(self):
        names = [f"F{i}" for i in range(12)]
        self.assertEqual(fixture_list(names, limit=3), "F0, F1, F2 and 9 more")


if __name__ == "__main__":
    unittest.main()
