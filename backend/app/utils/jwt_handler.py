# backend/app/utils/jwt_handler.py
# ----------------------------------------------------------
# Generates and decodes JWT tokens for authentication.
# ----------------------------------------------------------
import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

# Use JWT_SECRET_KEY in production. Default matches legacy deployments so existing sessions stay valid.
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))


def create_access_token(data: dict):
    """Encode payload into JWT with expiry."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": int(expire.timestamp())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str):
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
