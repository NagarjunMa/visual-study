import { useEffect, useState } from 'react'
import type { Stage, Metrics, Particle } from './types'

const TICK_INTERVAL = 16 // ~60fps

// Sigmoid ramp 0-1 over 3 seconds (180 ticks)
function sigmoid(tick: number, maxTicks: number = 180): number {
  const t = Math.min(tick / maxTicks, 1)
  return 1 / (1 + Math.exp(-10 * (t - 0.5)))
}

// Compute metrics for current tick and stage
function computeMetrics(stageId: string, tick: number): Metrics {
  switch (stageId) {
    case 'stage-1': {
      // Baseline: stable 100 RPS
      return {
        rps: 100,
        latencyMs: 20,
        errorPct: 0,
        cpuPct: [15],
        cacheHitPct: 0,
      }
    }

    case 'stage-2': {
      // Stateful: ramp to 5K, CPU overhead +30%
      const progress = sigmoid(tick, 360)
      const rps = 100 + progress * (5000 - 100)
      const cpuBase = 15 + (rps / 100) * 0.8 // baseline growth
      const cpuOverhead = progress > 0.5 ? (progress - 0.5) * 60 : 0 // +30% overhead at peak
      const cpu = Math.min(cpuBase + cpuOverhead, 95)
      const latency = 20 + (cpu / 100) * 800
      return {
        rps: Math.round(rps),
        latencyMs: Math.round(latency),
        errorPct: cpu > 80 ? (cpu - 80) * 2 : 0,
        cpuPct: [cpu],
        cacheHitPct: 0,
      }
    }

    case 'stage-3': {
      // Stateless: same RPS, no overhead
      const progress = sigmoid(tick, 360)
      const rps = 100 + progress * (5000 - 100)
      const cpu = 15 + (rps / 100) * 0.3 // no overhead
      const latency = 20 + (cpu / 100) * 200
      return {
        rps: Math.round(rps),
        latencyMs: Math.round(latency),
        errorPct: 0,
        cpuPct: [cpu],
        cacheHitPct: 0,
      }
    }

    case 'stage-4': {
      // Health checks: 9K RPS, 1 of 3 servers dead
      // Server-1: healthy (4.5K), Server-2: dead (0), Server-3: healthy (4.5K)
      return {
        rps: 9000,
        latencyMs: 52,
        errorPct: 3, // brief error window during detection
        cpuPct: [65, 0, 65], // server-2 is dead (0%)
        cacheHitPct: 0,
      }
    }

    case 'stage-5': {
      // Scaled stateless: 9K RPS, 3 servers, 30% each
      return {
        rps: 9000,
        latencyMs: 45,
        errorPct: 0,
        cpuPct: [30, 32, 28],
        cacheHitPct: 0,
      }
    }

    case 'stage-6': {
      // API Gateway: 12K attempted, 20% rejected (2.4K), 9.6K passes
      return {
        rps: 12000,
        latencyMs: 42,
        errorPct: 0,
        cpuPct: [32, 34, 30],
        cacheHitPct: 0,
        rejectedRPS: 2400,
        gatewayRPS: 9600,
      }
    }

    case 'stage-7': {
      // DB Bottleneck: 10K RPS with 3 servers hammering single DB
      const progress = sigmoid(tick, 360)
      const poolUsage = 30 + progress * 65 // 30% → 95%
      const latency = 45 + progress * 205 // 45ms → 250ms
      const errors = progress > 0.6 ? (progress - 0.6) * 20 : 0
      return {
        rps: 10000,
        latencyMs: Math.round(latency),
        errorPct: errors,
        cpuPct: [30, 32, 28],
        cacheHitPct: 0,
        connectionPoolPct: poolUsage,
      }
    }

    case 'stage-cache-layer': {
      // Cache layer added: 80% hits, DB pool drops
      return {
        rps: 10000,
        latencyMs: 35,
        errorPct: 0,
        cpuPct: [20, 22, 18],
        cacheHitPct: 80,
        connectionPoolPct: 25,
      }
    }

    case 'stage-8': {
      // Cache Layer: 80% hit rate, latency drops, pool usage drops
      return {
        rps: 10000,
        latencyMs: 35,
        errorPct: 0,
        cpuPct: [12, 11, 13],
        cacheHitPct: 80,
        connectionPoolPct: 25,
      }
    }

    case 'stage-9': {
      // Cache Failure: hit rate degrades 80% → 40%, latency climbs
      const progress = sigmoid(tick, 360)
      const hitRate = 80 - progress * 40 // 80% → 40%
      const latency = 35 + progress * 145 // 35ms → 180ms
      const poolUsage = 25 + progress * 60 // 25% → 85%
      return {
        rps: 10000,
        latencyMs: Math.round(latency),
        errorPct: 0,
        cpuPct: [20, 22, 18],
        cacheHitPct: hitRate,
        connectionPoolPct: poolUsage,
      }
    }

    case 'stage-10': {
      // DB overload: 15K RPS overwhelms single database despite 85% cache hit
      const progress = sigmoid(tick, 360)
      const poolUsage = 60 + progress * 40 // 60% → 100%
      const latency = 45 + progress * 755 // 45ms → 800ms
      const errorPct = progress > 0.6 ? (progress - 0.6) * 12.5 : 0 // 0% → 5% errors
      const hitRate = 85 - progress * 23 // 85% → 62% (hit rate degrades as DB times out)
      return {
        rps: 15000,
        latencyMs: Math.round(latency),
        errorPct,
        cpuPct: [35, 38, 32],
        cacheHitPct: Math.round(hitRate),
        connectionPoolPct: Math.round(poolUsage),
      }
    }

    case 'stage-cache-cluster': {
      // Cache cluster with replication: resilient, high hit rate, all healthy
      return {
        rps: 10000,
        latencyMs: 35,
        errorPct: 0,
        cpuPct: [20, 22, 18],
        cacheHitPct: 85,
        connectionPoolPct: 18,
      }
    }

    case 'stage-db-replica': {
      // DB replication: primary + 2 read replicas, load distributed
      return {
        rps: 15000,
        latencyMs: 28,
        errorPct: 0,
        cpuPct: [28, 30, 26],
        cacheHitPct: 85,
        connectionPoolPct: 18,
      }
    }

    case 'stage-api-problem': {
      // API Gateway problem: high load hitting servers directly, overloaded
      const progress = sigmoid(tick, 360)
      const rps = 3000 + progress * (14000 - 3000)
      const cpuBase = 20 + progress * 75
      const errorPct = progress > 0.6 ? (progress - 0.6) * 40 : 0
      return {
        rps: Math.round(rps),
        latencyMs: Math.round(30 + progress * 370),
        errorPct,
        cpuPct: [Math.min(cpuBase, 95), Math.min(cpuBase * 0.9, 95), Math.min(cpuBase * 0.85, 95)],
        cacheHitPct: 0,
      }
    }

    case 'stage-lb-problem': {
      // Load Balancer problem: single server handling spike load
      const progress = sigmoid(tick, 300)
      const rps = 500 + progress * (8000 - 500)
      const cpu = 15 + progress * 80
      const errorPct = cpu > 80 ? (cpu - 80) * 3 : 0
      return {
        rps: Math.round(rps),
        latencyMs: Math.round(20 + progress * 480),
        errorPct,
        cpuPct: [Math.min(cpu, 98)],
        cacheHitPct: 0,
      }
    }

    case 'stage-lb-fix1': {
      // Horizontal scaling without LB: hotspot on server-1
      return {
        rps: 9000,
        latencyMs: 85,
        errorPct: 3,
        cpuPct: [72, 16, 12],  // server-1 hotspot, others idle
        cacheHitPct: 0,
      }
    }

    case 'stage-api-gw': {
      // API Gateway problem: unfiltered traffic, no gateway, single stateless server
      const progress = sigmoid(tick, 360)
      const rps = 1000 + progress * (13000 - 1000)
      const cpu = 15 + progress * 80   // ramps to 95%
      const errorPct = cpu > 75 ? (cpu - 75) * 2 : 0
      return {
        rps: Math.round(rps),
        latencyMs: Math.round(20 + progress * 380),
        errorPct,
        cpuPct: [Math.min(cpu, 95)],
        cacheHitPct: 0,
      }
    }

    case 'stage-agw-fix': {
      // API Gateway fix: gateway in place, filters 20% bad traffic
      return {
        rps: 12000,
        latencyMs: 42,
        errorPct: 0,
        cpuPct: [38],
        cacheHitPct: 0,
        rejectedRPS: 2400,
        gatewayRPS: 9600,
      }
    }

    case 'stage-loadbalancer': {
      // Load Balancer problem: single server overloaded with API GW
      const progress = sigmoid(tick, 300)
      const rps = 1000 + progress * (10000 - 1000)
      const cpu = 20 + progress * 78
      const errorPct = cpu > 80 ? (cpu - 80) * 3 : 0
      return {
        rps: Math.round(rps),
        latencyMs: Math.round(25 + progress * 475),
        errorPct,
        cpuPct: [Math.min(cpu, 98)],
        cacheHitPct: 0,
      }
    }

    case 'stage-lb-hotspot': {
      // Load Balancer fix1: 3 servers added but no LB, hotspot on server-1
      return {
        rps: 9000,
        latencyMs: 85,
        errorPct: 3,
        cpuPct: [72, 16, 12],
        cacheHitPct: 0,
      }
    }

    case 'stage-lb-balanced': {
      // Load Balancer fix2: LB in place, even distribution across 3 servers
      return {
        rps: 9000,
        latencyMs: 45,
        errorPct: 0,
        cpuPct: [30, 32, 28],
        cacheHitPct: 0,
      }
    }

    default:
      return {
        rps: 0,
        latencyMs: 0,
        errorPct: 0,
        cpuPct: [],
        cacheHitPct: 0,
      }
  }
}

// Spawn particles for current tick
function spawnParticles(
  stageId: string,
  tick: number,
  metrics: Metrics,
  existingParticles: Particle[]
): Particle[] {
  let newParticles = existingParticles.filter(p => {
    const age = tick - p.spawnedAt
    return age < (p.duration / 16) // Remove expired particles
  })

  // Spawn ~8 particles per tick (RPS / 1000 / 16ms ≈ 8 at 8K RPS)
  const spawnCount = Math.floor((metrics.rps / 1000) / 16 * 0.8)

  for (let i = 0; i < spawnCount; i++) {
    const particleId = `${tick}-${i}-${Math.random()}`
    const baseWaypoints = getWaypoints(stageId)

    let particleType: Particle['type'] = 'normal'
    let waypoints = baseWaypoints
    let color = '#22c55e'
    let duration = 1200

    // Stage-specific particle logic
    if (stageId === 'stage-6') {
      // API Gateway: 20% rejected
      if (Math.random() < 0.2) {
        particleType = 'rejected'
        waypoints = [baseWaypoints[0], baseWaypoints[1]] // stop at gateway
        color = '#ef4444'
        duration = 400
      } else {
        particleType = 'normal'
        color = '#22c55e'
      }
    } else if (stageId === 'stage-8') {
      // Cache: 80% hits, 20% misses
      if (Math.random() < 0.8) {
        particleType = 'cache-hit'
        // Shorter path: server → cache
        waypoints = [baseWaypoints[4], baseWaypoints[7]]
        color = '#22c55e'
        duration = 300
      } else {
        particleType = 'cache-miss'
        // Full path: server → cache → database
        waypoints = [baseWaypoints[4], baseWaypoints[7], baseWaypoints[9]]
        color = '#f97316'
        duration = 1200
      }
    } else if (stageId === 'stage-4') {
      // Health checks: spawn 3 cyan pings every 30 ticks
      if (tick % 30 === 0) {
        const hcParticles = [
          // LB → Server-1 (healthy)
          {
            id: `hc-${tick}-s1`,
            waypoints: [[350, 220], [620, 110]] as [number, number][],
            color: '#06b6d4',
            duration: 400,
            spawnedAt: tick,
            type: 'health-check' as const,
          },
          // LB → Server-2 (fails, fades red mid-path)
          {
            id: `hc-${tick}-s2-fail`,
            waypoints: [[350, 220], [490, 170]] as [number, number][],
            color: '#ef4444',
            duration: 400,
            spawnedAt: tick,
            type: 'health-check' as const,
          },
          // LB → Server-3 (healthy)
          {
            id: `hc-${tick}-s3`,
            waypoints: [[350, 220], [620, 330]] as [number, number][],
            color: '#06b6d4',
            duration: 400,
            spawnedAt: tick,
            type: 'health-check' as const,
          },
        ]
        newParticles.push(...hcParticles)
      }
      // Normal request particles only go to server-1 and server-3 (skip server-2)
      if (spawnCount > 0) {
        for (let i = 0; i < spawnCount; i++) {
          const particleId = `${tick}-${i}-${Math.random()}`
          const toServer = Math.random() < 0.5 ? 1 : 3 // server-1 or server-3
          const serverX = toServer === 1 ? 620 : 620
          const serverY = toServer === 1 ? 110 : 330
          newParticles.push({
            id: particleId,
            waypoints: [[100, 220], [350, 220], [serverX, serverY], [950, 220]],
            color: '#22c55e',
            duration: 1200,
            spawnedAt: tick,
            type: 'normal',
          })
        }
        return newParticles
      }
      return newParticles
    } else if (stageId === 'stage-9') {
      // Cache failure: degrading hit rate
      const hitRate = Math.max(40, 80 - sigmoid(tick, 360) * 40)
      if (Math.random() < hitRate / 100) {
        particleType = 'cache-hit'
        waypoints = [baseWaypoints[4], baseWaypoints[7]]
        color = '#22c55e'
        duration = 300
      } else {
        particleType = 'cache-miss'
        waypoints = [baseWaypoints[4], baseWaypoints[7], baseWaypoints[9]]
        color = '#f97316'
        duration = 1200
      }
    } else if (stageId === 'stage-api-problem') {
      // API problem: direct to random server, some fail (error particles)
      const toServer = Math.floor(Math.random() * 3)  // 0, 1, or 2
      const serverY = toServer === 0 ? 110 : toServer === 1 ? 220 : 330
      const isFailed = Math.random() < 0.15  // 15% failure rate
      if (isFailed) {
        particleType = 'error'
        waypoints = [[100, 220], [400, serverY]]  // stop mid-path (failed)
        color = '#ef4444'
        duration = 600
      } else {
        waypoints = [[100, 220], [400, serverY], [750, 220]]
        color = '#22c55e'
      }
    } else if (stageId === 'stage-lb-fix1') {
      // Hotspot: 70% to server1, 15% to others
      let toServer = 0  // default server-1
      const rand = Math.random()
      if (rand < 0.7) {
        toServer = 0  // server-1: 70% (hotspot)
      } else if (rand < 0.85) {
        toServer = 1  // server-2: 15%
      } else {
        toServer = 2  // server-3: 15%
      }
      const serverY = toServer === 0 ? 110 : toServer === 1 ? 220 : 330
      waypoints = [[100, 220], [450, serverY], [850, 220]]
      color = '#22c55e'
    } else if (stageId === 'stage-agw-fix') {
      // API Gateway fix: 20% rejected at gateway, 80% pass through
      if (Math.random() < 0.2) {
        particleType = 'rejected'
        waypoints = [[100, 220], [300, 220]]  // stop at api-gw
        color = '#ef4444'
        duration = 400
      } else {
        waypoints = [[100, 220], [300, 220], [560, 220], [920, 220]]
        color = '#22c55e'
      }
    } else if (stageId === 'stage-lb-hotspot') {
      // Hotspot without LB: 70% to server-1, 15% to server-2, 15% to server-3
      const rand = Math.random()
      const serverY = rand < 0.70 ? 110 : rand < 0.85 ? 220 : 330
      waypoints = [[80, 220], [280, 220], [500, serverY], [950, 220]]
      color = '#22c55e'
    } else if (stageId === 'stage-lb-balanced') {
      // Load Balancer balanced: even 33% each across 3 servers
      const rand = Math.random()
      const serverY = rand < 0.33 ? 110 : rand < 0.66 ? 220 : 330
      waypoints = [[80, 220], [280, 220], [460, 220], [650, serverY], [1050, 220]]
      color = '#22c55e'
    } else if (stageId === 'stage-7') {
      // DB Bottleneck: all servers hit same db (show bottleneck)
      const rand = Math.random()
      const serverY = rand < 0.33 ? 110 : rand < 0.66 ? 220 : 330
      waypoints = [[80, 220], [280, 220], [460, 220], [650, serverY], [1050, 220]]
      color = '#22c55e'
    } else if (stageId === 'stage-cache-layer') {
      // Cache layer: 80% hits, 20% miss
      if (Math.random() < 0.8) {
        particleType = 'cache-hit'
        waypoints = [baseWaypoints[3], baseWaypoints[7]]  // server → cache
        color = '#22c55e'
        duration = 300
      } else {
        particleType = 'cache-miss'
        waypoints = [baseWaypoints[3], baseWaypoints[7], baseWaypoints[9]]  // server → cache → db
        color = '#f97316'
        duration = 1200
      }
    } else if (stageId === 'stage-cache-cluster') {
      // Cache cluster: 85% hits, 15% miss
      if (Math.random() < 0.85) {
        particleType = 'cache-hit'
        waypoints = [baseWaypoints[3], baseWaypoints[7]]  // server → cache
        color = '#22c55e'
        duration = 300
      } else {
        particleType = 'cache-miss'
        waypoints = [baseWaypoints[3], baseWaypoints[7], baseWaypoints[9]]  // server → cache → db
        color = '#f97316'
        duration = 1200
      }
    } else if (stageId === 'stage-10') {
      // DB overload: hit rate degrading, more misses flood overloaded DB
      const hitRate = Math.max(62, 85 - sigmoid(tick, 360) * 23)
      if (Math.random() < hitRate / 100) {
        particleType = 'cache-hit'
        waypoints = [baseWaypoints[3], baseWaypoints[7]]  // server → cache
        color = '#22c55e'
        duration = 300
      } else {
        particleType = 'cache-miss'
        waypoints = [baseWaypoints[3], baseWaypoints[7], baseWaypoints[9]]  // server → cache → db (overloaded)
        color = '#f97316'
        duration = 1200
      }
    } else if (stageId === 'stage-db-replica') {
      // DB replication: 85% cache hits, 15% reads go to replicas
      if (Math.random() < 0.85) {
        particleType = 'cache-hit'
        waypoints = [baseWaypoints[3], baseWaypoints[7]]  // server → cache
        color = '#22c55e'
        duration = 300
      } else {
        particleType = 'cache-miss'
        waypoints = [baseWaypoints[3], baseWaypoints[7], baseWaypoints[9]]  // server → cache → replica
        color = '#f97316'
        duration = 1200
      }
    }

    newParticles.push({
      id: particleId,
      waypoints,
      color,
      duration,
      spawnedAt: tick,
      type: particleType,
    })
  }

  return newParticles
}

// Get waypoints for each stage
function getWaypoints(stageId: string): [number, number][] {
  switch (stageId) {
    case 'stage-1':
      return [[150, 200], [450, 200], [750, 200]]

    case 'stage-2':
      return [[150, 200], [450, 200], [750, 200]]

    case 'stage-3':
      return [[120, 220], [420, 220], [820, 220]]

    case 'stage-4':
    case 'stage-5':
      return [
        [100, 220], // client
        [350, 220], // load-balancer
        [620, 220], // server-2
        [950, 220], // database
      ]

    case 'stage-6':
      return [
        [80, 220], // client
        [280, 220], // api-gateway
        [520, 220], // load-balancer
        [750, 220], // server-2
        [750, 220], // (duplicate)
        [1150, 220], // database
      ]

    case 'stage-7':
      // DB bottleneck: client → api-gw → lb → server → db
      return [[80, 220], [280, 220], [460, 220], [650, 220], [1050, 220]]

    case 'stage-cache-layer':
      return [
        [60, 220],   // client
        [200, 220],  // api-gateway
        [350, 220],  // load-balancer
        [490, 220],  // server-2
        [490, 220],  // server-2 (duplicate)
        [760, 220],  // cache-2
        [1060, 220], // database (for misses)
        [760, 220],  // cache-2 (index 7, for hit path)
        [490, 220],  // server-2 (index 8, dummy)
        [1060, 220], // database (index 9, for miss path)
      ]

    case 'stage-8':
    case 'stage-9':
    case 'stage-cache-cluster':
      // Cache failure / cluster: same positions as cache layer
      return [
        [60, 220],   // client
        [200, 220],  // api-gateway
        [350, 220],  // load-balancer
        [490, 220],  // server-2
        [490, 220],  // server-2 (duplicate)
        [760, 220],  // cache-2
        [1060, 220], // database (for misses)
        [760, 220],  // cache-2 (index 7, for hit path)
        [490, 220],  // server-2 (index 8, dummy)
        [1060, 220], // database (index 9, for miss path)
      ]

    case 'stage-10':
      // DB overload: cache cluster positions, single DB at center
      return [
        [60, 220],   // client
        [200, 220],  // api-gateway
        [350, 220],  // load-balancer
        [490, 220],  // server-2
        [490, 220],  // server-2
        [760, 220],  // cache-2
        [1060, 220], // database
        [760, 220],  // cache-2
        [490, 220],  // server-2
        [1060, 220], // database
      ]

    case 'stage-db-replica':
      // DB replication: primary at y=130, replicas at y=275 (db-replica-1)
      return [
        [60, 220],   // client
        [200, 220],  // api-gateway
        [350, 220],  // load-balancer
        [490, 220],  // server-2
        [490, 220],  // server-2 (dup)
        [760, 220],  // cache-2
        [1060, 275], // db-replica-1
        [760, 220],  // cache-2 (index 7, hit path)
        [490, 220],  // server-2 (index 8, dummy)
        [1060, 275], // db-replica-1 (index 9, miss path)
      ]

    case 'stage-api-problem': {
      // Client → random server → database
      return [
        [100, 220], // client
        [400, 110], // server-1
        [400, 220], // server-2
        [400, 330], // server-3
        [750, 220], // database
      ]
    }

    case 'stage-lb-problem':
      return [[150, 200], [450, 200], [750, 200]]  // client → server → db

    case 'stage-lb-fix1': {
      // Client → hotspot: mostly server-1, some to s2/s3 → database
      return [
        [100, 220], // client
        [450, 110], // server-1 (hotspot target)
        [450, 220], // server-2
        [450, 330], // server-3
        [850, 220], // database
      ]
    }

    case 'stage-api-gw':
      // client → server → db (+ session-store branch ignored for particle display)
      return [[120, 220], [420, 220], [820, 220]]

    case 'stage-agw-fix':
      // client → api-gw → server → db
      return [[100, 220], [300, 220], [560, 220], [920, 220]]

    case 'stage-loadbalancer':
      // client → api-gw → server → db
      return [[100, 220], [300, 220], [560, 220], [920, 220]]

    case 'stage-lb-hotspot':
      // client → api-gw → server-? → db
      return [[80, 220], [280, 220], [500, 110], [500, 220], [500, 330], [950, 220]]

    case 'stage-lb-balanced':
      // client → api-gw → lb → server-? → db
      return [[80, 220], [280, 220], [460, 220], [650, 110], [650, 220], [650, 330], [1050, 220]]

    default:
      return []
  }
}

export function useSimulation(stage: Stage, isPlaying: boolean) {
  const [tick, setTick] = useState(0)
  const [metrics, setMetrics] = useState<Metrics>(computeMetrics(stage.id, 0))
  const [particles, setParticles] = useState<Particle[]>([])

  // Tick loop
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setTick(t => {
        const nextTick = t + 1
        return nextTick >= 600 ? 0 : nextTick // Reset after ~10 seconds for full ramp
      })
    }, TICK_INTERVAL)

    return () => clearInterval(interval)
  }, [isPlaying])

  // Reset when stage changes
  useEffect(() => {
    setTick(0)
    setParticles([])
  }, [stage.id])

  // Update metrics and particles on tick
  useEffect(() => {
    const newMetrics = computeMetrics(stage.id, tick)
    setMetrics(newMetrics)

    setParticles(prev => spawnParticles(stage.id, tick, newMetrics, prev))
  }, [tick, stage.id])

  return { particles, metrics, tick }
}
