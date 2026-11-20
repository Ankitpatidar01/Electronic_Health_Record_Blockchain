import base64
import hashlib
import hmac
import json
import time

import pytest

from auth import verify_token


SECRET = "unit-test-secret"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _token(payload, header=None):
    head = _b64(json.dumps(header or {"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64(json.dumps(payload).encode())
    signing_input = f"{head}.{body}".encode()
    signature = hmac.new(SECRET.encode(), signing_input, hashlib.sha256).digest()
    return f"{head}.{body}.{_b64(signature)}"


def test_accepts_valid_staff_token():
    token = _token({"userId": "doctor-1", "role": "doctor", "exp": time.time() + 60})
    claims = verify_token(token, SECRET)
    assert claims["userId"] == "doctor-1"
    assert claims["role"] == "doctor"


def test_rejects_expired_token():
    token = _token({"userId": "doctor-1", "role": "doctor", "exp": time.time() - 1})
    with pytest.raises(ValueError, match="expired"):
        verify_token(token, SECRET)


def test_rejects_missing_expiry():
    token = _token({"userId": "doctor-1", "role": "doctor"})
    with pytest.raises(ValueError, match="expiry is required"):
        verify_token(token, SECRET)


def test_rejects_missing_identity_or_role():
    for payload in (
        {"role": "doctor", "exp": time.time() + 60},
        {"userId": "doctor-1", "exp": time.time() + 60},
    ):
        with pytest.raises(ValueError):
            verify_token(_token(payload), SECRET)


def test_rejects_wrong_signature():
    token = _token({"userId": "doctor-1", "role": "doctor", "exp": time.time() + 60})
    with pytest.raises(ValueError):
        verify_token(token, "different-secret")


def test_rejects_non_hs256_algorithm():
    token = _token(
        {"userId": "doctor-1", "role": "doctor", "exp": time.time() + 60},
        {"alg": "none", "typ": "JWT"},
    )
    with pytest.raises(ValueError):
        verify_token(token, SECRET)
