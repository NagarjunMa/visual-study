import type {
  RateLimiterState,
  RateLimitAlgorithm,
  RateLimitRequest,
  RateLimitEvent,
  TokenBucketState,
  SlidingWindowLogState,
  FixedWindowState,
  SlidingWindowCounterState,
  LeakyBucketState,
  ServerState,
} from './rate-limiter.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addEvent(
  events: RateLimitEvent[],
  counter: number,
  text: string,
  color: string,
): { events: RateLimitEvent[]; counter: number } {
  const ev: RateLimitEvent = { id: counter + 1, text, color }
  return { events: [ev, ...events].slice(0, 12), counter: counter + 1 }
}

function pushRequest(
  list: RateLimitRequest[],
  req: RateLimitRequest,
): RateLimitRequest[] {
  return [req, ...list].slice(0, 30)
}

// ---------------------------------------------------------------------------
// Default sub-states
// ---------------------------------------------------------------------------

function defaultTokenBucket(): TokenBucketState {
  return { capacity: 10, tokens: 10, refillRate: 2 }
}

function defaultSlidingWindowLog(): SlidingWindowLogState {
  return { windowSize: 10, limit: 5, timestamps: [] }
}

function defaultFixedWindow(tick: number): FixedWindowState {
  return { windowSize: 10, limit: 5, windowStart: tick, count: 0, prevCount: 0, prevWindowStart: tick - 10 }
}

function defaultSlidingWindowCounter(tick: number): SlidingWindowCounterState {
  return { windowSize: 10, limit: 5, windowStart: tick, count: 0, prevWindowStart: tick - 10, prevCount: 0 }
}

function defaultLeakyBucket(): LeakyBucketState {
  return { capacity: 8, queue: [], drainRate: 1 }
}

function defaultServer(): ServerState {
  return { cpuPct: 5, latencyMs: 10, alive: true, processed: 0 }
}

// ---------------------------------------------------------------------------
// Create initial state per mode
// ---------------------------------------------------------------------------

const MODE_MAP: Record<number, RateLimitAlgorithm> = {
  [-1]: 'none',
  0: 'token-bucket',
  1: 'sliding-window-log',
  2: 'fixed-window',
  3: 'sliding-window-counter',
  4: 'leaky-bucket',
}

export function createInitialRateLimiterState(mode: number): RateLimiterState {
  const algorithm = MODE_MAP[mode] ?? 'none'
  return {
    algorithm,
    tick: 0,
    server: defaultServer(),
    tokenBucket: defaultTokenBucket(),
    slidingWindowLog: defaultSlidingWindowLog(),
    fixedWindow: defaultFixedWindow(0),
    slidingWindowCounter: defaultSlidingWindowCounter(0),
    leakyBucket: defaultLeakyBucket(),
    totalRequests: 0,
    allowedCount: 0,
    rejectedCount: 0,
    queuedCount: 0,
    recentRequests: [],
    recentEvents: [],
    eventCounter: 0,
    lastOp: algorithm === 'none' ? 'No rate limiter active' : `${algorithm} ready`,
    autoSending: false,
    burstTriggered: false,
  }
}

// ---------------------------------------------------------------------------
// Process request — routes to active algorithm
// ---------------------------------------------------------------------------

export function rateLimitProcessRequest(state: RateLimiterState): RateLimiterState {
  if (state.algorithm === 'none') return handleNone(state)
  if (state.algorithm === 'token-bucket') return handleTokenBucket(state)
  if (state.algorithm === 'sliding-window-log') return handleSlidingWindowLog(state)
  if (state.algorithm === 'fixed-window') return handleFixedWindow(state)
  if (state.algorithm === 'sliding-window-counter') return handleSlidingWindowCounter(state)
  if (state.algorithm === 'leaky-bucket') return handleLeakyBucket(state)
  return state
}

// --- No rate limiting ---
function handleNone(state: RateLimiterState): RateLimiterState {
  const req: RateLimitRequest = { id: state.totalRequests + 1, timestamp: state.tick, status: 'allowed' }
  const server = { ...state.server }
  server.processed++
  // Every request adds CPU load, no protection
  server.cpuPct = Math.min(100, server.cpuPct + 3)
  server.latencyMs = Math.min(9999, server.latencyMs + Math.floor(server.cpuPct / 10))
  if (server.cpuPct >= 100) server.alive = false

  const { events, counter } = addEvent(
    state.recentEvents, state.eventCounter,
    server.alive ? `REQ #${req.id} → server (CPU ${server.cpuPct}%)` : `REQ #${req.id} → SERVER CRASHED!`,
    server.cpuPct >= 80 ? '#ef4444' : server.cpuPct >= 50 ? '#f59e0b' : '#22c55e',
  )

  return {
    ...state,
    server,
    totalRequests: state.totalRequests + 1,
    allowedCount: state.allowedCount + 1,
    recentRequests: pushRequest(state.recentRequests, req),
    recentEvents: events,
    eventCounter: counter,
    lastOp: server.alive ? `Request #${req.id} passed (no limiter)` : 'Server crashed — no rate limiter!',
  }
}

// --- Token Bucket ---
function handleTokenBucket(state: RateLimiterState): RateLimiterState {
  const tb = { ...state.tokenBucket }
  const allowed = tb.tokens >= 1
  if (allowed) tb.tokens--

  const req: RateLimitRequest = {
    id: state.totalRequests + 1,
    timestamp: state.tick,
    status: allowed ? 'allowed' : 'rejected',
  }

  const server = { ...state.server }
  if (allowed) {
    server.processed++
    server.cpuPct = Math.min(60, 10 + server.processed % 20)
    server.latencyMs = 10 + Math.floor(server.cpuPct / 5)
  }

  const { events, counter } = addEvent(
    state.recentEvents, state.eventCounter,
    allowed
      ? `REQ #${req.id} ✓ (${tb.tokens.toFixed(1)} tokens left)`
      : `REQ #${req.id} ✗ REJECTED (0 tokens)`,
    allowed ? '#22c55e' : '#ef4444',
  )

  return {
    ...state,
    tokenBucket: tb,
    server,
    totalRequests: state.totalRequests + 1,
    allowedCount: state.allowedCount + (allowed ? 1 : 0),
    rejectedCount: state.rejectedCount + (allowed ? 0 : 1),
    recentRequests: pushRequest(state.recentRequests, req),
    recentEvents: events,
    eventCounter: counter,
    lastOp: allowed ? `Allowed (${tb.tokens.toFixed(1)} tokens remain)` : 'Rejected — bucket empty',
  }
}

// --- Sliding Window Log ---
function handleSlidingWindowLog(state: RateLimiterState): RateLimiterState {
  const swl = { ...state.slidingWindowLog }
  // Prune old timestamps
  const cutoff = state.tick - swl.windowSize
  swl.timestamps = swl.timestamps.filter(t => t > cutoff)
  const allowed = swl.timestamps.length < swl.limit
  if (allowed) swl.timestamps = [...swl.timestamps, state.tick]

  const req: RateLimitRequest = {
    id: state.totalRequests + 1,
    timestamp: state.tick,
    status: allowed ? 'allowed' : 'rejected',
  }

  const server = { ...state.server }
  if (allowed) {
    server.processed++
    server.cpuPct = Math.min(50, 10 + server.processed % 15)
    server.latencyMs = 10 + Math.floor(server.cpuPct / 5)
  }

  const { events, counter } = addEvent(
    state.recentEvents, state.eventCounter,
    allowed
      ? `REQ #${req.id} ✓ (${swl.timestamps.length}/${swl.limit} in window)`
      : `REQ #${req.id} ✗ REJECTED (${swl.limit}/${swl.limit} full)`,
    allowed ? '#22c55e' : '#ef4444',
  )

  return {
    ...state,
    slidingWindowLog: swl,
    server,
    totalRequests: state.totalRequests + 1,
    allowedCount: state.allowedCount + (allowed ? 1 : 0),
    rejectedCount: state.rejectedCount + (allowed ? 0 : 1),
    recentRequests: pushRequest(state.recentRequests, req),
    recentEvents: events,
    eventCounter: counter,
    lastOp: allowed
      ? `Allowed (${swl.timestamps.length}/${swl.limit} in window, ${swl.timestamps.length} timestamps stored)`
      : `Rejected — window full (${swl.limit} requests)`,
  }
}

// --- Fixed Window Counter ---
function handleFixedWindow(state: RateLimiterState): RateLimiterState {
  const fw = { ...state.fixedWindow }
  // Check window rollover
  if (state.tick >= fw.windowStart + fw.windowSize) {
    fw.prevCount = fw.count
    fw.prevWindowStart = fw.windowStart
    fw.windowStart = fw.windowStart + fw.windowSize
    fw.count = 0
  }

  fw.count++
  const allowed = fw.count <= fw.limit

  const req: RateLimitRequest = {
    id: state.totalRequests + 1,
    timestamp: state.tick,
    status: allowed ? 'allowed' : 'rejected',
  }

  const server = { ...state.server }
  if (allowed) {
    server.processed++
    server.cpuPct = Math.min(50, 10 + server.processed % 15)
    server.latencyMs = 10 + Math.floor(server.cpuPct / 5)
  }

  const { events, counter } = addEvent(
    state.recentEvents, state.eventCounter,
    allowed
      ? `REQ #${req.id} ✓ (window count: ${fw.count}/${fw.limit})`
      : `REQ #${req.id} ✗ REJECTED (${fw.count}/${fw.limit})`,
    allowed ? '#22c55e' : '#ef4444',
  )

  return {
    ...state,
    fixedWindow: fw,
    server,
    totalRequests: state.totalRequests + 1,
    allowedCount: state.allowedCount + (allowed ? 1 : 0),
    rejectedCount: state.rejectedCount + (allowed ? 0 : 1),
    recentRequests: pushRequest(state.recentRequests, req),
    recentEvents: events,
    eventCounter: counter,
    lastOp: allowed ? `Allowed (${fw.count}/${fw.limit} this window)` : `Rejected — window limit reached`,
    burstTriggered: false,
  }
}

// --- Sliding Window Counter ---
function handleSlidingWindowCounter(state: RateLimiterState): RateLimiterState {
  const swc = { ...state.slidingWindowCounter }
  // Check window rollover
  if (state.tick >= swc.windowStart + swc.windowSize) {
    swc.prevCount = swc.count
    swc.prevWindowStart = swc.windowStart
    swc.windowStart = swc.windowStart + swc.windowSize
    swc.count = 0
  }

  const elapsed = Math.min(1, Math.max(0, (state.tick - swc.windowStart) / swc.windowSize))
  const estimated = swc.prevCount * (1 - elapsed) + swc.count
  const allowed = estimated < swc.limit

  if (allowed) swc.count++

  const req: RateLimitRequest = {
    id: state.totalRequests + 1,
    timestamp: state.tick,
    status: allowed ? 'allowed' : 'rejected',
  }

  const server = { ...state.server }
  if (allowed) {
    server.processed++
    server.cpuPct = Math.min(50, 10 + server.processed % 15)
    server.latencyMs = 10 + Math.floor(server.cpuPct / 5)
  }

  const { events, counter } = addEvent(
    state.recentEvents, state.eventCounter,
    allowed
      ? `REQ #${req.id} ✓ (est: ${estimated.toFixed(1)}/${swc.limit})`
      : `REQ #${req.id} ✗ (est: ${estimated.toFixed(1)} ≥ ${swc.limit})`,
    allowed ? '#22c55e' : '#ef4444',
  )

  return {
    ...state,
    slidingWindowCounter: swc,
    server,
    totalRequests: state.totalRequests + 1,
    allowedCount: state.allowedCount + (allowed ? 1 : 0),
    rejectedCount: state.rejectedCount + (allowed ? 0 : 1),
    recentRequests: pushRequest(state.recentRequests, req),
    recentEvents: events,
    eventCounter: counter,
    lastOp: allowed
      ? `Allowed (weighted est: ${estimated.toFixed(1)})`
      : `Rejected — weighted est ${estimated.toFixed(1)} ≥ limit ${swc.limit}`,
  }
}

// --- Leaky Bucket ---
function handleLeakyBucket(state: RateLimiterState): RateLimiterState {
  const lb = { ...state.leakyBucket }
  const canQueue = lb.queue.length < lb.capacity

  const req: RateLimitRequest = {
    id: state.totalRequests + 1,
    timestamp: state.tick,
    status: canQueue ? 'queued' : 'rejected',
  }

  if (canQueue) {
    lb.queue = [...lb.queue, req]
  }

  const { events, counter } = addEvent(
    state.recentEvents, state.eventCounter,
    canQueue
      ? `REQ #${req.id} queued (${lb.queue.length}/${lb.capacity})`
      : `REQ #${req.id} ✗ OVERFLOW (queue full: ${lb.capacity})`,
    canQueue ? '#3b82f6' : '#ef4444',
  )

  return {
    ...state,
    leakyBucket: lb,
    totalRequests: state.totalRequests + 1,
    queuedCount: state.queuedCount + (canQueue ? 1 : 0),
    rejectedCount: state.rejectedCount + (canQueue ? 0 : 1),
    recentRequests: pushRequest(state.recentRequests, req),
    recentEvents: events,
    eventCounter: counter,
    lastOp: canQueue
      ? `Queued (${lb.queue.length}/${lb.capacity})`
      : 'Rejected — queue overflow',
  }
}

// ---------------------------------------------------------------------------
// Tick — time-based mechanics
// ---------------------------------------------------------------------------

export function rateLimitTick(state: RateLimiterState): RateLimiterState {
  let s = { ...state, tick: state.tick + 1 }

  if (s.algorithm === 'none') {
    // Server slowly recovers if alive, but very slowly
    if (s.server.alive && s.server.cpuPct > 5) {
      s.server = { ...s.server, cpuPct: Math.max(5, s.server.cpuPct - 1) }
      s.server.latencyMs = 10 + Math.floor(s.server.cpuPct / 5)
    }
    return s
  }

  if (s.algorithm === 'token-bucket') {
    const tb = { ...s.tokenBucket }
    tb.tokens = Math.min(tb.capacity, tb.tokens + tb.refillRate)
    s.tokenBucket = tb
    return s
  }

  if (s.algorithm === 'sliding-window-log') {
    const swl = { ...s.slidingWindowLog }
    const cutoff = s.tick - swl.windowSize
    swl.timestamps = swl.timestamps.filter(t => t > cutoff)
    s.slidingWindowLog = swl
    return s
  }

  if (s.algorithm === 'fixed-window') {
    const fw = { ...s.fixedWindow }
    if (s.tick >= fw.windowStart + fw.windowSize) {
      fw.prevCount = fw.count
      fw.prevWindowStart = fw.windowStart
      fw.windowStart = fw.windowStart + fw.windowSize
      fw.count = 0
      s.fixedWindow = fw
      const { events, counter } = addEvent(
        s.recentEvents, s.eventCounter,
        `Window reset (prev: ${fw.prevCount} requests)`,
        '#3b82f6',
      )
      s.recentEvents = events
      s.eventCounter = counter
    }
    return s
  }

  if (s.algorithm === 'sliding-window-counter') {
    const swc = { ...s.slidingWindowCounter }
    if (s.tick >= swc.windowStart + swc.windowSize) {
      swc.prevCount = swc.count
      swc.prevWindowStart = swc.windowStart
      swc.windowStart = swc.windowStart + swc.windowSize
      swc.count = 0
      s.slidingWindowCounter = swc
    }
    return s
  }

  if (s.algorithm === 'leaky-bucket') {
    const lb = { ...s.leakyBucket }
    const toDrain = Math.min(lb.drainRate, lb.queue.length)
    if (toDrain > 0) {
      const drained = lb.queue.slice(0, toDrain)
      lb.queue = lb.queue.slice(toDrain)
      s.leakyBucket = lb

      const server = { ...s.server }
      server.processed += toDrain
      server.cpuPct = Math.min(50, 10 + server.processed % 15)
      server.latencyMs = 10 + Math.floor(server.cpuPct / 5)
      s.server = server
      s.allowedCount += toDrain

      const { events, counter } = addEvent(
        s.recentEvents, s.eventCounter,
        `Drained ${toDrain} req (queue: ${lb.queue.length}/${lb.capacity}) [#${drained.map(d => d.id).join(',')}]`,
        '#22c55e',
      )
      s.recentEvents = events
      s.eventCounter = counter
      s.lastOp = `Drained ${toDrain} → server (queue: ${lb.queue.length})`
    }
    return s
  }

  return s
}

// ---------------------------------------------------------------------------
// Parameter setters
// ---------------------------------------------------------------------------

export function rateLimitSetCapacity(state: RateLimiterState, value: number): RateLimiterState {
  if (state.algorithm === 'token-bucket') {
    const tb = { ...state.tokenBucket, capacity: value, tokens: Math.min(state.tokenBucket.tokens, value) }
    return { ...state, tokenBucket: tb }
  }
  if (state.algorithm === 'leaky-bucket') {
    const lb = { ...state.leakyBucket, capacity: value, queue: state.leakyBucket.queue.slice(0, value) }
    return { ...state, leakyBucket: lb }
  }
  return state
}

export function rateLimitSetRefillRate(state: RateLimiterState, value: number): RateLimiterState {
  return { ...state, tokenBucket: { ...state.tokenBucket, refillRate: value } }
}

export function rateLimitSetDrainRate(state: RateLimiterState, value: number): RateLimiterState {
  return { ...state, leakyBucket: { ...state.leakyBucket, drainRate: value } }
}

export function rateLimitSetWindowSize(state: RateLimiterState, value: number): RateLimiterState {
  if (state.algorithm === 'sliding-window-log') {
    return { ...state, slidingWindowLog: { ...state.slidingWindowLog, windowSize: value } }
  }
  if (state.algorithm === 'fixed-window') {
    return { ...state, fixedWindow: { ...state.fixedWindow, windowSize: value } }
  }
  if (state.algorithm === 'sliding-window-counter') {
    return { ...state, slidingWindowCounter: { ...state.slidingWindowCounter, windowSize: value } }
  }
  return state
}

export function rateLimitSetLimit(state: RateLimiterState, value: number): RateLimiterState {
  if (state.algorithm === 'sliding-window-log') {
    return { ...state, slidingWindowLog: { ...state.slidingWindowLog, limit: value } }
  }
  if (state.algorithm === 'fixed-window') {
    return { ...state, fixedWindow: { ...state.fixedWindow, limit: value } }
  }
  if (state.algorithm === 'sliding-window-counter') {
    return { ...state, slidingWindowCounter: { ...state.slidingWindowCounter, limit: value } }
  }
  return state
}

// ---------------------------------------------------------------------------
// Boundary burst demo (fixed window only)
// ---------------------------------------------------------------------------

export function rateLimitTriggerBurst(state: RateLimiterState): RateLimiterState {
  if (state.algorithm !== 'fixed-window') return state

  // Fast-forward to end of current window and send burst straddling boundary
  const fw = { ...state.fixedWindow }
  let s = { ...state, burstTriggered: true }

  // Fill current window to limit
  const remainInWindow = Math.max(0, fw.limit - fw.count)
  for (let i = 0; i < remainInWindow; i++) {
    s = rateLimitProcessRequest(s)
  }

  // Advance tick past window boundary
  s = { ...s, tick: fw.windowStart + fw.windowSize }
  s.fixedWindow = { ...s.fixedWindow, prevCount: s.fixedWindow.count, prevWindowStart: s.fixedWindow.windowStart, windowStart: s.tick, count: 0 }

  // Fill new window to limit
  for (let i = 0; i < fw.limit; i++) {
    s = rateLimitProcessRequest(s)
  }

  const { events, counter } = addEvent(
    s.recentEvents, s.eventCounter,
    `BURST! ${fw.limit + fw.limit} requests in ${fw.windowSize} ticks (2x limit!)`,
    '#ef4444',
  )
  s.recentEvents = events
  s.eventCounter = counter
  s.lastOp = `Thundering herd: ${fw.limit * 2} allowed in rapid succession!`
  s.burstTriggered = true

  return s
}
