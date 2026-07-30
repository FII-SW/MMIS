from .security import hash_password, verify_password


def is_bcrypt_hash(stored_password: str) -> bool:
    return isinstance(stored_password, str) and stored_password.startswith("$2")


def verify_stored_password(plain_password: str, stored_password: str) -> bool:
    if not stored_password:
        return False
    if is_bcrypt_hash(stored_password):
        return verify_password(plain_password, stored_password)
    return plain_password == stored_password


def normalize_password_for_storage(plain_password: str) -> str:
    return hash_password(plain_password)
