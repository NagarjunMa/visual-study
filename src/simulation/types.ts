export type NodeType =
  | 'client'
  | 'server'
  | 'database'
  | 'load-balancer'
  | 'cache'
  | 'api-gateway'
  | 'session-store'
  | 'cache-cluster'

export type NodeHealth =
  | 'healthy'
  | 'stressed'
  | 'overloaded'
  | 'dead'
  | 'degraded'
  | 'not-ready'

export interface SimNode {
  id: string
  label: string
  type: NodeType
  x: number
  y: number
}

export interface SimEdge {
  id: string
  from: string
  to: string
}

export interface Metrics {
  rps: number
  latencyMs: number
  errorPct: number
  cpuPct: number[]
  cacheHitPct: number
  rejectedRPS?: number
  gatewayRPS?: number
  connectionPoolPct?: number
}

export type ParticleType = 'normal' | 'rejected' | 'rate-limited' | 'cache-hit' | 'cache-miss' | 'error' | 'health-check'

export interface Particle {
  id: string
  waypoints: [number, number][]
  color: string
  duration: number
  spawnedAt: number
  type: ParticleType
}

export interface Stage {
  id: string
  title: string
  subtitle: string
  insight: string
  nodes: SimNode[]
  edges: SimEdge[]
  viewBox: string
}
