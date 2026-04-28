from functools import wraps

from flask import g, request
from itsdangerous import URLSafeSerializer

from .config import Config
from .models import User


def _serializer():
    return URLSafeSerializer(Config.SECRET_KEY, salt="edutech-auth")


def create_token(user: User) -> str:
    return _serializer().dumps({"user_id": user.id, "role": user.role})


def read_token(token: str):
    try:
        return _serializer().loads(token)
    except Exception:
        return None


def require_auth(role=None):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return {"message": "Missing bearer token."}, 401
            token = header.replace("Bearer ", "", 1).strip()
            payload = read_token(token)
            if not payload:
                return {"message": "Invalid token."}, 401
            user = User.query.get(payload.get("user_id"))
            if not user:
                return {"message": "User not found."}, 401
            if role and user.role != role:
                return {"message": "Forbidden."}, 403
            g.current_user = user
            return fn(*args, **kwargs)

        return wrapped

    return decorator
