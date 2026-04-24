# Visual Learning - System Design Visualization Tool

## Project

Interactive system design learning simulator: 6 core stages with embedded fix-mode progressions (14 total learning steps). Teaches scaling challenges, resilience patterns, and distributed system design concepts through real-time particle flow visualization, live metrics, and progressive problem-solving.

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

## 6-Stage + FixModes Learning Progression

**Architecture:** 6 selectable parent stages. Each stage progresses: Base Problem → Fix 1 (optional) → Fix 2 (optional) → Optimized. Total effective learning steps: 14.

| Stage | Base | Fix Modes |
|-------|------|-----------|
| **1** | Baseline: 1 server at 15% CPU | — |
| **2** | Stateful Auth Problem: In-memory session store, CPU → 75% | `stage-3`: Stateless Refactor (external store, CPU → 45%) |
| **3** | API Gateway Problem: 20% requests rejected (rate limiting) | `stage-agw-fix`: Rate Limiter + Input Validation (full 9.6K pass) |
| **4** | Load Balancer Problem: Server-2 dead, routing fails | `stage-lb-hotspot`: Hotspot without LB (CPU spikes) → `stage-lb-balanced`: Health checks + LB (all 30% CPU) |
| **5** | DB & Cache Problem: DB pool 95%, latency 250ms | `stage-cache-layer`: Cache layer added (80% hit rate, 35ms latency) → `stage-9`: Cache-2 failure (hits drop 80%→40%) → `stage-cache-cluster`: Redis cluster (85% hit rate, resilient) |
| **6** | Data Replication: 15K RPS overloads single DB (pool 100%, latency 800ms) | `stage-db-replica`: Primary DB + Read Replicas (pool 18%, latency 28ms, 85% hit rate) |

## File Structure

```
src/
├── App.tsx                    # Main layout: sidebar (InfoCard) + diagram (SystemDiagram) + HUD metrics
├── index.css                  # Tailwind + @keyframes flowDash animation
├── simulation/
│   ├── types.ts               # Types: NodeType, NodeHealth, Metrics, ParticleType, Stage, FixMode
│   ├── stages.ts              # 6 stage configs + fixModes (node positions, edges, viewBox, insight text)
│   └── engine.ts              # useSimulation hook: metrics computation, particle spawning per engineId
└── components/
    ├── LandingPage.tsx        # Hero boot animation + stage selector grid (3-col), skipHero prop for ESC return
    ├── InfoCard.tsx           # Left sidebar: stage-aware content with fix progression buttons
    └── diagram/
        ├── SystemDiagram.tsx  # SVG canvas: health computation, particle rendering, glow filters
        ├── ComponentBox.tsx   # Node boxes (180×100px): icons, health borders, status text, dead state X
        ├── FlowConnection.tsx # Animated edges: cubic bezier curves, dashed stroke, arrowhead markers
        └── RequestParticle.tsx # Particles: linear waypoint interpolation, glow, type-specific radii (normal=6px, health-check=3px)
```

## Development Guidelines

### Adding New Stages / FixModes

**New Parent Stage:**
1. Create stage object in `stages.ts` stages array with: `id`, `title`, `nodes`, `edges`, `viewBox`, `insight`, optional `fixModes` array
2. Add `computeMetrics()` case in `engine.ts` for the stage's `engineId`
3. Add `getWaypoints()` case in `engine.ts` for particle paths
4. Add health-check logic in `SystemDiagram.tsx` `getNodeHealth()` if needed

**New FixMode within existing Stage:**
1. Add object to stage's `fixModes` array with: `engineId`, `nodes` (override), `edges` (override), `viewBox` (override), `infoCard` (override)
2. Add `computeMetrics()` case in `engine.ts` for the fixMode's `engineId`
3. Update `getWaypoints()` if new fixMode needs different particle paths
4. InfoCard automatically renders override text if provided; problem/fix buttons update when fixMode added

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
