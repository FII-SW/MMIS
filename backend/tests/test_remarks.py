"""
Run: cd backend && python -m unittest tests.test_remarks
"""
import unittest

from app.utils.remarks import clean_remarks


class TestCleanRemarks(unittest.TestCase):
    def test_plain_remarks_unchanged(self):
        self.assertEqual(clean_remarks("Replaced worn pogo pins"), "Replaced worn pogo pins")

    def test_request_link_prefix_is_hidden(self):
        self.assertEqual(clean_remarks("REQUEST_TX_ID:42|Not needed after all"), "Not needed after all")
        self.assertIsNone(clean_remarks("REQUEST_TX_ID:42"))
        self.assertIsNone(clean_remarks("REQUEST_TX_ID:42|  "))

    def test_empty(self):
        self.assertIsNone(clean_remarks(None))
        self.assertIsNone(clean_remarks(""))


if __name__ == "__main__":
    unittest.main()
