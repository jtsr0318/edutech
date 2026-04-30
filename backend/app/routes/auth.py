from flask import Blueprint, request
from werkzeug.security import check_password_hash, generate_password_hash
import json
import os
import time

from ..auth import create_token
from ..extensions import db
from ..models import User

auth_bp = Blueprint("auth", __name__)
LOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "debug-46886c.log")


def user_payload(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


def _agent_log(run_id: str, hypothesis_id: str, location: str, message: str, data: dict):
    try:
        entry = {
            "sessionId": "46886c",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with open(LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=True) + "\n")
    except Exception:
        pass


def verify_password(user: User, raw_password: str):
    stored = user.password or ""
    try:
        valid = check_password_hash(stored, raw_password)
        return valid, False
    except ValueError:
        # Backward compatibility for legacy plaintext records.
        valid = stored == raw_password
        return valid, valid


@auth_bp.post("/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = (body.get("password") or "").strip()
    # #region agent log
    _agent_log("initial", "H6", "auth.py:login:entry", "login endpoint hit", {"emailDomain": email.split("@")[-1] if "@" in email else "invalid"})
    # #endregion

    any_user = User.query.filter_by(email=email).first()
    if not any_user:
        # #region agent log
        _agent_log("initial", "H6", "auth.py:login:userLookup", "user not found", {"email": email})
        # #endregion
        return {"message": "Invalid credentials."}, 401
    if any_user.role == "admin":
        return {"message": "This is an admin account. Please use Admin Login."}, 401
    user = any_user
    valid, needs_upgrade = verify_password(user, password)
    if not valid:
        # #region agent log
        _agent_log("initial", "H7", "auth.py:login:verify", "password verification failed", {"userId": user.id, "needsUpgrade": needs_upgrade})
        # #endregion
        return {"message": "Invalid credentials."}, 401
    if needs_upgrade:
        user.password = generate_password_hash(password)
        db.session.commit()
    # #region agent log
    _agent_log("initial", "H8", "auth.py:login:success", "login success", {"userId": user.id, "needsUpgrade": needs_upgrade})
    # #endregion

    return {"status": "success", "token": create_token(user), "user": user_payload(user)}


@auth_bp.post("/auth/register")
def register():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = (body.get("password") or "").strip()
    # #region agent log
    _agent_log("initial", "H9", "auth.py:register:entry", "register endpoint hit", {"hasName": bool(name), "emailDomain": email.split("@")[-1] if "@" in email else "invalid"})
    # #endregion

    if not name or not email or not password:
        # #region agent log
        _agent_log("initial", "H9", "auth.py:register:validation", "register validation failed", {"hasName": bool(name), "hasEmail": bool(email), "hasPassword": bool(password)})
        # #endregion
        return {"message": "name, email and password are required."}, 400
    if User.query.filter_by(email=email).first():
        # #region agent log
        _agent_log("initial", "H10", "auth.py:register:duplicate", "email already exists", {"email": email})
        # #endregion
        return {"message": "Email already exists."}, 409

    user = User(name=name, email=email, password=generate_password_hash(password), role="user")
    db.session.add(user)
    db.session.commit()
    # #region agent log
    _agent_log("initial", "H11", "auth.py:register:success", "register success", {"userId": user.id})
    # #endregion
    return {"status": "success", "token": create_token(user), "user": user_payload(user)}


@auth_bp.post("/auth/admin/login")
def admin_login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = (body.get("password") or "").strip()

    user = User.query.filter_by(email=email).first()
    if not user:
        return {"message": "Invalid admin credentials."}, 401
    if user.role != "admin":
        return {"message": "This account is not an admin account."}, 401
    valid, needs_upgrade = verify_password(user, password)
    if not valid:
        return {"message": "Invalid admin credentials."}, 401
    if needs_upgrade:
        user.password = generate_password_hash(password)
        db.session.commit()

    return {"status": "success", "token": create_token(user), "user": user_payload(user)}
