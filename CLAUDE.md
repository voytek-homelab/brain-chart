# CLAUDE.md — Brain Chart

3D interactive knowledge graph visualization for the 2brain ecosystem. Full-stack app: React frontend with Three.js, Hono backend, reading from 2brain's PostgreSQL database.

## Quick start

```bash
npm install
npm run dev          # Vite (5173) + Hono server (3200) with hot reload
npm run build        # Build client + server
npm start            # Production: serves built client from Hono
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, react-force-graph-3d, Three.js |
| Backend | Hono, @hono/node-server |
| Database | PostgreSQL (192.168.1.58:5432, database `memory`) |
| Build | Vite (client → dist-client/), tsc (server → dist-server/) |
| Module | ES2022, ESM-only |

## Architecture

```
src/
  App.tsx          Main component — state, data fetching, layout
  Graph3D.tsx      3D force-directed graph (react-force-graph-3d)
  Sidebar.tsx      Entity detail panel (click a node)
  theme.ts         Entity type → color mapping
  types.ts         TypeScript interfaces

server/
  index.ts         Hono API server (port 3200), serves static files in prod
  db.ts            PG pool + query functions
```

**API endpoints:**
- `GET /api/graph` — all entities + relationships for visualization
- `GET /api/stats` — entity/relationship/event counts
- `GET /api/entity/:id` — entity details with connected entities and events

**Data flow:** Frontend fetches `/api/graph` → renders 3D force graph → click node → fetch `/api/entity/:id` → show in sidebar.

## Database tables used

- `entities` (id, name, entity_type, properties, created_at)
- `relationships` (source_entity_id, target_entity_id, relation_type, valid_until)
- `brain_events` (id, title, summary, importance, content, valid_until)

These are shared 2brain tables — read-only from this app.

## Development

- Dev mode: Vite on :5173 proxies `/api/*` to `http://localhost:3200`
- Node sizes scale by event count; colors by entity type (see `theme.ts`)
- DB credentials currently hardcoded in `server/db.ts`

## Deploy

Systemd service `brain-chart.service` included in repo:
```bash
npm run build
sudo systemctl restart brain-chart
```

Accessible at `https://brain.voytek-homelab.com` via Traefik (LXC 505, port 3200).

## Key files

| File | Purpose |
|------|---------|
| src/App.tsx | Main component, state management, data fetching |
| src/Graph3D.tsx | 3D visualization logic |
| server/index.ts | API server, static file serving |
| server/db.ts | PostgreSQL queries |
| brain-chart.service | Systemd unit file |
| vite.config.ts | Build config, dev proxy |
