---
type: deployment
version: "2.0"
---

# Deployment — LNPM Cloud Dashboard

## 1. Overview

The LNPM Cloud Dashboard is a single-process Node.js application built with Nuxt + Nitro (persistent `node-server` preset), SQLite via `better-sqlite3` with WAL mode, and native WebSocket support. It serves both the REST API and the web dashboard from one codebase.

**Deployment model:** Single-node, single-process. No container orchestration, no external database, no Redis. One persistent Node.js process, one SQLite file, one WebSocket server.

**Runtime requirement:** Persistent process (not serverless). WebSocket connections and a long-lived SQLite connection require a process that stays alive.

---

## 2. Prerequisites

### 2.1. System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 256 MB | 512 MB |
| Disk | 1 GB (database grows with data) | 5 GB + space for backups |
| OS | Linux (Ubuntu 22.04+, Debian 12+, Alpine 3.19+) | Any Linux with Node.js 22 support |
| Node.js | 20.x (minimum) | 22.x (LTS) |
| pnpm | 11.x (locked in `package.json`) | 11.x |
| HTTPS | Required (reverse proxy or managed hosting) | Let's Encrypt + nginx |
| Open port | One TCP port (default 3000) | Behind reverse proxy on 443 |

### 2.2. Required Tools

| Tool | Purpose |
|------|---------|
| `git` | Clone repository |
| `node` (v22) | Runtime |
| `corepack` | Enable pnpm via Corepack |
| `pnpm` (v11) | Package manager |
| `nginx` (or equivalent) | Reverse proxy, TLS termination, WebSocket upgrade |
| `certbot` (optional) | Let's Encrypt TLS certificates |
| `pm2` (or `systemd`) | Process management and auto-restart |

### 2.3. Network Requirements

| Direction | Protocol | Port | Description |
|-----------|----------|------|-------------|
| Inbound (dashboard users) | HTTPS | 443 | Web dashboard UI, API endpoints |
| Inbound (LNPM clients) | HTTPS | 443 | Ping data ingest (`POST /api/ping/ingest`) |
| Outbound (none required) | — | — | No external services (no PostgreSQL, Redis, or external APIs) |

The backend does not make outbound network calls. All data is stored locally in SQLite.

---

## 3. Environment Variables

All configuration is passed via environment variables. The application reads them from `.env` (loaded automatically by Nitro) or from the system environment.

### 3.1. Required Variables

None are strictly required — all have sensible defaults. However, the following should be set explicitly in production:

| Variable | Default | Production Value | Description |
|----------|---------|------------------|-------------|
| `NODE_ENV` | `development` | `production` | Environment mode |
| `PORT` | `3000` | `3000` | HTTP server port (behind reverse proxy) |
| `DATABASE_PATH` | `.data/lingering.db` | `/var/data/lnpm/lingering.db` | SQLite database file path (absolute path recommended) |

### 3.2. Optional Variables

#### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Logging verbosity: `debug`, `info`, `warn`, `error` |

#### WebSocket

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_HEARTBEAT_INTERVAL_MS` | `30000` | WebSocket ping/pong heartbeat interval (ms) |
| `WS_MAX_CLIENTS` | `1000` (dev) / `10000` (prod) | Maximum concurrent WebSocket connections |

#### Ingest

| Variable | Default | Description |
|----------|---------|-------------|
| `INGEST_MAX_SAMPLES` | `1000` | Maximum samples per batch POST request |
| `INGEST_FUTURE_WINDOW_MS` | `300000` | Maximum allowed future timestamp offset (5 minutes, in ms) |

#### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit sliding window (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` (dev) / `100` (prod) | Maximum requests per window per IP |

#### Data Retention

| Variable | Default | Description |
|----------|---------|-------------|
| `RETENTION_DAYS` | `30` (dev) / `7` (prod) | Raw ping sample retention period in days |
| `ROLLUP_RETENTION_DAYS` | `90` (dev) / `30` (prod) | Minute rollup retention period in days |
| `MONITOR_INACTIVE_DAYS` | `30` | Days of inactivity before a monitor is considered inactive |

#### Cache

| Variable | Default | Description |
|----------|---------|-------------|
| `LRU_CACHE_MAX` | `10000` (dev) / `50000` (prod) | Maximum in-memory LRU cache entries |

### 3.3. Environment Examples

#### Development (`.env`)

```bash
NODE_ENV=development
PORT=3000
DATABASE_PATH=.data/lingering.db
LOG_LEVEL=debug

WS_HEARTBEAT_INTERVAL_MS=30000
WS_MAX_CLIENTS=1000

INGEST_MAX_SAMPLES=1000
INGEST_FUTURE_WINDOW_MS=300000

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

RETENTION_DAYS=30
ROLLUP_RETENTION_DAYS=90
MONITOR_INACTIVE_DAYS=30

LRU_CACHE_MAX=10000
```

#### Production (`.env`)

```bash
NODE_ENV=production
PORT=3000
DATABASE_PATH=/var/data/lnpm/lingering.db
LOG_LEVEL=info

WS_HEARTBEAT_INTERVAL_MS=30000
WS_MAX_CLIENTS=10000

INGEST_MAX_SAMPLES=1000
INGEST_FUTURE_WINDOW_MS=300000

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

RETENTION_DAYS=7
ROLLUP_RETENTION_DAYS=30
MONITOR_INACTIVE_DAYS=30

LRU_CACHE_MAX=50000
```

---

## 4. Deployment Strategies

### Option A: VPS with PM2 (Recommended)

A standard VPS (DigitalOcean Droplet, Hetzner, Linode, AWS EC2) with nginx as a reverse proxy and PM2 as the process manager.

#### Step 1: Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 (NodeSource repository)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# Enable corepack for pnpm
corepack enable
corepack prepare pnpm@11.9.0 --activate

# Install nginx and git
sudo apt install -y nginx git

# Install PM2 globally
sudo npm install -g pm2

# Create application user (optional but recommended)
sudo adduser --system --no-create-home lnpm
```

#### Step 2: Clone and Install

```bash
# Clone the repository
git clone <repository-url> /opt/lnpm-dashboard
cd /opt/lnpm-dashboard

# Install dependencies
pnpm install --frozen-lockfile

# Create data directory for SQLite
sudo mkdir -p /var/data/lnpm
sudo chown lnpm:lnpm /var/data/lnpm
sudo chmod 750 /var/data/lnpm
```

#### Step 3: Configure Environment

```bash
# Create production environment file
cp .env.example .env
# Edit .env with production values (see Section 3.3)
```

#### Step 4: Build

```bash
pnpm build
```

This produces the Nitro output in `dist/` — a self-contained Node.js application.

#### Step 5: Start with PM2

```bash
# Start the application
pm2 start dist/server.mjs \
  --name lnpm-dashboard \
  --interpreter node \
  -- \
  NODE_ENV=production

# Configure PM2 to start on boot
pm2 startup
pm2 save
```

#### Step 6: Configure Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/lnpm-dashboard
```

```nginx
server {
    listen 443 ssl http2;
    server_name dashboard.example.com;

    ssl_certificate     /etc/letsencrypt/live/dashboard.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    # Client request limits
    client_max_body_size 10m;  # Allow batch ingest payloads

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # WebSocket keep-alive
        proxy_read_timeout 86400s;  # 24h for long-lived WS connections
    }
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name dashboard.example.com;
    return 301 https://$host$request_uri;
}
```

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/lnpm-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 7: Configure TLS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dashboard.example.com
```

#### Step 8: Verify Deployment

```bash
# Check health endpoint
curl https://dashboard.example.com/api/health

# Expected response:
# { "status": "ok", "timestamp": "...", "uptime": 123, "version": "0.2.1" }

# Check PM2 status
pm2 status
pm2 logs lnpm-dashboard --lines 50
```

### Option B: Systemd Service

For environments where PM2 is not desired, use a native systemd service.

#### Step 1: Create Service File

```bash
sudo nano /etc/systemd/system/lnpm-dashboard.service
```

```ini
[Unit]
Description=LNPM Cloud Dashboard
After=network.target

[Service]
Type=simple
User=lnpm
WorkingDirectory=/opt/lnpm-dashboard
ExecStart=/usr/bin/node dist/server.mjs
Restart=on-failure
RestartSec=5

# Environment
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_PATH=/var/data/lnpm/lingering.db
Environment=LOG_LEVEL=info
Environment=WS_HEARTBEAT_INTERVAL_MS=30000
Environment=WS_MAX_CLIENTS=10000
Environment=INGEST_MAX_SAMPLES=1000
Environment=INGEST_FUTURE_WINDOW_MS=300000
Environment=RATE_LIMIT_WINDOW_MS=60000
Environment=RATE_LIMIT_MAX_REQUESTS=100
Environment=RETENTION_DAYS=7
Environment=ROLLUP_RETENTION_DAYS=30
Environment=MONITOR_INACTIVE_DAYS=30
Environment=LRU_CACHE_MAX=50000

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/data/lnpm

# Resource limits
MemoryMax=512M
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

#### Step 2: Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable lnpm-dashboard
sudo systemctl start lnpm-dashboard
sudo systemctl status lnpm-dashboard
```

### Option C: Docker

For containerized deployments. Note: this is a single-container deployment (no Docker Compose needed since there are no external services).

#### Dockerfile

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/lingering.db

EXPOSE 3000
CMD ["node", "dist/server.mjs"]
```

#### Build and Run

```bash
# Build the image
docker build -t lnpm-dashboard:latest .

# Run the container
docker run -d \
  --name lnpm-dashboard \
  -p 3000:3000 \
  -v lnpm-data:/app/data \
  -e NODE_ENV=production \
  -e WS_MAX_CLIENTS=10000 \
  -e RATE_LIMIT_MAX_REQUESTS=100 \
  -e RETENTION_DAYS=7 \
  lnpm-dashboard:latest
```

#### Docker Compose (with nginx reverse proxy)

```yaml
services:
  dashboard:
    build: .
    container_name: lnpm-dashboard
    restart: unless-stopped
    volumes:
      - lnpm-data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_PATH=/app/data/lingering.db
      - WS_MAX_CLIENTS=10000
      - RATE_LIMIT_MAX_REQUESTS=100
      - RETENTION_DAYS=7
    expose:
      - "3000"

  nginx:
    image: nginx:alpine
    container_name: lnpm-nginx
    restart: unless-stopped
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/letsencrypt:ro
    depends_on:
      - dashboard

volumes:
  lnpm-data:
```

### Option D: Managed Hosting (Railway / Render / Fly.io)

Deploy on platforms that support persistent Node.js processes.

**Requirements:**
- Persistent process (not serverless/Edge functions)
- Filesystem persistence (for SQLite database)
- WebSocket support

#### Railway

1. Connect GitHub repository
2. Set build command: `pnpm install && pnpm build`
3. Set start command: `node dist/server.mjs`
4. Add a Persistent Disk volume mounted to `/var/data/lnpm`
5. Configure environment variables in the Railway dashboard
6. Railway automatically handles HTTPS and WebSocket upgrades

#### Render

1. Create a Web Service from the repository
2. Set build command: `pnpm install && pnpm build`
3. Set start command: `node dist/server.mjs`
4. Attach a Persistent Disk for the database
5. Configure environment variables

#### Fly.io

1. Install `flyctl` CLI
2. Create a Fly app: `fly apps create lnpm-dashboard`
3. Create a `fly.toml`:

```toml
app = "lnpm-dashboard"
processes = [
  { cmd = "node dist/server.mjs", type = "app" }
]

[mounts]
  source = "lnpm_data"
  destination = "/var/data/lnpm"

[env]
  NODE_ENV = "production"
  DATABASE_PATH = "/var/data/lnpm/lingering.db"
  PORT = "3000"

# WebSocket support
[checks]
  [checks.health]
    type = "http"
    path = "/api/health"
    grace_period = "10s"
    interval = "30s"
```

4. Create a persistent volume: `fly volumes create lnpm_data --size 10`
5. Deploy: `fly deploy`

---

## 5. Database Management

### 5.1. SQLite Configuration

The application applies the following pragmas on startup:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;        -- 64 MB cache
PRAGMA temp_store = MEMORY;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;        -- 5s busy timeout
PRAGMA wal_autocheckpoint = 1000;  -- Auto-checkpoint every 1000 pages
```

WAL mode enables concurrent reads while writes occur, which is essential for the ingest + dashboard read pattern.

### 5.2. Database File Location

| Environment | Path | Config Variable |
|-------------|------|----------------|
| Development | `.data/lingering.db` | `DATABASE_PATH` |
| Production | `/var/data/lnpm/lingering.db` | `DATABASE_PATH` |

### 5.3. Backups

Since SQLite stores all data in a single file, backups are straightforward.

**Important:** In WAL mode, you must use `PRAGMA wal_checkpoint(PASSIVE)` or copy the file while the database is in a clean state. The safest approach is to use `sqlite3` CLI:

```bash
# Create a consistent backup
sqlite3 /var/data/lnpm/lingering.db ".backup /backups/lnpm-$(date +%Y%m%d).db"

# Alternative: use sqlite3's online backup API
# (more reliable for production, does not block reads/writes)
```

**Recommended backup schedule (cron):**

```bash
# Daily backup at 2 AM
0 2 * * * sqlite3 /var/data/lnpm/lingering.db ".backup /backups/lnpm-$(date +\%Y\%m\%d).db"

# Weekly cleanup — keep last 30 days
0 3 * * * find /backups -name "lnpm-*.db" -mtime +30 -delete
```

**Remote backup (optional):**

```bash
# Sync to remote storage after local backup
0 2 * * * rsync -avz /backups/lnpm-$(date +\%Y\%m\%d).db backup-server:/backups/lnpm/
```

### 5.4. Database Recovery

To restore from a backup:

```bash
# Stop the application
pm2 stop lnpm-dashboard
# or: sudo systemctl stop lnpm-dashboard

# Restore the database
cp /backups/lnpm-20260731.db /var/data/lnpm/lingering.db

# Remove WAL and SHM files (they will be recreated on startup)
rm -f /var/data/lnpm/lingering.db-wal
rm -f /var/data/lnpm/lingering.db-shm

# Start the application
pm2 start lnpm-dashboard
# or: sudo systemctl start lnpm-dashboard
```

---

## 6. Data Retention

The backend automatically purges old data based on the configured retention policy.

| Data | Default Retention (dev) | Default Retention (prod) | Cleanup Method |
|------|------------------------|-------------------------|---------------|
| `ping_samples` | 30 days | 7 days | `DELETE` rows older than `RETENTION_DAYS` |
| `minute_rollups` | 90 days | 30 days | `DELETE` rows older than `ROLLUP_RETENTION_DAYS` |
| `monitors` | Forever (remove if inactive > 30 days) | Same | Detect via `last_seen_ms` |
| `clients` | Forever | Forever | Manual deletion only |

After cleanup, `VACUUM` is called periodically to reclaim disk space from deleted rows.

---

## 7. Process Management

### PM2 Commands

| Command | Purpose |
|---------|---------|
| `pm2 start dist/server.mjs --name lnpm-dashboard` | Start the application |
| `pm2 stop lnpm-dashboard` | Stop gracefully |
| `pm2 restart lnpm-dashboard` | Restart (zero-downtime with `--reload`) |
| `pm2 reload lnpm-dashboard` | Zero-downtime restart (PM2 Cluster mode) |
| `pm2 logs lnpm-dashboard` | View logs |
| `pm2 logs lnpm-dashboard --lines 100` | Last 100 log lines |
| `pm2 status` | Show process status |
| `pm2 monit` | Real-time resource monitoring |
| `pm2 save` | Save current process list (for auto-restart) |
| `pm2 startup` | Generate system startup script |

### Systemd Commands

| Command | Purpose |
|---------|---------|
| `sudo systemctl start lnpm-dashboard` | Start the service |
| `sudo systemctl stop lnpm-dashboard` | Stop gracefully |
| `sudo systemctl restart lnpm-dashboard` | Restart |
| `sudo systemctl status lnpm-dashboard` | Show status |
| `journalctl -u lnpm-dashboard -f` | Follow logs |
| `sudo systemctl enable lnpm-dashboard` | Enable on boot |

---

## 8. Deployment Checklist

### Pre-deployment

- [ ] Node.js 22 installed and verified (`node --version`)
- [ ] pnpm available via corepack (`pnpm --version`)
- [ ] Git repository cloned
- [ ] Dependencies installed (`pnpm install --frozen-lockfile`)
- [ ] Build completed (`pnpm build`)
- [ ] `.env` file configured with production values
- [ ] Database directory created with correct permissions (`/var/data/lnpm/`)
- [ ] Required TCP port (3000) available

### Reverse Proxy (nginx)

- [ ] Nginx installed and running
- [ ] Server block configured with proxy settings
- [ ] WebSocket upgrade headers configured (`Upgrade` and `Connection`)
- [ ] TLS certificate installed (Let's Encrypt or custom)
- [ ] HTTP -> HTTPS redirect configured
- [ ] `client_max_body_size` set to at least 10MB (for ingest payloads)

### Application

- [ ] Application started (PM2 or systemd)
- [ ] Health endpoint responding: `curl https://<host>/api/health`
- [ ] SQLite database created at `DATABASE_PATH`
- [ ] WAL mode enabled (verify with `PRAGMA journal_mode`)
- [ ] Database migrations applied on first run

### Post-deployment

- [ ] TLS certificate valid (check expiration)
- [ ] Backup script configured (cron job)
- [ ] Log rotation configured (PM2 builtin or logrotate)
- [ ] Uptime monitoring configured (point at `/api/health`)
- [ ] Firewall rules configured (only ports 22, 80, 443 exposed)
- [ ] Rate limiting verified (test with rapid requests)
- [ ] WebSocket connectivity verified (dashboard connects to `/ws/ping`)
- [ ] LNPM client successfully ingests data (test with a real client)

---

## 9. Monitoring and Maintenance

### 9.1. Health Check

Use `GET /api/health` for uptime monitoring services (UptimeRobot, Better Uptime, Pingdom, etc.):

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-31T12:00:00.000Z",
  "uptime": 3600,
  "version": "0.2.1"
}
```

### 9.2. Log Management

**PM2 logs:**
```bash
pm2 logs lnpm-dashboard --lines 200
pm2 flush  # Clear log files
```

**Systemd logs:**
```bash
journalctl -u lnpm-dashboard --since "1 hour ago"
journalctl -u lnpm-dashboard --since today
```

**Log rotation (PM2):**
```bash
# PM2 includes built-in log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:rotate_interval "1d"
pm2 set pm2-logrotate:retain 30
```

### 9.3. Disk Space Monitoring

Monitor SQLite database file size and disk usage:

```bash
# Check database file size
ls -lh /var/data/lnpm/lingering.db

# Check disk usage
df -h /var/data/lnpm/

# Check WAL file size (grows during heavy write activity)
ls -lh /var/data/lnpm/lingering.db-wal 2>/dev/null || echo "No WAL file"
```

### 9.4. Common Maintenance Tasks

#### Updating the Application

```bash
cd /opt/lnpm-dashboard
git pull origin main
pnpm install --frozen-lockfile
pnpm build
pm2 reload lnpm-dashboard  # Zero-downtime reload
```

#### Database Integrity Check

```bash
sqlite3 /var/data/lnpm/lingering.db "PRAGMA integrity_check;"
# Expected: "ok"
```

#### Manually Running Data Retention

```bash
# Connect to database and manually purge old data
sqlite3 /var/data/lnpm/lingering.db <<'SQL'
DELETE FROM ping_samples WHERE timestamp_ms < (strftime('%s', 'now', '-7 days') * 1000);
DELETE FROM minute_rollups WHERE timestamp_ms < (strftime('%s', 'now', '-30 days') * 1000);
VACUUM;
SQL
```

#### Restarting After System Reboot

With PM2: `pm2 resurrect` (restores saved process list)
With systemd: starts automatically (configured with `enable`)

---

## 10. Troubleshooting

### 10.1. Application Won't Start

```bash
# Check for errors in logs
pm2 logs lnpm-dashboard --err --lines 50

# Verify the build output exists
ls -la dist/server.mjs

# Check Node.js version
node --version  # Should be >= 20.x

# Verify database directory permissions
ls -la /var/data/lnpm/
```

### 10.2. WebSocket Connections Fail

```bash
# Verify nginx WebSocket headers are configured
sudo nginx -T | grep -A2 "Upgrade"

# Check if the app is listening on the correct port
curl http://127.0.0.1:3000/api/health

# Test WebSocket connection directly
wscat -c ws://localhost:3000/ws/ping
```

### 10.3. Database Lock Errors

```bash
# Check if WAL mode is enabled
sqlite3 /var/data/lnpm/lingering.db "PRAGMA journal_mode;"
# Expected: "wal"

# Check busy timeout
sqlite3 /var/data/lnpm/lingering.db "PRAGMA busy_timeout;"
# Expected: 5000

# Check for stale WAL/SHM files
ls -la /var/data/lnpm/
```

### 10.4. High Memory Usage

```bash
# Check PM2 resource usage
pm2 monit

# Check heap usage
pm2 show lnpm-dashboard

# Restart to clear LRU cache (cache is rebuilt from database)
pm2 restart lnpm-dashboard
```

### 10.5. Ingest Failures

```bash
# Check application logs for ingest errors
pm2 logs lnpm-dashboard | grep -i "ingest"

# Verify database is accepting writes
sqlite3 /var/data/lnpm/lingering.db "SELECT COUNT(*) FROM ping_samples;"

# Check disk space
df -h /var/data/lnpm/
```

---

## 11. Security Considerations

### 11.1. Network Security

- **HTTPS only:** All traffic must pass through TLS. Never expose port 3000 directly to the internet.
- **Firewall:** Only expose ports 22 (SSH), 80 (HTTP redirect), and 443 (HTTPS). Block all other inbound ports.
- **Rate limiting:** The application includes per-IP rate limiting (configurable via `RATE_LIMIT_MAX_REQUESTS`).

### 11.2. File System Security

- Run the application as a non-root user (e.g., `lnpm`).
- Set database directory permissions to `750` (owner read/write/execute, group read/execute).
- Use systemd `ProtectSystem=strict` and `ReadWritePaths` to restrict file system access.

### 11.3. TLS Configuration

Use `certbot` for Let's Encrypt certificates with auto-renewal:

```bash
sudo certbot --nginx -d dashboard.example.com
# Auto-renewal is configured automatically via systemd timer
```

Verify renewal works:

```bash
sudo certbot renew --dry-run
```

### 11.4. Data Privacy

- Client identity includes MAC addresses stored in the database. Ensure the server and database are not exposed.
- SQLite database file contains all monitoring data — protect it with proper file permissions and encrypted disk (LUKS) if possible.
- Backups should be encrypted and stored securely.

---

## 12. Scaling Considerations

The current architecture is designed for single-node deployment. If scaling is needed in the future:

### Horizontal Scaling Limitations

- SQLite is a single-file database — it cannot be shared across multiple processes on different machines.
- WebSocket state (subscription Map) is in-process memory — it does not survive across multiple instances.
- LRU cache is in-process — each instance has its own cache.

### Migration Path (if needed)

1. Replace SQLite with PostgreSQL (same SQL, different driver — `better-sqlite3` -> `pg`).
2. Replace in-memory LRU cache with Redis.
3. Replace in-memory WebSocket subscription Map with a pub/sub mechanism (Redis Channels).
4. Deploy behind a load balancer with WebSocket sticky sessions or a WebSocket-aware proxy.

This migration path is documented in ADR-002 (Architecture document).
