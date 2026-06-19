# Visual Learning - Interactive Systems Visualization

## Project

Interactive learning simulator: 15 stages across 9 tracks. Teaches system design, database internals, LLM inference, networking, message brokers, rate limiting, audio fingerprinting, and distributed-data trade-offs through real-time SVG visualization.

**Tracks & Stages:**
- **System Design (1-6):** Distributed system scaling, bottlenecks, caching, replication
- **Database Internals (7-9):** Redis KV, Cassandra LSM Tree, PostgreSQL B+ Tree
- **AI/ML (10):** LLM Transformer inference (tokenize → embed → attention → FFN → softmax → predict)
- **Networking (11):** TCP 3-way handshake, SYN timeout, RST, connection close, TIME-WAIT
- **Message Brokers (12):** Kafka — progressive reveal: log → partitions → replication → failure → consumer groups
- **Rate Limiting (13):** 5 algorithms — Token Bucket, Sliding Window Log, Fixed Window (thundering herd demo), Sliding Window Counter, Leaky Bucket
- **Audio / Signal Processing (14):** Shazam pipeline — waveform → STFT spectrogram → constellation peaks → combinatorial hashing → time-offset histogram match
- **Distributed Data (15):** Sharding vs Partitioning side-by-side — same hash, two architectures, 6 modes (writes/point/range/failure/2PC/scale-wall)

**Target:** System design interview prep; database internals learning; AI/ML understanding; networking fundamentals; distributed messaging; rate limiting; audio fingerprinting; distributed-data trade-offs.

## Tech Stack

- **React 18** - Component hooks for state management and lifecycle
- **Vite** - Fast ES build + HMR development experience
- **Framer Motion** - Physics-based animations for smooth particle transitions
- **Tailwind CSS** - Utility-first styling, retro clean theme (sage/cream palette)
- **SVG** - Vector graphics for scalable node boxes, flowing connections, particles
- **TypeScript** - Strict type safety for simulation logic

## Design System

**Retro-OS Clean aesthetic:**
- Background: sage/olive `#C5C6A8`
- Surfaces: warm cream `#F0F0E8`, alt `#E8E6D8`
- Accent: coral `#D4654A`
- Window chrome: retro blue `#4A6FA5`
- Buttons: warm cream pill with gold double border
- Fonts: Press Start 2P (H1/labels), Space Mono (body), VT323 (terminal)
- Scroll animations: section-fade-up, window-cascade, monitor-flicker, scanline-sweep

## Architecture

### Simulation Engine (`src/simulation/`)
- `types.ts` - Single source of truth (NodeType, NodeHealth, Metrics, ParticleType, moduleType union)
- `stages.ts` - 15 stage configurations + fixModes
- `engine.ts` - `useSimulation` hook: metrics computation, particle spawning (stages 1-6 only)

### Diagram System (`src/components/diagram/`)
- `SystemDiagram.tsx` - SVG canvas, health computation, particle rendering (cream bg)
- `ComponentBox.tsx` - Node boxes with SVG icons, health borders, status badges
- `FlowConnection.tsx` - Animated edges (cubic bezier, sage-toned strokes)
- `RequestParticle.tsx` - Particles with linear waypoint interpolation

### Page Components (`src/components/`)
- `LandingPage.tsx` - 7-section landing page: hero, value prop, personas, folder tree, FAQ, CTA, footer. Scroll-triggered animations via shared IntersectionObserver.
- `InfoCard.tsx` - Left sidebar: info cards + fix mode buttons (toggle mode for transformer)

### Module Pattern (`src/modules/`)
Each interactive module (stages 7-15) follows:
```
src/modules/[name]/
├── [name].types.ts        # State interfaces, action types
├── [Name]Engine.ts        # Pure functions: createInitialState(), operations → new state
└── [Name]Simulation.tsx   # useReducer + SVG rendering + controls
```

## 15-Stage Learning Progression

**System Design (1-6):** Tick-based, particle flow, live metrics HUD.

| Stage | Problem | Fixes |
|-------|---------|-------|
| **1** | Baseline: 1 server 15% CPU | — |
| **2** | Stateful Auth: CPU 75% | Stateless refactor (45%) |
| **3** | API Gateway: 20% rejected | Rate limiter + validation |
| **4** | Load Balancer: Server down | Hotspot vs balanced health checks |
| **5** | DB + Cache: Pool 95%, 250ms | Cache layer (80% hit, 35ms) → cluster |
| **6** | Data Replication: 15K RPS | Read replicas (18% pool, 28ms) |

**Database Internals (7-9):** Interactive, user-driven.

| Stage | Module | Fixes |
|-------|--------|-------|
| **7** | Redis KV | RDB snapshots \| AOF full log |
| **8** | Cassandra LSM | Bloom filters \| Compaction |
| **9** | PostgreSQL B+ | Range scan efficiency |

**AI/ML (10):** Interactive, fixed input, animated forward pass.

| Stage | Module | Fixes |
|-------|--------|-------|
| **10** | LLM Transformer | Attention deep dive \| FFN deep dive \| Prediction/temperature |

**Networking (11):** Interactive, state machine driven.

| Stage | Module | Fixes |
|-------|--------|-------|
| **11** | TCP Handshake | SYN timeout \| RST \| Connection close & TIME-WAIT |

**Message Brokers (12):** Progressive reveal — each fix mode adds one layer of complexity.

| Stage | Module | Progressive Modes |
|-------|--------|-------------------|
| **12** | Kafka | Base: simple log → Partitions: hash routing → Replication: ISR/acks → Failure: leader election → Consumer groups: rebalancing |

**Rate Limiting (13):** Progressive reveal — each fix mode swaps in a different algorithm.

| Stage | Module | Progressive Modes |
|-------|--------|-------------------|
| **13** | Rate Limiter | Base: no limiter (crash demo) → Token Bucket → Sliding Window Log → Fixed Window (thundering herd) → Sliding Window Counter → Leaky Bucket |

**Audio / Signal Processing (14):** Progressive reveal — full Shazam algorithm pipeline.

| Stage | Module | Progressive Modes |
|-------|--------|-------------------|
| **14** | Shazam | Base: waveform → Spectrogram (STFT grid) → Constellation (peak extraction) → Hashing (anchor+target, (f₁,f₂,Δt)) → Database lookup → Time-offset histogram match |

**Distributed Data (15):** Split-screen comparison — same hash, two architectures, 6 modes target one engineering dimension each.

| Stage | Module | Progressive Modes |
|-------|--------|-------------------|
| **15** | Sharding vs Partitioning | Base: topology reveal → Writes: hash & place (RTT cost) → Point read: single-key prune → Range: sequential scan vs scatter-gather → Failure: total outage vs partial → Atomic transfer: single-node ACID vs 2-Phase Commit → Scale wall: load ramp shows 1-server saturation vs N-shard flat capacity |

## File Structure

```
src/
├── App.tsx                      # Router: moduleType → component
├── simulation/
│   ├── types.ts                 # moduleType union: btree|lsm|redis-kv|transformer|tcp|kafka|rate-limiter|shazam|sharding
│   ├── stages.ts                # 15 stages across 9 tracks
│   └── engine.ts                # useSimulation for stages 1-6
├── components/
│   ├── LandingPage.tsx          # 7-section landing + 9-track folder tree
│   ├── InfoCard.tsx             # Sidebar content + retro pill fix buttons
│   └── diagram/                 # Stages 1-6 SVG system
└── modules/
    ├── redis/                   # Stage 7: hash table, LRU, persistence
    ├── lsm/                     # Stage 8: WAL, Memtable, SSTables, Bloom
    ├── btree/                   # Stage 9: B+ tree, splits, range scans
    ├── transformer/             # Stage 10: GPT decoder, attention, FFN, softmax
    ├── tcp/                     # Stage 11: 3-way handshake, SYN/ACK/RST/FIN
    ├── kafka/                   # Stage 12: progressive reveal (log→partitions→brokers→failure→consumers)
    ├── rate-limiter/            # Stage 13: 5 algorithms (token bucket, sliding window log, fixed window, sliding counter, leaky bucket)
    ├── shazam/                  # Stage 14: audio fingerprinting (spectrogram→peaks→hashing→matching→histogram)
    └── sharding/                # Stage 15: sharding vs partitioning split-screen (writes→point→range→failure→2PC→scale-wall)
```

## Development Guidelines

### Progressive Reveal Pattern (Kafka model)
For complex systems, use progressive reveal instead of showing everything at once:
1. Base mode = simplest possible version (e.g., 1 producer → 1 log → 1 consumer)
2. Each fix mode adds exactly ONE new concept (partitions, then replication, then failure, then scaling)
3. Controls only show what's relevant to current mode
4. Sidebar text only references visible components — never mentions concepts not yet shown
5. `createInitialState(mode)` creates appropriate state per mode

### Adding a New Module (stages 7+ pattern)
1. Create `src/modules/mymodule/` with 3 files (types, engine, simulation)
2. Engine: pure functions, `createInitialState()` + operation functions
3. Simulation: `useReducer`, SVG rendering, controls panel
4. Stage in `stages.ts` with `moduleType: 'mymodule'`
5. Import + conditional in `App.tsx`
6. `getTracks()` in LandingPage.tsx auto-groups by moduleType

### Landing Page Sections
1. Hero (boot animation)
2. Value Prop (See It / Break It / Fix It — window cascade)
3. Who Is This For (persona cards — stagger fade)
4. Simulation Selector (folder tree — loading text + window spawn)
5. FAQ (accordion — monitor flicker)
6. Final CTA (scanline sweep)
7. Footer (simple fade-up)

All scroll-triggered via shared IntersectionObserver + CSS keyframes. `prefers-reduced-motion` supported.

### Styling Principles
- Retro clean palette: sage bg, cream surfaces, coral accent
- Buttons: `.retro-btn` (cream pill, gold double border), `.retro-btn--accent` (coral)
- Windows: `.retro-window` with `.window-titlebar` (retro blue)
- Color coding: green=healthy, amber=stressed, red=critical, coral=accent
- Simulation SVGs use cream backgrounds (`#F0F0E8`) — NOT dark theme

## Development & Deployment

```bash
make install   # Install deps
make dev       # Vite dev server (localhost:5173)
make build     # Production build → dist/
```

### Docker
```bash
make docker-build  # Multi-stage: Node → Nginx
make docker-run    # Nginx on :3000
```

## Dos & Don'ts

### Dos
- Keep stages as pure configuration (stages.ts)
- Use SVG waypoints for particles (no CSS offset-path)
- Compute metrics deterministically from tick number
- Follow retro clean palette (cream/sage/coral)
- Use `.retro-btn` for all interactive buttons

### Don'ts
- No backend API (fully client-side)
- No global state (useState/useReducer only)
- No dark theme (retro clean palette throughout)
- No CSS animations for particle motion (use SVG interpolation)
- No Framer Motion for landing page (CSS keyframes + IntersectionObserver)
