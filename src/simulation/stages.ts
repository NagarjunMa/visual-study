import type { Stage } from './types'

// Stage 1: Baseline - Single server, healthy metrics
export const stage1: Stage = {
  id: 'stage-1',
  title: 'Baseline',
  subtitle: 'Single Server — Healthy Metrics',
  insight: 'Server at 15% CPU — comfortable headroom.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 150, y: 200 },
    { id: 'server', label: 'Server', type: 'server', x: 450, y: 200 },
    { id: 'database', label: 'Database', type: 'database', x: 750, y: 200 },
  ],
  edges: [
    { id: 'client-server', from: 'client', to: 'server' },
    { id: 'server-db', from: 'server', to: 'database' },
  ],
  viewBox: '0 0 900 400',
}

// Stage 2: Stateful Problem - Auth check in-memory (no session-store node)
export const stage2: Stage = {
  id: 'stage-2',
  title: 'Stateful Problem',
  subtitle: 'In-Memory Auth — CPU Spikes at 5K RPS',
  insight: 'Server checks auth in-memory. CPU jumps to 75%.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 150, y: 200 },
    { id: 'server', label: 'Server', type: 'server', x: 450, y: 200 },
    { id: 'database', label: 'Database', type: 'database', x: 750, y: 200 },
  ],
  edges: [
    { id: 'client-server', from: 'client', to: 'server' },
    { id: 'server-db', from: 'server', to: 'database' },
  ],
  viewBox: '0 0 900 400',
}

// Stage 3: Stateless Refactor - Session store decouples state
export const stage3: Stage = {
  id: 'stage-3',
  title: 'Stateless Refactor',
  subtitle: 'Decouple State — Session Store',
  insight: 'Sessions offloaded. Server CPU drops to 45%.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 120, y: 220 },
    { id: 'server', label: 'Server', type: 'server', x: 420, y: 220 },
    { id: 'session-store', label: 'Session Store', type: 'session-store', x: 420, y: 360 },
    { id: 'database', label: 'Database', type: 'database', x: 820, y: 220 },
  ],
  edges: [
    { id: 'client-server', from: 'client', to: 'server' },
    { id: 'server-store', from: 'server', to: 'session-store' },
    { id: 'server-db', from: 'server', to: 'database' },
  ],
  viewBox: '0 0 1000 440',
}

// Stage 4: Health Checks - 1 of 3 servers unhealthy, LB routes around
export const stage4: Stage = {
  id: 'stage-4',
  title: 'Health Checks',
  subtitle: 'Detect Failures — Route Around Dead Nodes',
  insight: 'Server-2 dead. Load balancer skips it.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 100, y: 220 },
    { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer', x: 350, y: 220 },
    { id: 'server-1', label: 'Server 1', type: 'server', x: 620, y: 110 },
    { id: 'server-2', label: 'Server 2', type: 'server', x: 620, y: 220 },
    { id: 'server-3', label: 'Server 3', type: 'server', x: 620, y: 330 },
    { id: 'database', label: 'Database', type: 'database', x: 950, y: 220 },
  ],
  edges: [
    { id: 'client-lb', from: 'client', to: 'load-balancer' },
    { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
    { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
    { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
    { id: 's1-db', from: 'server-1', to: 'database' },
    { id: 's2-db', from: 'server-2', to: 'database' },
    { id: 's3-db', from: 'server-3', to: 'database' },
  ],
  viewBox: '0 0 1100 440',
}

// Stage 5: Scaled Stateless - 3 healthy servers, balanced load
export const stage5: Stage = {
  id: 'stage-5',
  title: 'Scaled Stateless',
  subtitle: 'Horizontal Scaling — All Servers Healthy',
  insight: '9K RPS across 3 servers. Each at 30% CPU.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 100, y: 220 },
    { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer', x: 350, y: 220 },
    { id: 'server-1', label: 'Server 1', type: 'server', x: 620, y: 110 },
    { id: 'server-2', label: 'Server 2', type: 'server', x: 620, y: 220 },
    { id: 'server-3', label: 'Server 3', type: 'server', x: 620, y: 330 },
    { id: 'database', label: 'Database', type: 'database', x: 950, y: 220 },
  ],
  edges: [
    { id: 'client-lb', from: 'client', to: 'load-balancer' },
    { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
    { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
    { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
    { id: 's1-db', from: 'server-1', to: 'database' },
    { id: 's2-db', from: 'server-2', to: 'database' },
    { id: 's3-db', from: 'server-3', to: 'database' },
  ],
  viewBox: '0 0 1100 440',
}

// Stage 6: API Gateway - Filters 20% invalid, rate-limits to 8.5K
export const stage6: Stage = {
  id: 'stage-6',
  title: 'API Gateway',
  subtitle: 'Validate & Rate-Limit — 20% Rejection Rate',
  insight: '12K attempted RPS. Gateway rejects 20%, passes 9.6K.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 80, y: 220 },
    { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 280, y: 220 },
    { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer', x: 520, y: 220 },
    { id: 'server-1', label: 'Server 1', type: 'server', x: 750, y: 110 },
    { id: 'server-2', label: 'Server 2', type: 'server', x: 750, y: 220 },
    { id: 'server-3', label: 'Server 3', type: 'server', x: 750, y: 330 },
    { id: 'database', label: 'Database', type: 'database', x: 1150, y: 220 },
  ],
  edges: [
    { id: 'client-gw', from: 'client', to: 'api-gateway' },
    { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
    { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
    { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
    { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
    { id: 's1-db', from: 'server-1', to: 'database' },
    { id: 's2-db', from: 'server-2', to: 'database' },
    { id: 's3-db', from: 'server-3', to: 'database' },
  ],
  viewBox: '0 0 1300 440',
}

// Stage 7: DB Bottleneck - 10K RPS accepted but DB maxes out
export const stage7: Stage = {
  id: 'stage-7',
  title: 'DB Bottleneck',
  subtitle: 'Database Saturation — Connection Pool Exhausted',
  insight: 'DB connection pool at 95%. Latency climbs to 250ms.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 80, y: 220 },
    { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 280, y: 220 },
    { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer', x: 520, y: 220 },
    { id: 'server-1', label: 'Server 1', type: 'server', x: 750, y: 110 },
    { id: 'server-2', label: 'Server 2', type: 'server', x: 750, y: 220 },
    { id: 'server-3', label: 'Server 3', type: 'server', x: 750, y: 330 },
    { id: 'database', label: 'Database', type: 'database', x: 1150, y: 220 },
  ],
  edges: [
    { id: 'client-gw', from: 'client', to: 'api-gateway' },
    { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
    { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
    { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
    { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
    { id: 's1-db', from: 'server-1', to: 'database' },
    { id: 's2-db', from: 'server-2', to: 'database' },
    { id: 's3-db', from: 'server-3', to: 'database' },
  ],
  viewBox: '0 0 1300 440',
}

// Stage 8: Cache Layer - 80% hit rate, latency drops to 35ms
export const stage8: Stage = {
  id: 'stage-8',
  title: 'Cache Layer',
  subtitle: 'Caching — Hit Rate 80%, Latency Drops',
  insight: '80% cache hits. Latency drops to 35ms. DB load halved.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 120, y: 220 },
    { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 320, y: 220 },
    { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer', x: 540, y: 220 },
    { id: 'server-1', label: 'Server 1', type: 'server', x: 750, y: 110 },
    { id: 'server-2', label: 'Server 2', type: 'server', x: 750, y: 220 },
    { id: 'server-3', label: 'Server 3', type: 'server', x: 750, y: 330 },
    { id: 'cache-1', label: 'Cache 1', type: 'cache', x: 1020, y: 140 },
    { id: 'cache-2', label: 'Cache 2', type: 'cache', x: 1020, y: 220 },
    { id: 'cache-3', label: 'Cache 3', type: 'cache', x: 1020, y: 300 },
    { id: 'database', label: 'Database', type: 'database', x: 1350, y: 220 },
  ],
  edges: [
    { id: 'client-gw', from: 'client', to: 'api-gateway' },
    { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
    { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
    { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
    { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
    { id: 's1-cache1', from: 'server-1', to: 'cache-1' },
    { id: 's1-cache2', from: 'server-1', to: 'cache-2' },
    { id: 's2-cache1', from: 'server-2', to: 'cache-1' },
    { id: 's2-cache2', from: 'server-2', to: 'cache-2' },
    { id: 's2-cache3', from: 'server-2', to: 'cache-3' },
    { id: 's3-cache2', from: 'server-3', to: 'cache-2' },
    { id: 's3-cache3', from: 'server-3', to: 'cache-3' },
    { id: 'cache1-db', from: 'cache-1', to: 'database' },
    { id: 'cache2-db', from: 'cache-2', to: 'database' },
    { id: 'cache3-db', from: 'cache-3', to: 'database' },
  ],
  viewBox: '0 0 1600 440',
}

// Stage 9: Cache Failure - Cache node fails, hit rate drops, latency climbs
export const stage9: Stage = {
  id: 'stage-9',
  title: 'Cache Failure',
  subtitle: 'Cache Node Down — Hit Rate Degrades',
  insight: 'Cache fails. Hit rate drops 80%→40%. Latency climbs.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 120, y: 220 },
    { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 320, y: 220 },
    { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer', x: 540, y: 220 },
    { id: 'server-1', label: 'Server 1', type: 'server', x: 750, y: 110 },
    { id: 'server-2', label: 'Server 2', type: 'server', x: 750, y: 220 },
    { id: 'server-3', label: 'Server 3', type: 'server', x: 750, y: 330 },
    { id: 'cache-1', label: 'Cache 1', type: 'cache', x: 1020, y: 140 },
    { id: 'cache-2', label: 'Cache 2', type: 'cache', x: 1020, y: 220 },
    { id: 'cache-3', label: 'Cache 3', type: 'cache', x: 1020, y: 300 },
    { id: 'database', label: 'Database', type: 'database', x: 1350, y: 220 },
  ],
  edges: [
    { id: 'client-gw', from: 'client', to: 'api-gateway' },
    { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
    { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
    { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
    { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
    { id: 's1-cache1', from: 'server-1', to: 'cache-1' },
    { id: 's1-cache2', from: 'server-1', to: 'cache-2' },
    { id: 's2-cache1', from: 'server-2', to: 'cache-1' },
    { id: 's2-cache2', from: 'server-2', to: 'cache-2' },
    { id: 's2-cache3', from: 'server-2', to: 'cache-3' },
    { id: 's3-cache2', from: 'server-3', to: 'cache-2' },
    { id: 's3-cache3', from: 'server-3', to: 'cache-3' },
    { id: 'cache1-db', from: 'cache-1', to: 'database' },
    { id: 'cache2-db', from: 'cache-2', to: 'database' },
    { id: 'cache3-db', from: 'cache-3', to: 'database' },
  ],
  viewBox: '0 0 1600 440',
}

// Stage 10: Full Resilience - Complete multi-tier, 0% error, low latency at 15K RPS
export const stage10: Stage = {
  id: 'stage-10',
  title: 'Full Resilience',
  subtitle: 'Multi-Tier System — 15K RPS, Zero Errors',
  insight: '15K RPS. All healthy. 85% cache hit. 28ms latency.',
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 120, y: 220 },
    { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 320, y: 220 },
    { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer', x: 540, y: 220 },
    { id: 'server-1', label: 'Server 1', type: 'server', x: 750, y: 110 },
    { id: 'server-2', label: 'Server 2', type: 'server', x: 750, y: 220 },
    { id: 'server-3', label: 'Server 3', type: 'server', x: 750, y: 330 },
    { id: 'cache-1', label: 'Cache 1', type: 'cache', x: 1020, y: 140 },
    { id: 'cache-2', label: 'Cache 2', type: 'cache', x: 1020, y: 220 },
    { id: 'cache-3', label: 'Cache 3', type: 'cache', x: 1020, y: 300 },
    { id: 'database', label: 'Database', type: 'database', x: 1350, y: 220 },
  ],
  edges: [
    { id: 'client-gw', from: 'client', to: 'api-gateway' },
    { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
    { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
    { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
    { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
    { id: 's1-cache1', from: 'server-1', to: 'cache-1' },
    { id: 's1-cache2', from: 'server-1', to: 'cache-2' },
    { id: 's2-cache1', from: 'server-2', to: 'cache-1' },
    { id: 's2-cache2', from: 'server-2', to: 'cache-2' },
    { id: 's2-cache3', from: 'server-2', to: 'cache-3' },
    { id: 's3-cache2', from: 'server-3', to: 'cache-2' },
    { id: 's3-cache3', from: 'server-3', to: 'cache-3' },
    { id: 'cache1-db', from: 'cache-1', to: 'database' },
    { id: 'cache2-db', from: 'cache-2', to: 'database' },
    { id: 'cache3-db', from: 'cache-3', to: 'database' },
  ],
  viewBox: '0 0 1600 440',
}

export const stages: Stage[] = [
  stage1,
  stage2,
  stage3,
  stage4,
  stage5,
  stage6,
  stage7,
  stage8,
  stage9,
  stage10,
]
