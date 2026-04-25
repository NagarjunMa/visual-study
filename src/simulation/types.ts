export type NodeType =
  | 'client'
  | 'server'
  | 'database'
  | 'db-replica'
  | 'load-balancer'
  | 'cache'
  | 'cache-cluster'
  | 'api-gateway'
  | 'session-store'

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

export interface StageInfoCard {
  technicalTerm: string
  whenHappens: string
  whatCondition: string
  howToResolve: string
}

export interface FixModeConfig {
  nodes: SimNode[]
  edges: SimEdge[]
  viewBox: string
  engineId: string
  enterLabel: string       // Button text to enter this fix mode
  description: string      // Short description shown in sidebar header
  technicalTerm?: string   // Overrides infoCard.technicalTerm when in this mode
  whenHappens?: string     // Overrides infoCard.whenHappens when in this mode
  whatCondition?: string   // Overrides infoCard.whatCondition when in this mode
  howToResolve?: string    // Overrides infoCard.howToResolve when in this mode
}

export interface Stage {
  id: string
  title: string
  subtitle: string
  insight: string
  displayTitle: string
  description: string
  components: string[]
  infoCard: StageInfoCard
  fixModes?: FixModeConfig[]  // Multiple fix modes for progressive problem solving
  nodes: SimNode[]
  edges: SimEdge[]
  viewBox: string
  moduleType?: 'btree' | 'lsm' | 'redis-kv'  // For data structure modules (vs system design)
}
