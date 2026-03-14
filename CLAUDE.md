# CLAUDE.md — Brain Chart

Interactive knowledge graph visualization for the 2brain ecosystem. Full-stack app: React frontend with vis-network, Hono backend, reading from Memory System 2's Neo4j AuraDB.

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
| Frontend | React 19, TypeScript, vis-network |
| Backend | Hono, @hono/node-server |
| Database | Neo4j AuraDB (Memory System 2 knowledge graph) |
| Build | Vite (client → dist-client/), tsc (server → dist-server/) |
| Module | ES2022, ESM-only |

## Architecture

```
src/
  App.tsx          Main component — state, data fetching, layout
  renderers/
    VisNetworkGraph.tsx  vis-network graph renderer
  Sidebar.tsx      Entity detail panel (click a node)
  theme.ts         Entity type → color mapping
  types.ts         TypeScript interfaces

server/
  index.ts         Hono API server (port 3200), serves static files in prod
  db.ts            Neo4j driver + Cypher query functions
```

**API endpoints:**
- `GET /api/graph` — all entities + relationships for visualization
- `GET /api/stats` — entity/relationship counts
- `GET /api/entity/:id` — entity details with connected entities

**Data flow:** Frontend fetches `/api/graph` → renders force-directed graph → click node → fetch `/api/entity/:id` → show connections in sidebar.

## Neo4j schema (Memory System 2)

- `(:Entity {id, name, type, updatedAt})` — knowledge graph nodes
- `(:Entity)-[:RELATES {type, status, t_created, t_valid}]->(:Entity)` — directed edges
- Only `status: 'Active'` relationships are shown

Entity IDs are 16-char SHA256 hex strings (e.g. `bf97c43a1025fccd`).

## Config

Neo4j credentials via environment variables:
- `NEO4J_URI` — bolt+s:// connection URI
- `NEO4J_USER` — username
- `NEO4J_PASSWORD` — password
- `NEO4J_DATABASE` — database name (AuraDB Free: instance username, not `neo4j`)

Credentials stored in Vault: `vault kv get secret/2brain/neo4j`

## Development

- Dev mode: Vite on :5173 proxies `/api/*` to `http://localhost:3200`
- Node sizes scale by connection degree; colors by entity type (see `theme.ts`)
- Legend panel: click entity types to filter; search bar for node lookup

## Deploy

Systemd service `brain-chart.service` with Neo4j env vars drop-in:
```bash
npm run build
sudo systemctl restart brain-chart
```

Drop-in: `/etc/systemd/system/brain-chart.service.d/neo4j.conf`

Accessible at `https://brain.voytek-homelab.com` via Traefik (LXC 505, port 3200).
