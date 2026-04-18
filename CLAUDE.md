# Visual Learning - System Design Visualization Tool

## Project

Interactive system design learning simulator demonstrating 10 stages of architectural evolution. Teaches scaling challenges, resilience patterns, and distributed system design concepts through real-time particle flow visualization and live metrics.

**Target:** Students preparing for system design interviews; engineers learning architectural patterns.

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
- `stages.ts` - 10 stage configurations with node positions, edges, viewBox scaling
- `engine.ts` - `useSimulation` hook: metrics computation, particle spawning per stage

**Design:** Functional, immutable. No state management libraries. Metrics computed deterministically from tick number using sigmoid curves for smooth ramps.

### Diagram System (`src/components/diagram/`)
- `SystemDiagram.tsx` - SVG canvas wrapper, health state computation, particle rendering order
- `ComponentBox.tsx` - Node boxes (180×100px) with SVG icons, health borders, status badges
- `FlowConnection.tsx` - Animated edges (CSS dashed flow @keyframes)
- `RequestParticle.tsx` - Glowing particles, linear waypoint interpolation, type-specific radii

### Control Panel (`src/components/`)
- `ControlPanel.tsx` - Left sidebar: stage buttons, live metrics, play/pause, insight text

## 10-Stage Learning Progression

| # | Title | Problem | Solution |
|---|-------|---------|----------|
| 1 | Baseline | Single server at 15% CPU | Healthy baseline state |
| 2 | Stateful Problem | Auth check in-memory, CPU → 75% | In-memory session overhead |
| 3 | Stateless Refactor | External session store, CPU → 45% | Decouple state from server |
| 4 | Health Checks | Server-2 dead, LB detects & routes around | Cyan ping particles, failure detection |
| 5 | Scaled Stateless | 3 servers balanced, 30% CPU each | Horizontal scaling works |
| 6 | API Gateway | 20% requests rejected, 9.6K pass | Input validation + rate limiting |
| 7 | DB Bottleneck | Pool usage → 95%, latency → 250ms | Database becomes hotspot (red) |
| 8 | Cache Layer | 80% hit rate, latency → 35ms | Cache short-circuits DB queries |
| 9 | Cache Failure | Cache dims, hits degrade 80%→40% | Single cache node failure cascades |
| 10 | Full Resilience | 15K RPS, all healthy, 85% hit rate | Complete multi-tier architecture |

## File Structure

```
src/
├── App.tsx                    # Main layout: ControlPanel + SystemDiagram
├── index.css                  # Tailwind + @keyframes flowDash
├── simulation/
│   ├── types.ts               # All types (8 node types, 6 health states, 7 particle types)
│   ├── stages.ts              # 10 stage configs (node positions, edges, viewBox)
│   └── engine.ts              # useSimulation hook, metrics, particle spawning
└── components/
    ├── ControlPanel.tsx       # Left sidebar: stages, metrics, play/pause
    └── diagram/
        ├── SystemDiagram.tsx  # SVG wrapper, health computation, rendering
        ├── ComponentBox.tsx   # Node boxes with SVG icons + badges
        ├── FlowConnection.tsx # Animated dashed edges
        └── RequestParticle.tsx # Glowing particles + health-check pings
```

## Development Guidelines

### Adding New Stages
1. Create stage config in `stages.ts` with node positions, edges, viewBox, insight string
2. Add metrics computation in `engine.ts` computeMetrics() switch case
3. Add waypoints in `engine.ts` getWaypoints() for particle paths
4. Test stage health transitions in SystemDiagram.tsx getNodeHealth()

### Adding New Node Types
1. Add to `NodeType` union in `types.ts`
2. Add typeConfig entry in `ComponentBox.tsx` (color, SVG icon)
3. Update `getStatusText()` to show relevant metric for type
4. Add health-specific visual rendering if needed

### Particle System
- **Spawn rate:** `Math.floor((metrics.rps / 1000) / 16 * 0.8)` per tick
- **Duration:** 1200ms for full paths, 400ms for health checks
- **Colors:** green (normal), red (rejected/error), orange (rate-limited/cache-miss), cyan (health-check)
- **Stage-specific logic:** Stage 4 (health checks), Stage 6 (API gateway rejection), Stages 8-9 (cache hits/misses)

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
