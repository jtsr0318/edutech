"""
Test MySQL connection using backend/.env (Railway or local).
From project root: python backend/test_db_connection.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from app import create_app  # noqa: E402


def main():
    app = create_app()
    with app.app_context():
        from backend.app.extensions import db

        conn = db.engine.connect()
        conn.close()
    print("OK: database connection successful.")


if __name__ == "__main__":
    main()
