# Visual Learning - System Design Visualization Tool

## Project

Interactive learning simulator: 6 system design stages + 3 database internals modules = 9 total stages. Teaches scaling patterns, resilience, and database storage through real-time visualization.

**Content:** System design (stages 1-6) + Database modules (stages 7-9):
- Stages 1-6: distributed system scaling, bottlenecks, caching, replication
- Stage 7: Redis KV store (hash table, LRU, persistence modes)
- Stage 8: Cassandra LSM tree (Memtable, SSTables, Bloom filters, compaction)
- Stage 9: PostgreSQL B+ Tree (index structure, splits, range scans)

**Target:** System design interview prep; database internals learning.

## Tech Stack

- **React 18** - Component hooks for state management and lifecycle
- **Vite** - Fast ES build + HMR development experience
- **Framer Motion** - Physics-based animations for smooth particle transitions
- **Tailwind CSS** - Utility-first styling, dark theme optimized
- **SVG** - Vector graphics for scalable node boxes, flowing connections, particles
- **TypeScript** - Strict type safety for simulation logic

## Architecture

### Simulation Engine (`src/simulation/`)
- `types.ts` - Single source of truth (NodeType, NodeHealth, Metrics, ParticleType)
- `stages.ts` - 6 stage configurations + fixModes. Each stage can have 1–3 nested fix modes for progressive learning
- `engine.ts` - `useSimulation` hook: metrics computation, particle spawning per engineId (stage or fixMode)

**Design:** Functional, immutable. No state management libraries. Metrics computed deterministically from tick number using sigmoid curves for smooth ramps.

### Diagram System (`src/components/diagram/`)
- `SystemDiagram.tsx` - SVG canvas wrapper, health state computation, particle rendering order
- `ComponentBox.tsx` - Node boxes (180×100px) with SVG icons, health borders, status badges
- `FlowConnection.tsx` - Animated edges (cubic bezier curves with dashed animated stroke)
- `RequestParticle.tsx` - Glowing particles, linear waypoint interpolation, type-specific radii

### Page Components (`src/components/`)
- `LandingPage.tsx` - Hero boot animation + 3-column stage selector grid; ESC from simulator returns here
- `InfoCard.tsx` - Left sidebar content: TECHNICAL TERM, WHEN DOES THIS HAPPEN, WHAT IS THIS CONDITION, HOW TO RESOLVE; fix progression buttons (problem → fix 1 → fix 2 → OPTIMIZED)

## 9-Stage Learning Progression

**System Design Stages (1-6):** Each has Base Problem → Fix modes. Total 14 system design steps.

| Stage | Problem | Fixes |
|-------|---------|-------|
| **1** | Baseline: 1 server 15% CPU | — |
| **2** | Stateful Auth: CPU 75% | Stateless refactor (45%) |
| **3** | API Gateway: 20% rejected | Rate limiter + validation (100% pass) |
| **4** | Load Balancer: Server down | Hotspot vs balanced health checks |
| **5** | DB + Cache: Pool 95%, latency 250ms | Cache layer (80% hit, 35ms) → cluster |
| **6** | Data Replication: 15K RPS, pool 100% | Read replicas (18% pool, 28ms) |

**Database Internals Modules (7-9):** Interactive, non-tick-based. Each stage = problem + fix modes.

| Stage | Module | Problem | Fixes |
|-------|--------|---------|-------|
| **7** | Redis KV | Volatile (no persistence) | RDB snapshots \| AOF full log |
| **8** | Cassandra LSM | Memtable→L0 only | Bloom filters \| Compaction |
| **9** | PostgreSQL B+ | Tree structure basics | Range scan efficiency |

## File Structure

```
src/
├── App.tsx                      # Main router: stages 1-9, conditional moduleType rendering
├── simulation/
│   ├── types.ts                 # Stage, FixMode (has moduleType?: 'btree'|'lsm'|'redis-kv')
│   ├── stages.ts                # 9 stages (6 system design + 3 database modules)
│   └── engine.ts                # useSimulation for stages 1-6 only
├── components/
│   ├── LandingPage.tsx
│   ├── InfoCard.tsx
│   └── diagram/ (stages 1-6 only)
│       ├── SystemDiagram.tsx
│       ├── ComponentBox.tsx
│       ├── FlowConnection.tsx
│       └── RequestParticle.tsx
└── modules/ (stages 7-9 interactive)
    ├── redis/
    │   ├── redis.types.ts       # RedisState, PersistenceMode, animation steps
    │   ├── RedisEngine.ts        # Hash table, LRU eviction, persistence logic
    │   └── RedisSimulation.tsx   # SVG renderer + useReducer UI
    ├── lsm/
    │   ├── lsm.types.ts          # Memtable, SSTable, BloomFilter, LSMState
    │   ├── LSMEngine.ts          # Write path, Bloom check, compaction
    │   └── LSMSimulation.tsx      # WAL, Memtable, L0/L1 visualization
    └── btree/
        ├── btree.types.ts        # BTreePage, BTreeState
        ├── BTreeEngine.ts        # Insert with splits, search, range scan
        └── BTreeSimulation.tsx   # Tree layout + rendering (2-pass positioning)
```

## Development Guidelines

### System Design Stages (1-6)

**Add new system design stage:**
1. Create stage object in `stages.ts` with: `id`, `title`, `nodes`, `edges`, `viewBox`, `insight`, `fixModes?`
2. Add `computeMetrics()` case in `engine.ts` for stage's `engineId`
3. Add `getWaypoints()` case for particle paths
4. Add `getNodeHealth()` logic in `SystemDiagram.tsx` if needed

### Database Modules (7-9)

**Add new database module (Redis pattern):**
1. Create `src/modules/mydb/` directory with 3 files:
   - `mydb.types.ts` — State interfaces, action types
   - `MydbEngine.ts` — Pure functions: `createInitialState()`, `dbOperation(state, args)` → new state
   - `MydbSimulation.tsx` — Component with `useReducer(reducer, initialState)`, SVG rendering
2. Create stage in `stages.ts` with `moduleType: 'mydb'`
3. Add import + conditional in `App.tsx`: `currentStage.moduleType === 'mydb'` → render component
4. Stage can have 1-2 fixModes; UI auto-switches based on `fixModeIndex` prop

**Key differences from system design:**
- No `useSimulation` hook (custom logic via engine functions)
- No particle/metric HUD (each module custom visualization)
- `useReducer` for state management (not hooks)
- Stages use `nodes: []`, `edges: []` (layout handled by module)
- Interactive (user-driven actions) vs tick-based (metrics computed)

### Adding New Node Types
1. Add to `NodeType` union in `types.ts`
2. Add typeConfig entry in `ComponentBox.tsx` (color, SVG icon)
3. Update `getStatusText()` to show relevant metric for type
4. Add health-specific visual rendering if needed

### Particle System
- **Spawn rate:** `Math.floor((metrics.rps / 1000) / 16 * 0.8)` per tick
- **Duration:** 1200ms for full paths, 400ms for health-check pings
- **Types & colors:** green (normal request), red (rejected/error), orange (rate-limited/cache-miss), cyan (health-check ping)
- **Stage-specific logic:**
  - **stage-loadbalancer / stage-lb-hotspot / stage-lb-balanced:** Cyan health-check particles from LB to servers
  - **stage-api-gw / stage-agw-fix:** Red rejected particles stop at API gateway (rate limiting)
  - **stage-cache-layer / stage-9 / stage-cache-cluster:** Orange cache-miss particles take full DB path; green cache-hit particles stop at cache layer

### Styling Principles
- Dark theme (Tailwind gray-950 bg): reduces eye strain during learning
- Color coding: green=healthy, amber=stressed, red=critical/overloaded, cyan=informational
- Node health pulse rings: `stressed` (subtle), `overloaded` (large)

## Development & Deployment

### Local Development
```bash
make install   # Install deps
make dev       # Start Vite dev server (localhost:5173)
make build     # Production build → dist/
```

### Docker Deployment
```bash
make docker-build  # Multi-stage build: Node → Nginx
make docker-run    # Serve via Nginx on :3000
```

### Vercel / Static Hosting
- `dist/` output is fully static (no SSR)
- Vite automatically chunks and cache-busts
- Deploy `dist/` folder to any static host

## Dos & Don'ts

### Dos
- Keep stages as pure configuration (src/simulation/stages.ts)
- Use SVG waypoints for particles (no CSS offset-path)
- Compute metrics deterministically from tick number
- Pass stageId context down for stage-specific behavior
- Use sigmoid curves (180→360 ticks) for smooth ramps

### Don'ts
- No backend API (fully client-side)
- No global state (useState only, single source of truth per hook)
- No class-based simulation (functional hooks)
- No CSS animations for particle motion (use SVG interpolation)
- No mixing SVG and canvas rendering
