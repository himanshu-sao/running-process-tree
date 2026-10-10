# Task Loop Instructions

## How to Run the Loop

Each iteration, run this command in the terminal:

```bash
cat TASKS.md | grep -A 100 "^## Next Task" | head -20
```

Then execute the task described. After completing and committing, update TASKS.md to mark it done and reveal the next task.

---

## Task List

### Phase 1: Backend Core & Host Discovery

- [x] **Task 1.1**: Initialize git repo, install backend deps, create basic Express server in `backend/index.js` that serves a "hello" response on `/api/health`
  - **Test**: `curl http://localhost:3000/api/health` returns 200 OK ✅

- [x] **Task 1.2**: Create `backend/collectors/host.js` with `discoverHostListeners()` function that runs `lsof -iTCP -sTCP:LISTEN -P -n` and parses output into array of `{ port, address, pid, processName, protocol }`
  - **Test**: Run function directly with Node, verify it returns parsed listeners ✅

- [x] **Task 1.3**: Create `backend/state.js` with in-memory store: `services` array, `lastScan` timestamp, `setServices()`, `getServices()`, `updateService()`
  - **Test**: Import and verify basic CRUD operations work ✅

- [x] **Task 1.4**: Wire host collector into `backend/index.js` — add background scan loop (configurable interval), `/api/services` endpoint, SSE endpoint `/api/events`
  - **Test**: Start server, hit `/api/services`, see discovered listeners; open SSE stream, see updates on scan ✅

### Phase 2: HTTP Probing

- [x] **Task 2.1**: Create `backend/collectors/http-probe.js` with `probeHTTP(port, address, timeout)` that returns `{ success, statusCode, latency, error }`
  - **Test**: Probe known local service (e.g., `probeHTTP(3000, '127.0.0.1', 3000)`) ✅

- [x] **Task 2.2**: Integrate HTTP probe into scan loop — after host discovery, probe each listener concurrently (bounded), update service with `httpStatus`, `httpLatency`, `lastProbed`
  - **Test**: Services with HTTP responders show status "HTTP responding" with status code ✅

### Phase 3: Docker Discovery

- [x] **Task 3.1**: Create `backend/collectors/docker.js` with `discoverDocker()` using Docker CLI — returns containers with `{ id, name, image, state, ports, health }`
  - **Test**: Run function, verify it lists local containers ✅

- [x] **Task 3.2**: Integrate Docker collector into scan loop — add Docker services to in-memory state with type `docker_container`
  - **Test**: `/api/services` shows both host listeners and Docker containers ✅

### Phase 4: Reconciliation

- [x] **Task 4.1**: Create `backend/reconcile.js` with `reconcile(hostServices, dockerServices)` — matches by port, merges into single entry with `sources: ['host', 'docker']`
  - **Test**: Run with fixture data, verify merge works correctly ✅

- [x] **Task 4.2**: Apply reconciliation in scan loop before updating state
  - **Test**: Services running in Docker show both host listener info and container info in one card ✅

### Phase 5: Frontend

- [x] **Task 5.1**: Set up Vite + vanilla JS in `frontend/` — `index.html`, `src/main.js`, `src/styles.css` with CSS custom properties for light/dark theme
  - **Test**: `npm run dev` in frontend shows blank page with theme toggle working ✅

- [x] **Task 5.2**: Build service card component — displays name, type badge, status badge, port, PID/container, last checked
  - **Test**: Static HTML renders card correctly in both themes ✅

- [x] **Task 5.3**: Connect frontend to backend — fetch `/api/services` on load, subscribe to SSE `/api/events`, render card grid
  - **Test**: Open `http://localhost:3000` (served by backend), see live service cards ✅

- [x] **Task 5.4**: Add filters — search input, type filter, status filter; filter cards client-side
  - **Test**: Filters narrow down visible cards ✅

### Phase 6: Polish & Config

- [x] **Task 6.1**: Create `config.yaml` with all configurable options (port, scanInterval, probeTimeout, dockerSocket, etc.)
  - **Test**: Server reads config, uses values ✅

- [x] **Task 6.2**: Serve frontend build from backend — `npm run build` in frontend, backend serves `dist/` statically
  - **Test**: Single command `npm start` in backend serves full app ✅

- [x] **Task 6.3**: Write README with build/run/deploy instructions
  - **Test**: Fresh clone can follow README to run app ✅

---

## Decisions Log

- **2026-10-10**: Using Node.js/Express + Vite vanilla JS, in-memory only, SSE for real-time
- **2026-10-10**: Host discovery via `ss -tlnp` (standard on RHEL 9)
- **2026-10-10**: Docker via Dockerode (read-only)
- **2026-10-10**: Reconciliation by port matching only (simple, may have false positives)
- **2026-10-10**: No database, no persistence, no categories/tags, no offline retention

---

## Current Task

## All Tasks Complete! ✅
All 15 tasks across 6 phases have been completed and tested.

### Summary
- **Phase 1**: Backend core, host discovery, in-memory state, SSE
- **Phase 2**: HTTP probing with bounded concurrency
- **Phase 3**: Docker container discovery
- **Phase 4**: Host/Docker reconciliation by port matching
- **Phase 5**: Vite + vanilla JS frontend with cards, filters, theme toggle
- **Phase 6**: Config system (YAML + env), frontend served by backend, README

### Verified Working
- `/api/health` - Health check endpoint
- `/api/services` - Returns 21 services (14 host + 8 docker, 1 merged)
- `/api/events` - SSE stream with init + live updates
- `http://localhost:3000` - Full frontend served from backend
- Theme toggle, search, type filter, status filter all functional
- Config system reads config.yaml with env overrides
- All reconciliation tests pass