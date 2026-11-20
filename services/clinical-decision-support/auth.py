"""Shared-JWT staff authentication for the LangGraph clinical service."""
import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from fastapi import Header, HTTPException, status

STAFF_ROLES = {
    "doctor", "nurse", "receptionist", "admin", "pharmacist", "medrecordofficer",
    "labreceptionist", "labtechnician", "radiologist", "labsupervisor", "labadmin",
    "billingofficer", "claimsauditor", "insuranceofficer", "provideradmin",
}


def _decode(segment: str) -> bytes:
    return base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))


def verify_token(token: str, secret: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid token")
    header = json.loads(_decode(parts[0]))
    if header.get("alg") != "HS256":
        raise ValueError("Invalid token")
    expected = hmac.new(secret.encode(), f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _decode(parts[2])):
        raise ValueError("Invalid token")
    payload = json.loads(_decode(parts[1]))
    if payload.get("exp") and time.time() >= float(payload["exp"]):
        raise ValueError("Token expired")
    return payload


def require_staff(authorization: Optional[str] = Header(default=None)) -> dict:
    secret = os.environ.get("JWT_SECRET", "")
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "JWT_SECRET is not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    try:
        user = verify_token(authorization[7:], secret)
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if user.get("role") not in STAFF_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This role cannot use clinical decision support")
    return user
