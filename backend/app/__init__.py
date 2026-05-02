import os
import threading

from flask import Flask, send_from_directory
from flask_cors import CORS
from sqlalchemy import text

from .config import Config
from .extensions import db, migrate
from .routes.admin import admin_bp
from .routes.auth import auth_bp
from .routes.chat import chat_bp
from .routes.course import course_bp
from .routes.student import student_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    # Railway logs: confirm which DB host the process actually uses (no secrets).
    app.logger.warning(
        "DB config: host=%s port=%s database=%s (if host is localhost on Railway, fix Variables or remove committed .env)",
        app.config.get("MYSQL_HOST"),
        app.config.get("MYSQL_PORT"),
        app.config.get("MYSQL_DB"),
    )
    cors_origin = app.config.get("FRONTEND_ORIGIN", "*")
    CORS(app, resources={r"/api/*": {"origins": cors_origin}})
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)

    # Run DB compatibility in a daemon thread so Gunicorn can finish booting immediately.
    # Railway (and some health checks) expect HTTP to respond soon; a slow or stuck MySQL handshake
    # during create_app would otherwise keep the worker from accepting connections.
    def _startup_db_compat() -> None:
        with app.app_context():
            def _table_exists(table_name: str) -> bool:
                cnt = db.session.execute(
                    text(
                        """
                        SELECT COUNT(*) AS cnt
                        FROM information_schema.TABLES
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = :table_name
                        """
                    ),
                    {"table_name": table_name},
                ).scalar()
                return bool(cnt)

            try:
                if _table_exists("courses"):
                    exists = db.session.execute(
                        text(
                            """
                            SELECT COUNT(*) AS cnt
                            FROM information_schema.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'courses'
                              AND COLUMN_NAME = 'lecturer_name'
                            """
                        )
                    ).scalar()
                    if not exists:
                        db.session.execute(text("ALTER TABLE courses ADD COLUMN lecturer_name VARCHAR(120) NOT NULL DEFAULT 'Lecturer'"))
                        db.session.commit()
                if _table_exists("books"):
                    book_desc_exists = db.session.execute(
                        text(
                            """
                            SELECT COUNT(*) AS cnt
                            FROM information_schema.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'books'
                              AND COLUMN_NAME = 'description'
                            """
                        )
                    ).scalar()
                    if not book_desc_exists:
                        db.session.execute(text("ALTER TABLE books ADD COLUMN description TEXT NULL"))
                        db.session.commit()

                def ensure_column(table_name: str, column_name: str, ddl: str):
                    if not _table_exists(table_name):
                        return
                    exists_col = db.session.execute(
                        text(
                            """
                            SELECT COUNT(*) AS cnt
                            FROM information_schema.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = :table_name
                              AND COLUMN_NAME = :column_name
                            """
                        ),
                        {"table_name": table_name, "column_name": column_name},
                    ).scalar()
                    if not exists_col:
                        db.session.execute(text(ddl))

                ensure_column("assignments", "publish_at", "ALTER TABLE assignments ADD COLUMN publish_at DATETIME NULL")
                ensure_column("assignments", "rubric_template", "ALTER TABLE assignments ADD COLUMN rubric_template TEXT NULL")
                ensure_column("assignments", "quiz_payload", "ALTER TABLE assignments ADD COLUMN quiz_payload LONGTEXT NULL")
                ensure_column("assignments", "timer_seconds", "ALTER TABLE assignments ADD COLUMN timer_seconds INT NULL")
                ensure_column("assignments", "attachment_path", "ALTER TABLE assignments ADD COLUMN attachment_path VARCHAR(512) NULL")
                ensure_column("courses", "join_code", "ALTER TABLE courses ADD COLUMN join_code VARCHAR(32) NULL")
                ensure_column("announcements", "publish_at", "ALTER TABLE announcements ADD COLUMN publish_at DATETIME NULL")
                ensure_column("materials", "publish_at", "ALTER TABLE materials ADD COLUMN publish_at DATETIME NULL")
                ensure_column("users", "bio", "ALTER TABLE users ADD COLUMN bio TEXT NULL")
                ensure_column("users", "language", "ALTER TABLE users ADD COLUMN language VARCHAR(50) NOT NULL DEFAULT 'English'")
                ensure_column("users", "theme", "ALTER TABLE users ADD COLUMN theme VARCHAR(30) NOT NULL DEFAULT 'Light'")
                ensure_column(
                    "users",
                    "notification_pref",
                    "ALTER TABLE users ADD COLUMN notification_pref VARCHAR(80) NOT NULL DEFAULT 'All notifications'",
                )
                if _table_exists("forum_posts"):
                    db.session.execute(
                        text(
                            """
                            CREATE TABLE IF NOT EXISTS forum_replies (
                              id INT AUTO_INCREMENT PRIMARY KEY,
                              post_id INT NOT NULL,
                              author_role VARCHAR(20) NOT NULL DEFAULT 'student',
                              author_name VARCHAR(120) NOT NULL,
                              text TEXT NOT NULL,
                              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                              CONSTRAINT fk_forum_reply_post FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
                              INDEX ix_forum_replies_post (post_id)
                            )
                            """
                        )
                    )
                if _table_exists("assignments") and _table_exists("users"):
                    db.session.execute(
                        text(
                            """
                            CREATE TABLE IF NOT EXISTS quiz_attempts (
                              id INT AUTO_INCREMENT PRIMARY KEY,
                              assignment_id INT NOT NULL,
                              user_id INT NOT NULL,
                              score INT NOT NULL DEFAULT 0,
                              total INT NOT NULL DEFAULT 0,
                              answers_json LONGTEXT NULL,
                              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                              CONSTRAINT fk_quiz_attempt_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
                              CONSTRAINT fk_quiz_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                            )
                            """
                        )
                    )
                db.session.commit()
            except Exception as exc:
                try:
                    db.session.rollback()
                except Exception:
                    pass
                try:
                    db.session.remove()
                except Exception:
                    pass
                app.logger.warning("Startup DB compatibility step skipped: %s", exc)

    threading.Thread(target=_startup_db_compat, name="edutech-db-compat", daemon=True).start()

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(student_bp, url_prefix="/api")
    app.register_blueprint(course_bp, url_prefix="/api")
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api")

    @app.get("/")
    @app.get("/health")
    def root_probe():
        """Fast 200 for platform probes (Railway health checks often hit `/` or `/health`)."""
        return {"status": "ok"}

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/uploads/<path:filename>")
    def uploaded_file(filename: str):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    return app
