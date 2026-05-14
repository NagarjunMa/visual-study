export type RateLimitAlgorithm =
  | 'none'
  | 'token-bucket'
  | 'sliding-window-log'
  | 'fixed-window'
  | 'sliding-window-counter'
  | 'leaky-bucket'

export interface RateLimitRequest {
  id: number
  timestamp: number
  status: 'allowed' | 'rejected' | 'queued'
}

export interface TokenBucketState {
  capacity: number
  tokens: number
  refillRate: number
}

export interface SlidingWindowLogState {
  windowSize: number
  limit: number
  timestamps: number[]
}

export interface FixedWindowState {
  windowSize: number
  limit: number
  windowStart: number
  count: number
  prevCount: number
  prevWindowStart: number
}

export interface SlidingWindowCounterState {
  windowSize: number
  limit: number
  windowStart: number
  count: number
  prevWindowStart: number
  prevCount: number
}

export interface LeakyBucketState {
  capacity: number
  queue: RateLimitRequest[]
  drainRate: number
}

export interface ServerState {
  cpuPct: number
  latencyMs: number
  alive: boolean
  processed: number
}

export interface RateLimitEvent {
  id: number
  text: string
  color: string
}

export interface RateLimiterState {
  algorithm: RateLimitAlgorithm
  tick: number

  server: ServerState

  tokenBucket: TokenBucketState
  slidingWindowLog: SlidingWindowLogState
  fixedWindow: FixedWindowState
  slidingWindowCounter: SlidingWindowCounterState
  leakyBucket: LeakyBucketState

  totalRequests: number
  allowedCount: number
  rejectedCount: number
  queuedCount: number
  recentRequests: RateLimitRequest[]

  recentEvents: RateLimitEvent[]
  eventCounter: number
  lastOp: string

  autoSending: boolean
  burstTriggered: boolean
}
