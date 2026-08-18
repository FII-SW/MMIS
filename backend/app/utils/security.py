# backend/app/utils/security.py
# ----------------------------------------------------------
# Password hashing via bcrypt (no passlib — avoids bcrypt 4.1+ breakage).
# ----------------------------------------------------------
import bcrypt


def hash_password(password: str) -> str:
    """Return the hashed version of a plain-text password."""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compare plain password with its bcrypt hash."""
    if not hashed_password:
        return False
    # PHP/other systems may use $2y$; Python bcrypt expects $2a$/$2b$
    hash_str = hashed_password
    if hash_str.startswith("$2y$"):
        hash_str = "$2b$" + hash_str[4:]
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hash_str.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False
