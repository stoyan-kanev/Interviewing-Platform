#!/usr/bin/env bash
set -e

# Wait for DB (simple wait; for production consider a robust wait-for-it)
echo "Waiting for database..."
python - <<'PY'
import time, os, socket
host = os.environ.get("DB_HOST","db")
port = int(os.environ.get("DB_PORT","5432"))
s = socket.socket()
for i in range(60):
    try:
        s.connect((host, port))
        s.close()
        print("DB is up")
        break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("Database not reachable")
PY

echo "Applying migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput || true

WSGI_MODULE=${DJANGO_WSGI_MODULE:-backend.wsgi}
echo "Starting gunicorn (${WSGI_MODULE})..."
exec gunicorn ${WSGI_MODULE} --bind 0.0.0.0:8000 --workers 3 --timeout 120
