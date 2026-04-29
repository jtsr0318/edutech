"""
WSGI entry for Gunicorn.

Use ``gunicorn wsgi:app`` (not ``app:app``): if the process working directory is
``backend/``, Python would import the ``app`` *package* (``backend/app/``), which
has ``create_app`` but no module-level ``app`` — Gunicorn then fails to boot.
This module name is unambiguous.
"""
from backend.app import create_app

app = create_app()
