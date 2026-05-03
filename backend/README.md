# EduTech Flask Backend

Clean Flask + MySQL backend that keeps the existing frontend contract stable.

## 1) Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill MySQL credentials.

## 2) Create Database

Run the SQL files in order:

1. `sql/schema.sql` (local MySQL: creates `edutech` and tables). On Railway’s default DB named `railway`, use `sql/schema_railway_default_db.sql` instead (same tables, no `CREATE DATABASE` / `USE`).
2. `sql/seed.sql`

## 3) Run API

```bash
python run.py
```

API base: `https://<your-backend-url>/api`

## 4) Frontend Compatibility

Implemented endpoints used by current frontend:

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/admin/login`
- `GET /me/data`
- `POST /orders/checkout`
- `GET /course/<courseId>/progress`
- `GET /chat/me`
- `POST /chat/me`
- `GET /admin/stats`
- `GET/POST /admin/courses`
- `PUT/DELETE /admin/courses/<id>`
- `GET/POST /admin/books`
- `PUT/DELETE /admin/books/<id>`
- `GET /admin/forum-posts`
- `DELETE /admin/forum-posts/<id>`
- `GET /admin/users`
- `PATCH /admin/users/<id>/role`
- `GET /admin/chats/users`
- `GET/POST /admin/chats/users/<id>/messages`

## 5) Progress Computation (DB-driven)

For `GET /course/<courseId>/progress`, backend computes:

- total assignments in course (`assignments`)
- completed assignments for authenticated student (`submissions`)
- progress = `round(completed / total * 100)`
