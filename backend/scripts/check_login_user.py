#!/usr/bin/env python3
"""
Diagnose login issues on the server (does not print passwords or password hashes).

Usage (from /var/www/mmis/backend with venv active):
  python scripts/check_login_user.py saketh.gondela
  python scripts/check_login_user.py saketh.gondela --test-password
"""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

# Allow running as: python scripts/check_login_user.py
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app import crud
from app.utils.password_utils import is_bcrypt_hash, verify_stored_password


def main():
    parser = argparse.ArgumentParser(description="Check MMIS login user record")
    parser.add_argument("username", help="Username to look up (case-insensitive)")
    parser.add_argument(
        "--test-password",
        action="store_true",
        help="Prompt for password and test verification (not echoed)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = crud.get_employee_by_username(db, args.username)
        if not user:
            print(f"FAIL: No employee found for username '{args.username.strip()}'")
            print("Tip: List usernames with:")
            print("  psql ... -c \"SELECT employee_id, employee_username, employee_name FROM employees;\"")
            return 1

        stored = user.employee_password or ""
        hash_type = "bcrypt" if is_bcrypt_hash(stored) else "plain-text"
        print(f"OK: Found employee_id={user.employee_id}")
        print(f"    username in DB: {user.employee_username!r}")
        print(f"    name: {user.employee_name!r}")
        print(f"    role: {user.employee_access_level!r}")
        print(f"    password storage: {hash_type} (length={len(stored)})")

        if args.test_password:
            pwd = getpass.getpass("Password to test: ")
            ok = verify_stored_password(pwd, stored)
            print(f"    password verify: {'OK' if ok else 'FAIL — wrong password or corrupt hash'}")
            if not ok:
                return 2
        else:
            print("    (Run with --test-password to verify password without using the API)")

        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
