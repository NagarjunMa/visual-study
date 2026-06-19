# Visual Learning — Interactive System Design, Database & AI Simulator

> See how systems actually work. 15 interactive simulations across 9 tracks — system design, databases, AI, networking, message brokers, rate limiting, audio fingerprinting, and distributed data. Free, no signup.

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

## What Is This?

Interactive SVG simulations where you **watch, break, and fix** real systems in real time. Not static diagrams. Not videos. Live animated simulations.

### 9 Learning Tracks, 15 Simulations

**System Design (Stages 1-6)** — Particle-based, tick-driven metrics
- Baseline architecture & scaling limits
- Stateful vs stateless authentication
- API gateway & rate limiting
- Load balancing & health checks
- Caching strategies & connection pooling
- Data replication & read replicas

**Database Internals (Stages 7-9)** — Interactive, user-driven operations
- **Redis KV Store:** Hash table, LRU eviction, RDB/AOF persistence, crash recovery
- **Cassandra LSM Tree:** WAL, Memtable, SSTables, Bloom filters, compaction
- **PostgreSQL B+ Tree:** Page splits, leaf chain linking, range scans, CTIDs

**AI/ML (Stage 10)** — GPT-style transformer inference
- **LLM Transformer:** Tokenize → embed → multi-head attention → FFN/GELU → softmax → next token prediction
- Deep dives: attention heatmap, FFN neurons, temperature/sampling

**Networking (Stage 11)** — Protocol state machines
- **TCP 3-Way Handshake:** SYN/SYN-ACK/ACK, connection lifecycle, SYN timeout with exponential backoff, RST, FIN/TIME-WAIT

**Message Brokers (Stage 12)** — Progressive reveal architecture
- **Apache Kafka:** Builds understanding layer by layer:
  1. Simple append-only log (producer → log → consumer)
  2. Partition routing (hash(key) % N)
  3. Broker replication (leader/follower, ISR, acks=1 vs acks=all)
  4. Broker failure & leader election
  5. Consumer group rebalancing

**Rate Limiting (Stage 13)** — 5 algorithms compared
- **Rate Limiter:** Base crash demo → Token Bucket → Sliding Window Log → Fixed Window (with thundering herd boundary exploit) → Sliding Window Counter → Leaky Bucket
- Live counters for total / allowed / rejected / queued

**Audio / Signal Processing (Stage 14)** — Shazam algorithm pipeline
- **Shazam Fingerprinting:** Waveform → STFT spectrogram → constellation map (local maxima peaks) → combinatorial hashing (anchor + target zone, `(f₁, f₂, Δt) → 32-bit hash`) → database lookup → time-offset histogram match
- 5 fake songs (Electronic Beat, Piano Melody, Rock Guitar, Jazz Trumpet, Pop Vocal)
- Pure math, no Web Audio API

**Distributed Data (Stage 15)** — Sharding vs Partitioning side-by-side
- **Same hash, two architectures:** LEFT = one server with internal partitions, RIGHT = N independent shards behind a router
- 6 fix modes target one engineering dimension each: write transport (RTT cost), point read, range / scatter-gather, failure blast radius, cross-key transaction (single-node ACID vs 2-Phase Commit), scale wall (1-server saturation vs N-shard flat capacity under load ramp)
- Per-side metrics: latency, network RTTs, bytes-over-network, ok/fail counters

## Features

- **Real-time particle flow** — Watch 5K requests/sec traverse your architecture
- **Live metrics dashboard** — RPS, latency, CPU, cache hit rate, connection pool
- **Progressive problem → fix flow** — See metrics change as you apply solutions
- **Interactive controls** — Insert keys, crash servers, adjust temperature
- **Retro-OS clean design** — Sage/cream palette, pixel fonts, window chrome
- **Scroll-triggered animations** — Window cascades, monitor flicker, scanline sweeps
- **100% client-side** — No backend, no signup, no data collection

## Quick Start

```bash
# Install
npm ci

# Dev server (localhost:5173)
make dev

# Production build
make build
```

### Docker

```bash
make docker-build   # Multi-stage: Node → Nginx
make docker-run     # Serve on port 3000
```

### Static Hosting

Deploy the `dist/` folder to Vercel, Netlify, or any static host.

## Architecture

```
src/
├── App.tsx                    # Router: moduleType → simulation component
├── simulation/
│   ├── types.ts               # Core types + moduleType union
│   ├── stages.ts              # 15 stage configurations across 9 tracks
│   └── engine.ts              # Tick-based simulation (stages 1-6)
├── components/
│   ├── LandingPage.tsx        # 7-section landing page, 9-track folder tree
│   ├── InfoCard.tsx           # Sidebar info + fix mode buttons
│   └── diagram/               # SVG system diagram (stages 1-6)
└── modules/
    ├── redis/                 # Stage 7: hash table, LRU, persistence
    ├── lsm/                   # Stage 8: WAL, Memtable, SSTables, Bloom
    ├── btree/                 # Stage 9: B+ tree, splits, range scans
    ├── transformer/           # Stage 10: GPT decoder, attention, FFN, softmax
    ├── tcp/                   # Stage 11: 3-way handshake, connection lifecycle
    ├── kafka/                 # Stage 12: progressive reveal message broker
    ├── rate-limiter/          # Stage 13: 5 rate-limiting algorithms
    ├── shazam/                # Stage 14: audio fingerprinting pipeline
    └── sharding/              # Stage 15: sharding vs partitioning split-screen
```

### Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| UI | React 19 | Hooks for simulation state |
| Build | Vite 5.4 | Fast HMR, optimized bundles |
| Language | TypeScript | Type safety for simulation logic |
| Styling | Tailwind CSS | Retro clean theme, utility-first |
| Animation | Framer Motion | SVG particle motion |
| Graphics | SVG | Scalable, performant rendering |

### Design System

- **Palette:** Sage bg `#C5C6A8`, cream surfaces `#F0F0E8`, coral accent `#D4654A`, retro blue `#4A6FA5`
- **Fonts:** Press Start 2P (headings), Space Mono (body), VT323 (terminal)
- **Buttons:** Warm cream pill with gold double border (`.retro-btn`)
- **Windows:** Retro-OS chrome with colored title bars

## Adding a New Module

Follow the established pattern:

1. Create `src/modules/mymodule/` with 3 files:
   - `mymodule.types.ts` — State & action types
   - `MyModuleEngine.ts` — Pure functions
   - `MyModuleSimulation.tsx` — `useReducer` + SVG
2. Add stage in `stages.ts` with `moduleType: 'mymodule'`
3. Import + routing in `App.tsx`

## Performance

- **Build:** 458 modules, ~604 KB minified (~172 KB gzip)
- **Page load:** <1s on 3G
- **Animations:** 60 FPS, CSS keyframes for scroll effects
- **Reduced motion:** Full `prefers-reduced-motion` support

## Roadmap

Planned:
- [ ] Virtual Memory & Page Faults (OS internals)
- [ ] Raft Consensus (distributed systems)
- [ ] Event Loop & Task Queues (runtime internals)
- [ ] Consistent Hashing (sharding)
- [ ] CRDT / Vector Clocks (conflict-free replication)

## License

MIT

---

Built for visual learners who want to see how systems actually work.
