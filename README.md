# System Design Simulator

> Interactive learning tool for mastering system design concepts through real-time visualization and particle flow animations.

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

## Overview

**System Design Simulator** teaches distributed systems architecture through 10 progressive stages. Watch request particles flow through an evolving architecture as you learn:

- Single-server baselines and their limitations
- Stateful vs. stateless server design
- Load balancing and horizontal scaling
- Health checks and failure detection
- API gateways and rate limiting
- Database bottlenecks and connection pooling
- Caching strategies and cache invalidation
- Multi-tier resilience patterns

Each stage is interactive: metrics update live, nodes change color based on load (green → amber → red), and particles reveal bottlenecks visually.

## Features

✨ **10-Stage Progression**
- Stage 1-3: Single server, stateful/stateless trade-offs
- Stage 4-5: Load balancing, health checks, scaling
- Stage 6-7: API gateway, database bottleneck
- Stage 8-10: Caching, failure scenarios, full resilience

🎨 **Real-Time Visualization**
- Particles flow through architecture showing request paths
- Color-coded health states: green (healthy), amber (stressed), red (overloaded)
- Animated connections with directional flow indicators
- Component boxes show live metrics (RPS, latency, CPU, pool usage)

📊 **Live Metrics Dashboard**
- Requests per second (RPS)
- Latency (milliseconds)
- Error rate (%)
- Per-server CPU utilization
- Cache hit rate (%)
- DB connection pool usage (%)

⏱️ **Smooth Animations**
- 6-second sigmoid ramps for load progression
- Physics-based particle motion (Framer Motion)
- Health pulse rings for stressed/overloaded nodes
- Smooth state transitions on architecture changes

🐳 **Docker Ready**
- Multi-stage Dockerfile (Node builder → Nginx runtime)
- Production-optimized with gzip, caching headers, health checks
- Single command to run: `make docker-run`

## Quick Start

### Prerequisites

- **Node.js** 20+ ([download](https://nodejs.org/))
- **npm** 10+
- **Docker** 20+ (optional, for containerized deployment)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd visual-learning

# Install dependencies
make install

# Or manually:
npm ci --frozen-lockfile
```

### Development

```bash
# Start dev server with HMR
make dev
# Opens http://localhost:5173

# Run checks
make check

# Build for production
make build

# Preview production build
make preview
```

### Deployment

#### Docker

```bash
# Build Docker image
make docker-build

# Run container (port 3000)
make docker-run

# View logs
make docker-logs

# Stop & clean
make docker-clean
```

#### Static Hosting (Vercel, Netlify, etc.)

```bash
make build
# Deploy the `dist/` folder
```

## Architecture

### Codebase Structure

```
src/
├── App.tsx                   # Main layout component
├── index.css                 # Tailwind + animations
├── simulation/
│   ├── types.ts              # TypeScript types (core domain model)
│   ├── stages.ts             # 10 stage configurations
│   └── engine.ts             # Simulation logic & particle spawning
└── components/
    ├── ControlPanel.tsx      # Stage selector + metrics
    └── diagram/
        ├── SystemDiagram.tsx # SVG canvas & health computation
        ├── ComponentBox.tsx   # Node rendering (boxes + icons)
        ├── FlowConnection.tsx # Animated edges
        └── RequestParticle.tsx # Particle animation
```

### Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| **UI Framework** | React 18 | Hooks for simulation state, efficient re-renders |
| **Build Tool** | Vite 5.4 | Fast HMR, optimized production bundles |
| **Language** | TypeScript 6.0 | Type safety for complex simulation logic |
| **Styling** | Tailwind CSS | Dark theme, utility-first, zero unused CSS |
| **Animation** | Framer Motion | Physics-based particle motion, smooth transitions |
| **Graphics** | SVG | Scalable vector diagrams, performant rendering |
| **Server** | Nginx (Docker) | Minimal footprint, excellent static file serving |

### Key Design Patterns

- **Functional Hooks:** No global state, single source of truth per component
- **Deterministic Metrics:** Computed from tick number, no randomness (except particles)
- **Data-Driven Stages:** All stage configs in `stages.ts`, no hardcoded logic
- **SVG Waypoints:** Particle motion via interpolated waypoint arrays
- **Health State Machine:** Node colors computed from live metrics

## Making Changes

### Add a New Stage

1. Define stage config in `src/simulation/stages.ts`:
   ```typescript
   export const stage11: Stage = {
     id: 'stage-11',
     title: 'Your Stage',
     subtitle: 'Problem description',
     insight: 'What to observe',
     nodes: [ /* ... */ ],
     edges: [ /* ... */ ],
     viewBox: '0 0 1600 440',
   }
   ```

2. Add metrics in `src/simulation/engine.ts` `computeMetrics()`:
   ```typescript
   case 'stage-11': {
     return { rps: 10000, latencyMs: 50, /* ... */ }
   }
   ```

3. Add waypoints in `getWaypoints()`:
   ```typescript
   case 'stage-11':
     return [ /* particle paths */ ]
   ```

4. Update `stages` array export to include `stage11`

### Update Node Icons

Edit `ComponentBox.tsx` → `renderIcon()` function. Add SVG for new `NodeType`.

### Adjust Animation Speed

In `engine.ts`, sigmoid curve: change `360` (6 seconds) to different value.

## Project Commands

```bash
make help           # Show all available commands
make install        # Install dependencies
make dev            # Start development server
make build          # Build for production
make preview        # Preview production build locally
make lint           # Run ESLint
make check          # Verify environment setup
make clean          # Remove build artifacts & node_modules

# Docker
make docker-build   # Build Docker image
make docker-run     # Run container (port 3000)
make docker-stop    # Stop container
make docker-logs    # View live logs
make docker-shell   # Open shell in running container
make docker-clean   # Remove image & container
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- **Build Size:** ~340 KB (gzipped ~107 KB)
- **Page Load:** <1s on 3G
- **Animations:** 60 FPS on modern devices
- **Particle Limit:** ~100 concurrent particles

## Contributing

Contributions welcome! Areas:

- [ ] Additional stages (distributed transactions, circuit breakers, etc.)
- [ ] Mobile-optimized UI
- [ ] Educational content (blog posts, video tutorials)
- [ ] Multi-language support
- [ ] Advanced metrics (p99 latency, queue depth visualization)

## License

MIT

## FAQ

**Q: Is this a production system?**
No, this is an educational tool. Metrics are simplified simulations, not real measurements.

**Q: Can I deploy this myself?**
Yes! `make docker-run` or deploy `dist/` to any static host.

**Q: Can I modify the stages?**
Yes! All stage configs are in `src/simulation/stages.ts`. See "Making Changes" above.

**Q: What if I have a bug or feature request?**
Open an issue on GitHub with details.

## Learning Resources

- [System Design Primer](https://github.com/donnemartin/system-design-primer)
- [Designing Data-Intensive Applications](https://dataintensive.net/) (Book)
- [High Scalability](http://highscalability.com/) (Blog)

---

Built with ❤️ for system design learners.
