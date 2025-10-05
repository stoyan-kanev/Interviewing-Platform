# Interview Platform — Docker Setup

This directory contains a production-ready Docker setup for the Interview Platform.

## What you get
- **PostgreSQL** (persistent volume)
- **Django (Gunicorn)** backend
- **Node.js (Socket.IO)** WebSocket server
- **NGINX** serving the Angular build and reverse-proxying `/api/` → Django and `/socket.io/` → WS

## Quick start

1) Copy env template:
```bash
cp .env.example .env
# Edit .env to set secure values
```

2) Build and start:
```bash
docker compose up --build -d
```

3) Open the app:
- http://localhost:8080

## Project layout expected
```
interview-docker/
├─ docker-compose.yml
├─ .env.example
├─ backend/             # Your Django app (manage.py here)
│  ├─ Dockerfile
│  ├─ entrypoint.sh
│  └─ requirements.txt
├─ frontend/            # Your Angular app
│  ├─ Dockerfile        # multi-stage build → NGINX
│  └─ nginx.conf
└─ ws-server/           # Your Socket.IO server
   ├─ Dockerfile
   ├─ server.js
   └─ package.json
```

> ⚠️ Replace the placeholder **package.json** files with your real app files. The Dockerfiles are generic and should work with most Django/Angular setups.

## How routing works
- `/` → Angular static (served by NGINX)
- `/api/` → Django (Gunicorn) at `backend:8000`
- `/socket.io/` → Node WS at `ws:8001` (with proper WebSocket upgrade headers)

## Next steps (for your infra)
- Mount custom SSL/TLS certs in NGINX or front it with your main reverse proxy.
- Put this stack behind your **existing site gateway** (e.g., another NGINX/Traefik) and map it to a subdomain like `interview.your-domain.com`.
- Add **Redis** if you need channels/caching or rate-limiting.
- Configure **CORS/CSRF** in Django to allow the public domain.

---

**Tip:** If your Angular build outputs to `dist/<project-name>/browser`, the provided Dockerfile copies the whole `dist/` folder. If needed, adjust the `COPY --from=build` line to the exact path.
