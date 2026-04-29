# EduTech Deployment Guide

## Architecture
- Frontend: static `index.html` + `app.js` + `styles.css` (deploy to Vercel).
- Backend: Flask API under `/api/*` (deploy to Render).
- Database: MySQL (Render MySQL or external managed MySQL).

## 1) Backend (Render)

### Build + start
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`

### Required environment variables
- `SECRET_KEY`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `FRONTEND_ORIGIN` (e.g. `https://your-frontend-domain.vercel.app`)

## 2) Frontend (Vercel)

Deploy repository root as a static site.

Set frontend runtime API base in browser local storage or page bootstrap:
- `EDUTECH_API_BASE_URL=https://your-render-backend.onrender.com/api`

The app fallback is configured as:
- `https://your-backend-url/api`

## 3) Database migration + seed

Run SQL scripts using your MySQL client:
- `backend/sql/schema.sql`
- `backend/sql/seed.sql` (optional)

The backend also includes safe compatibility checks on startup for newly added columns/tables.

## 4) Smoke test checklist

- `GET /api/health` returns `{"status":"ok"}`
- Student auth: register/login
- Admin auth: admin login
- Data write actions:
  - enroll in course
  - post forum question
  - add/remove cart item
  - submit assignment
  - admin create/update/delete course, books, content

