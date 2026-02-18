# VPS Deploy Guide (Optional, post-local MVP)

## Target
Single VPS with Docker + Docker Compose.

## 1) Prereqs
- Ubuntu 22.04+
- Docker + Compose plugin
- Domain/subdomain (optional)
- Reverse proxy (Caddy/Nginx)

## 2) Server bootstrap
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
```

## 3) App deploy
```bash
git clone <your-repo-url> revoai-mission-control
cd revoai-mission-control
cp .env.example .env
# edit secrets
docker compose up -d --build
```

## 4) Reverse proxy
- Route web to `:3000`
- Route api/ws to `:4000`
- Enable TLS

## 5) Data durability
- Keep named Docker volumes for postgres/redis.
- Add nightly postgres backup cron.

## 6) Security basics
- Firewall allow 22/80/443 only
- Strong admin credentials
- Restrict DB/Redis to internal network only

## 7) Monitoring
- Add simple health checks and uptime monitor.
- Add app logs aggregation later.

> Note: Sender/publisher integrations remain disabled in Phase 2.
