import os
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus, unquote, urlparse

from dotenv import load_dotenv

# On Railway, never load a committed local .env — it can force MYSQL_HOST=localhost and break deploys.
if not os.getenv("RAILWAY_ENVIRONMENT") and not os.getenv("RAILWAY_PROJECT_ID"):
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _coerce_sqlalchemy_mysql_uri(raw: str) -> Optional[str]:
    """If raw is a mysql JDBC-style URL, return mysql+pymysql form without dropping ?ssl-mode=… etc."""
    if not raw or not raw.strip():
        return None
    s = raw.strip()
    low = s.lower()
    if low.startswith("mysql+pymysql://"):
        return s
    if low.startswith("mysql://"):
        return "mysql+pymysql://" + s[8:]
    if low.startswith("mysql2://"):
        return "mysql+pymysql://" + s[9:]
    return None


def _mysql_uri_parts_for_log(uri: str) -> tuple[str, int, str]:
    """Host / port / database for logs only (no credentials)."""
    u = uri.strip()
    low = u.lower()
    if low.startswith("mysql+pymysql://"):
        rest = u[17:]
    elif low.startswith("mysql://"):
        rest = u[8:]
    else:
        rest = u
    fake = "http://" + rest
    p = urlparse(fake)
    host = p.hostname or "?"
    port = int(p.port or 3306)
    db = (p.path or "").strip("/") or "?"
    return host, port, db


def _resolve_mysql_settings():
    """
    Resolve MySQL connection for local .env, Railway, etc.
    Railway often exposes MYSQLHOST / MYSQLPORT / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE
    or a single MYSQL_URL. If nothing is set, falls back to localhost (local dev only).
    """
    host = os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or os.getenv("MYSQL_HOST")
    port = os.getenv("DB_PORT") or os.getenv("MYSQLPORT") or os.getenv("MYSQL_PORT") or "3306"
    user = os.getenv("DB_USER") or os.getenv("MYSQLUSER") or os.getenv("MYSQL_USER")
    password = os.getenv("DB_PASSWORD") or os.getenv("MYSQLPASSWORD") or os.getenv("MYSQL_PASSWORD") or ""
    database = os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE") or os.getenv("MYSQL_DATABASE") or os.getenv("MYSQL_DB")

    mysql_url = (
        os.getenv("MYSQL_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("MYSQL_PUBLIC_URL")
        or ""
    ).strip()
    low = mysql_url.lower()
    if low.startswith("mysql"):
        normalized = mysql_url.replace("mysql+pymysql://", "mysql://", 1)
        parsed = urlparse(normalized)
        if not host and parsed.hostname:
            host = parsed.hostname
        if not user and parsed.username:
            user = unquote(parsed.username)
        if not password and parsed.password is not None:
            password = unquote(parsed.password or "")
        if not database and parsed.path:
            database = (parsed.path or "").lstrip("/") or None
        if parsed.port:
            port = str(parsed.port)

    return (
        host or "localhost",
        int(str(port or "3306")),
        user or "root",
        password or "",
        database or "edutech",
    )


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me")

    _raw_mysql_url = (
        os.getenv("MYSQL_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("MYSQL_PUBLIC_URL")
        or ""
    ).strip()
    _direct_uri = _coerce_sqlalchemy_mysql_uri(_raw_mysql_url)

    MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB = _resolve_mysql_settings()
    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")

    if _direct_uri:
        SQLALCHEMY_DATABASE_URI = _direct_uri
        MYSQL_HOST, MYSQL_PORT, MYSQL_DB = _mysql_uri_parts_for_log(_direct_uri)
    else:
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{quote_plus(MYSQL_USER)}:{quote_plus(MYSQL_PASSWORD)}"
            f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
        )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "connect_args": {"connect_timeout": int(os.getenv("MYSQL_CONNECT_TIMEOUT", "15"))},
    }
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str((Path(__file__).resolve().parent.parent / "uploads")))
