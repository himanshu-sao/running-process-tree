# Service Dashboard

A lightweight service discovery dashboard for a RHEL 9 jump server. Automatically discovers running services (host listeners and Docker containers), probes HTTP endpoints, and displays them in a polished card-based UI with light/dark theme support.

## Features

- **Automatic Discovery**: Finds local TCP listeners and Docker containers
- **HTTP Probing**: Distinguishes between "listening" and "HTTP responding" services
- **Docker Integration**: Shows container info, health status, and port mappings
- **Reconciliation**: Merges host listeners with Docker containers by port
- **Real-time Updates**: SSE-based live updates as scans complete
- **Polished UI**: Card-based layout with search, filters, and theme toggle
- **No Authentication**: Simple deployment (add auth in production)
- **Lightweight**: Single Node.js backend + vanilla JS frontend

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d --build
```

Open http://localhost:3000

The container includes:
- Backend API server
- Pre-built frontend
- Docker CLI for container discovery
- All dependencies pre-installed

### Option 2: Manual Development

### Prerequisites

- Node.js 18+
- Docker (optional, for container discovery)
- RHEL 9 / Linux / macOS

### Development

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Build frontend
npm run build

# Start backend (serves frontend + API)
cd ../backend
npm start
```

Open http://localhost:3000

### Run Commands

```bash
# Backend only (from backend/)
npm start          # Production
npm run dev        # Development with auto-reload

# Frontend only (from frontend/)
npm run dev        # Vite dev server on :5173
npm run build      # Build to dist/
npm run preview    # Preview production build
```

## Configuration

Edit `config.yaml` at the project root:

```yaml
server:
  port: 3000
  host: "0.0.0.0"

scan:
  interval: 60000       # Background scan interval (ms)
  enabled: true

probe:
  timeout: 3000         # HTTP probe timeout (ms)
  concurrency: 10       # Max concurrent probes
  path: "/"             # Probe path
  scheme: "http"        # http or https
  tlsRejectUnauthorized: true  # TLS cert verification (SECURITY: only disable for internal self-signed certs)

docker:
  enabled: true
  includeStopped: true

host:
  enabled: true
```

Environment variables override config.yaml:
- `PORT`, `HOST`
- `SCAN_INTERVAL`, `SCAN_ENABLED`
- `PROBE_TIMEOUT`, `PROBE_CONCURRENCY`, `PROBE_PATH`, `PROBE_SCHEME`, `PROBE_TLS_REJECT_UNAUTHORIZED`
- `DOCKER_SOCKET`, `DOCKER_ENABLED`, `DOCKER_INCLUDE_STOPPED`
- `HOST_COMMAND`, `HOST_ARGS`, `HOST_ENABLED`
- `LOG_LEVEL`, `LOG_FORMAT`

## Deployment (RHEL 9)

### 1. Create unprivileged user

```bash
sudo useradd -r -s /bin/bash -d /opt/service-dashboard service-dashboard
```

### 2. Install application

```bash
# As service-dashboard user
cd /opt/service-dashboard
git clone <repo> .
cd backend && npm ci --production
cd ../frontend && npm ci && npm run build
```

### 3. Configure Docker access (for container discovery)

```bash
# Add user to docker group (requires re-login)
sudo usermod -aG docker service-dashboard

# Or use Docker socket proxy (more secure):
# See https://github.com/Tecnativa/docker-socket-proxy
```

### 4. Systemd user service

Create `~/.config/systemd/user/service-dashboard.service`:

```ini
[Unit]
Description=Service Dashboard
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/service-dashboard/backend
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=default.target
```

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable --now service-dashboard
loginctl enable-linger service-dashboard  # Keep running after logout
```

### 5. Firewall (if needed)

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 6. SELinux (if needed)

```bash
# Allow network binding
sudo setsebool -P httpd_can_network_connect 1

# If using non-standard port
sudo semanage port -a -t http_port_t -p tcp 3000
```

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Using Docker Directly

```bash
# Build image
docker build -t service-dashboard .

# Run container
docker run -d \
  --name service-dashboard \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --restart unless-stopped \
  service-dashboard
```

### Docker Socket Access

For Docker container discovery to work, the container needs access to the Docker socket. The compose file mounts it read-only:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

**Note**: The container runs as user 1001. For Docker socket access, either:
1. Add the user to the docker group on the host
2. Use a Docker socket proxy (more secure): https://github.com/Tecnativa/docker-socket-proxy
3. Run as root (not recommended for production): add `-u 0` to docker run

### Environment Variables

All config.yaml settings can be overridden via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `HOST` | Bind address | 0.0.0.0 |
| `SCAN_INTERVAL` | Background scan interval (ms) | 60000 |
| `SCAN_ENABLED` | Enable background scans | true |
| `PROBE_TIMEOUT` | HTTP probe timeout (ms) | 3000 |
| `PROBE_CONCURRENCY` | Max concurrent probes | 10 |
| `PROBE_PATH` | Probe path | / |
| `PROBE_SCHEME` | Probe scheme (http/https) | http |
| `PROBE_TLS_REJECT_UNAUTHORIZED` | TLS cert verification | true |
| `DOCKER_SOCKET` | Docker socket path | (auto) |
| `DOCKER_ENABLED` | Enable Docker discovery | true |
| `DOCKER_INCLUDE_STOPPED` | Include stopped containers | true |
| `HOST_COMMAND` | Host discovery command | lsof |
| `HOST_ARGS` | Host discovery args (comma-separated) | -iTCP,-sTCP:LISTEN,-P,-n |
| `HOST_ENABLED` | Enable host discovery | true |
| `LOG_LEVEL` | Log level | info |
| `LOG_FORMAT` | Log format (json/text) | json |

Example:
```bash
docker run -d \
  -e SCAN_INTERVAL=30000 \
  -e PROBE_TIMEOUT=5000 \
  -e LOG_LEVEL=debug \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  service-dashboard
```

## Architecture

```
├── backend/
│   ├── index.js              # Express server + scan orchestration
│   ├── config.js             # Configuration loader (YAML + env)
│   ├── state.js              # In-memory state + SSE
│   ├── reconcile.js          # Host/Docker reconciliation
│   └── collectors/
│       ├── host.js           # Host listener discovery (lsof)
│       ├── docker.js         # Docker container discovery
│       └── http-probe.js     # HTTP/HTTPS probing
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.js           # Vanilla JS app
│   │   └── styles.css        # CSS custom properties themes
│   └── dist/                 # Production build (gitignored)
├── config.yaml               # Configuration
└── tests/
    └── reconcile.test.js     # Reconciliation tests
```

### Scan Flow

1. **Host Discovery**: Runs `lsof -iTCP -sTCP:LISTEN -P -n` → parses listeners
2. **Docker Discovery**: Runs `docker ps --all --format '{{json .}}'` → parses containers
3. **Reconciliation**: Matches host ports to Docker published ports
4. **HTTP Probing**: Probes all services with ports (bounded concurrency)
5. **State Update**: Merges results, broadcasts via SSE

### Data Model

Services have stable `identityKey`:
- Host: `host:<address>:<port>`
- Docker: `docker:<containerId>`
- Merged: `host:<addr>:<port>|docker:<containerId>`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/services` | List all services |
| GET | `/api/events` | SSE stream for live updates |
| POST | `/api/scan` | Trigger manual scan |

### Service Object

```json
{
  "identityKey": "host:127.0.0.1:3000|docker:abc123",
  "source": "host",
  "type": "web_app",
  "friendlyName": "My App",
  "detectedName": "node",
  "address": "127.0.0.1",
  "port": 3000,
  "pid": 12345,
  "containerId": "abc123",
  "containerName": "my-app",
  "imageName": "my-image:latest",
  "httpStatus": "responding",
  "httpStatusCode": 200,
  "httpLatency": 15,
  "lastProbed": 1234567890,
  "status": "http_responding",
  "dockerHealth": { "status": "healthy" },
  "sources": ["host", "docker"],
  "ports": [{ "hostPort": 3000, "containerPort": 3000, "protocol": "tcp" }]
}
```

## Testing

```bash
# Run reconciliation tests
node tests/reconcile.test.js

# Manual smoke test
cd backend && npm start
# Open http://localhost:3000
# Verify services appear, filters work, theme toggles
```

## Known Limitations

- **No persistence**: In-memory only, state lost on restart (SQLite planned)
- **No authentication**: Add reverse proxy with auth for production
- **Host discovery**: Uses `lsof` (standard on RHEL 9); may need `ss` or `netstat` on other systems
- **Docker access**: Requires user in docker group or socket proxy
- **No categories/tags**: Manual metadata editing not yet implemented
- **IPv6 duplicates**: `::` and `0.0.0.0` on same port appear as separate entries
- **Port matching only**: Reconciliation uses port matching (may have false positives)
- **No graceful probe cancellation**: Probes complete even if new scan starts

## Security Notes

- Runs as unprivileged user
- Read-only Docker access
- No command execution from API
- Bounded probe concurrency and timeouts
- Input validation on all endpoints
- CSP headers recommended in production
- **TLS verification enabled by default** — only disable `PROBE_TLS_REJECT_UNAUTHORIZED=false` for internal services with self-signed certificates (understand the MITM risk)

## License

MIT