import os

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
    CORS(app)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)

    with app.app_context():
        # Lightweight compatibility migration for existing local databases.
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

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(student_bp, url_prefix="/api")
    app.register_blueprint(course_bp, url_prefix="/api")
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/uploads/<path:filename>")
    def uploaded_file(filename: str):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    return app
