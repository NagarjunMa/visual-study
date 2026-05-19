import type {
  Bucket, NodeState, QueryInFlight, ShardingEvent,
  ShardingState, Side, SideMetrics, TxnState,
} from './sharding.types'

// ─── Shared constants ─────────────────────────────────────────────────────────

export const KEY_SET = [3, 7, 12, 19, 27, 42, 88, 113, 256, 451, 777, 999]

export const PARTITION_COLORS = ['#4A6FA5', '#C4A55A', '#7A9B6A', '#D4654A']
export const PARTITION_LABELS = ['P0', 'P1', 'P2', 'P3']
export const SHARD_LABELS = ['S0', 'S1', 'S2', 'S3']

// Layout (viewBox 1400 x 620)
//   LEFT half  x ∈ [20, 680]
//   DIVIDER    x = 700
//   RIGHT half x ∈ [720, 1380]
export const VIEW_W = 1400
export const VIEW_H = 620
export const DIVIDER_X = 700

// LEFT layout: planner exit and partition target points
export const LEFT_PLANNER = { x: 370, y: 195 }
export const LEFT_PARTITION_X = [130, 290, 450, 610]
export const LEFT_PARTITION_Y_TOP = 280
export const LEFT_SERVER_BOX = { x: 40, y: 220, w: 640, h: 280 }
export const LEFT_PARTITION_BOX = { y: 270, h: 220, w: 140 }

// RIGHT layout: router exit and shard target points
export const RIGHT_ROUTER = { x: 1050, y: 195 }
export const RIGHT_SHARD_X = [810, 970, 1130, 1290]
export const RIGHT_SHARD_Y_TOP = 280
export const RIGHT_SHARD_BOX = { y: 270, h: 220, w: 140 }

// Timing (ticks @ 80ms per tick → ~12.5 ticks/sec)
const LEFT_WRITE_DUR = 7      // ~560ms
const RIGHT_WRITE_DUR = 14    // ~1120ms (felt as "network is slow")
const LEFT_READ_DUR = 6
const RIGHT_READ_DUR = 12
const TXN_HOP_DUR = 12

// Sizes
const ROW_PAYLOAD_BYTES = 64

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function bucketOf(key: number): Bucket {
  return (((key % 4) + 4) % 4) as Bucket
}

function emptyMetrics(): SideMetrics {
  return { reads: 0, writes: 0, bytesNetwork: 0, rtts: 0, ok: 0, failed: 0, lastLatencyMs: 0 }
}

function makeNodes(): NodeState[] {
  return [0, 1, 2, 3].map(id => ({ id, alive: true, rows: [] }))
}

function seedNodes(nodes: NodeState[], keys: number[]) {
  for (const k of keys) {
    const b = bucketOf(k)
    nodes[b].rows.push({ id: k, bucket: b })
  }
  for (const n of nodes) n.rows.sort((a, b) => a.id - b.id)
}

function pushEvent(state: ShardingState, side: Side, text: string, color: string): ShardingState {
  const ev: ShardingEvent = { id: state.eventCounter + 1, side, text, color }
  return {
    ...state,
    eventCounter: state.eventCounter + 1,
    recentEvents: [ev, ...state.recentEvents].slice(0, 14),
  }
}

function nextQueryId(state: ShardingState): number {
  return state.queryCounter + 1
}

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialShardingState(mode: number = -1): ShardingState {
  const leftPartitions = makeNodes()
  const rightShards = makeNodes()

  // Pre-populate for mode 1+ (point read, range, failure, txn).
  // Modes -1 and 0 start empty: base = topology only, mode 0 = stepwise insert demo.
  if (mode >= 1) {
    seedNodes(leftPartitions, KEY_SET)
    seedNodes(rightShards, KEY_SET)
  }

  const seededWrites = mode >= 1 ? KEY_SET.length : 0
  const seededRtts = mode >= 1 ? KEY_SET.length : 0
  const seededBytes = mode >= 1 ? KEY_SET.length * ROW_PAYLOAD_BYTES : 0

  return {
    tick: 0,
    mode,
    leftPartitions,
    leftServerAlive: true,
    rightShards,
    inFlight: [],
    recentEvents: [],
    eventCounter: 0,
    queryCounter: 0,
    metrics: {
      left: { ...emptyMetrics(), writes: seededWrites, ok: seededWrites },
      right: {
        ...emptyMetrics(),
        writes: seededWrites,
        ok: seededWrites,
        rtts: seededRtts,
        bytesNetwork: seededBytes,
      },
    },
    txn: null,
    lastOp: mode === -1
      ? 'TOPOLOGY — 1 server vs N shards'
      : mode === 0
      ? 'INSERT keys: same hash, two transports'
      : mode === 1
      ? 'POINT READ — single key, both prune'
      : mode === 2
      ? 'RANGE — sequential vs scatter-gather'
      : mode === 3
      ? 'FAILURE — total outage vs partial'
      : mode === 4
      ? 'ATOMIC TRANSFER — ACID vs 2PC'
      : 'SCALE WALL — single server saturates vs N shards stay flat',
    insertCursor: 0,
    scaleLoadRps: 0,
    scaleRamping: false,
    scaleTicks: 0,
    scaleStorageBytes: 0,
  }
}

// ─── Mode 5: Scale Wall constants + ops ──────────────────────────────────────

export const SCALE_MAX_RPS = 200_000
export const LEFT_DISK_CAP_BYTES = 1_000_000_000   // displayed as "1 TB"
export const BYTES_PER_TICK_PER_RPS = 80           // synthetic — 100K rps fills 1 GB in ~10s
export const SHARD_COUNT = 4

export function setScaleLoad(state: ShardingState, rps: number): ShardingState {
  const clamped = Math.max(0, Math.min(SCALE_MAX_RPS, Math.round(rps)))
  return { ...state, scaleLoadRps: clamped }
}

export function toggleScaleRamp(state: ShardingState): ShardingState {
  return { ...state, scaleRamping: !state.scaleRamping }
}

export function resetScale(state: ShardingState): ShardingState {
  return { ...state, scaleRamping: false, scaleTicks: 0, scaleStorageBytes: 0 }
}

export function leftCpuPct(rps: number): number {
  return Math.min(100, rps / 1000)  // 100K rps saturates one server
}

export function leftLatencyMs(rps: number, storagePct: number): number {
  if (storagePct >= 100) return 9999
  const cpu = leftCpuPct(rps)
  if (cpu < 80) return 1 + cpu / 10                      // 1..9 ms
  return 8 + Math.pow(cpu - 80, 1.8)                     // 8..~280 ms at 100%
}

export function leftErrorPct(rps: number, storagePct: number): number {
  if (storagePct >= 100) return 100
  const cpu = leftCpuPct(rps)
  return cpu > 90 ? Math.min(100, (cpu - 90) * 10) : 0
}

export function rightShardCpuPct(rps: number): number {
  return Math.min(100, rps / (1000 * SHARD_COUNT))       // 400K rps saturates each shard
}

export function rightShardLatencyMs(rps: number): number {
  const cpu = rightShardCpuPct(rps)
  return 3 + cpu / 25                                    // 3..7 ms
}

export function shardingSetMode(_state: ShardingState, mode: number): ShardingState {
  return createInitialShardingState(mode)
}

// ─── Particle spawn helpers ──────────────────────────────────────────────────

function spawnLeftWrite(state: ShardingState, key: number): QueryInFlight {
  const b = bucketOf(key)
  return {
    id: nextQueryId(state),
    side: 'left',
    kind: 'write',
    key,
    bucket: b,
    fromX: LEFT_PLANNER.x,
    fromY: LEFT_PLANNER.y,
    toX: LEFT_PARTITION_X[b],
    toY: LEFT_PARTITION_Y_TOP,
    startTick: state.tick,
    durationTicks: LEFT_WRITE_DUR,
    status: 'live',
    color: PARTITION_COLORS[b],
  }
}

function spawnRightWrite(state: ShardingState, key: number, alive: boolean): QueryInFlight {
  const b = bucketOf(key)
  return {
    id: nextQueryId(state),
    side: 'right',
    kind: 'write',
    key,
    bucket: b,
    fromX: RIGHT_ROUTER.x,
    fromY: RIGHT_ROUTER.y,
    toX: RIGHT_SHARD_X[b],
    toY: RIGHT_SHARD_Y_TOP,
    startTick: state.tick,
    durationTicks: RIGHT_WRITE_DUR,
    status: alive ? 'live' : 'failed',
    color: alive ? PARTITION_COLORS[b] : '#ef4444',
  }
}

function spawnLeftRead(state: ShardingState, key: number, bucket: Bucket, idOffset: number): QueryInFlight {
  return {
    id: nextQueryId(state) + idOffset,
    side: 'left',
    kind: 'point',
    key,
    bucket,
    fromX: LEFT_PLANNER.x,
    fromY: LEFT_PLANNER.y,
    toX: LEFT_PARTITION_X[bucket],
    toY: LEFT_PARTITION_Y_TOP,
    startTick: state.tick,
    durationTicks: LEFT_READ_DUR,
    status: 'live',
    color: PARTITION_COLORS[bucket],
  }
}

function spawnRightRead(state: ShardingState, key: number, bucket: Bucket, idOffset: number, alive: boolean): QueryInFlight {
  return {
    id: nextQueryId(state) + idOffset,
    side: 'right',
    kind: 'point',
    key,
    bucket,
    fromX: RIGHT_ROUTER.x,
    fromY: RIGHT_ROUTER.y,
    toX: RIGHT_SHARD_X[bucket],
    toY: RIGHT_SHARD_Y_TOP,
    startTick: state.tick,
    durationTicks: RIGHT_READ_DUR,
    status: alive ? 'live' : 'failed',
    color: alive ? PARTITION_COLORS[bucket] : '#ef4444',
  }
}

// ─── Operations ──────────────────────────────────────────────────────────────

export function insertKey(state: ShardingState, key: number): ShardingState {
  const b = bucketOf(key)
  let next: ShardingState = { ...state }
  const inFlight = [...state.inFlight]
  const leftAlive = state.leftServerAlive
  const rightAlive = state.rightShards[b].alive
  let leftMetrics = { ...state.metrics.left }
  let rightMetrics = { ...state.metrics.right }
  let leftPartitions = state.leftPartitions
  let rightShards = state.rightShards

  // LEFT: in-process write. If server dead → failure.
  if (leftAlive) {
    inFlight.push(spawnLeftWrite(next, key))
    leftPartitions = leftPartitions.map((p, i) =>
      i === b ? { ...p, rows: [...p.rows, { id: key, bucket: b }].sort((a, b) => a.id - b.id) } : p,
    )
    leftMetrics.writes += 1
    leftMetrics.ok += 1
    leftMetrics.lastLatencyMs = 0.5
  } else {
    leftMetrics.failed += 1
    next = pushEvent(next, 'left', `WRITE k=${key} FAILED — server down`, '#ef4444')
  }
  next.queryCounter += 1

  // RIGHT: network write. If shard dead → failure (counts an RTT lost too).
  if (rightAlive) {
    inFlight.push(spawnRightWrite(next, key, true))
    rightShards = rightShards.map((s, i) =>
      i === b ? { ...s, rows: [...s.rows, { id: key, bucket: b }].sort((a, b) => a.id - b.id) } : s,
    )
    rightMetrics.writes += 1
    rightMetrics.ok += 1
    rightMetrics.rtts += 1
    rightMetrics.bytesNetwork += ROW_PAYLOAD_BYTES
    rightMetrics.lastLatencyMs = 3
  } else {
    inFlight.push(spawnRightWrite(next, key, false))
    rightMetrics.failed += 1
    rightMetrics.rtts += 1
    rightMetrics.bytesNetwork += ROW_PAYLOAD_BYTES
    next = pushEvent(next, 'right', `WRITE k=${key} FAILED — shard ${SHARD_LABELS[b]} down`, '#ef4444')
  }
  next.queryCounter += 1

  return {
    ...next,
    inFlight,
    leftPartitions,
    rightShards,
    metrics: { left: leftMetrics, right: rightMetrics },
    lastOp: `INSERT k=${key} → bucket ${b}  (LEFT: in-process • RIGHT: 1 RTT)`,
  }
}

export function insertNextKey(state: ShardingState): ShardingState {
  if (state.insertCursor >= KEY_SET.length) return state
  const key = KEY_SET[state.insertCursor]
  const next = insertKey(state, key)
  return { ...next, insertCursor: state.insertCursor + 1 }
}

export function pointQuery(state: ShardingState, key: number): ShardingState {
  const b = bucketOf(key)
  let next: ShardingState = { ...state }
  const inFlight = [...state.inFlight]
  let leftMetrics = { ...state.metrics.left }
  let rightMetrics = { ...state.metrics.right }

  // LEFT point read
  if (state.leftServerAlive) {
    inFlight.push(spawnLeftRead(next, key, b, 0))
    leftMetrics.reads += 1
    leftMetrics.ok += 1
    leftMetrics.lastLatencyMs = 0.5
  } else {
    leftMetrics.failed += 1
    next = pushEvent(next, 'left', `READ k=${key} FAILED — server down`, '#ef4444')
  }
  next.queryCounter += 1

  // RIGHT point read
  const shardAlive = state.rightShards[b].alive
  inFlight.push(spawnRightRead(next, key, b, 1, shardAlive))
  if (shardAlive) {
    rightMetrics.reads += 1
    rightMetrics.ok += 1
    rightMetrics.rtts += 1
    rightMetrics.bytesNetwork += ROW_PAYLOAD_BYTES
    rightMetrics.lastLatencyMs = 3
  } else {
    rightMetrics.failed += 1
    rightMetrics.rtts += 1
    next = pushEvent(next, 'right', `READ k=${key} FAILED — shard ${SHARD_LABELS[b]} down`, '#ef4444')
  }
  next.queryCounter += 2

  return {
    ...next,
    inFlight,
    metrics: { left: leftMetrics, right: rightMetrics },
    lastOp: `SELECT WHERE id=${key} → bucket ${b}`,
  }
}

export function rangeQuery(state: ShardingState, lo: number, hi: number): ShardingState {
  let next: ShardingState = { ...state }
  const inFlight = [...state.inFlight]
  let leftMetrics = { ...state.metrics.left }
  let rightMetrics = { ...state.metrics.right }

  // LEFT: sequential scan across partitions (one disk). Stagger spawn times.
  if (state.leftServerAlive) {
    for (let i = 0; i < 4; i++) {
      inFlight.push({
        id: nextQueryId(next) + i,
        side: 'left',
        kind: 'range',
        bucket: i as Bucket,
        fromX: LEFT_PLANNER.x,
        fromY: LEFT_PLANNER.y,
        toX: LEFT_PARTITION_X[i],
        toY: LEFT_PARTITION_Y_TOP,
        startTick: state.tick + i * 3,  // sequential, ~3 ticks apart
        durationTicks: LEFT_READ_DUR,
        status: 'live',
        color: PARTITION_COLORS[i],
      })
    }
    leftMetrics.reads += 4
    leftMetrics.ok += 4
    leftMetrics.lastLatencyMs = 4
    next = pushEvent(next, 'left', `RANGE [${lo}..${hi}] — sequential 4 scans`, '#4A6FA5')
  } else {
    leftMetrics.failed += 4
    next = pushEvent(next, 'left', `RANGE FAILED — server down`, '#ef4444')
  }
  next.queryCounter += 4

  // RIGHT: scatter-gather. Fan out to ALL shards in parallel.
  for (let i = 0; i < 4; i++) {
    const alive = state.rightShards[i].alive
    inFlight.push({
      id: nextQueryId(next) + 10 + i,
      side: 'right',
      kind: 'range',
      bucket: i as Bucket,
      fromX: RIGHT_ROUTER.x,
      fromY: RIGHT_ROUTER.y,
      toX: RIGHT_SHARD_X[i],
      toY: RIGHT_SHARD_Y_TOP,
      startTick: state.tick,           // all start NOW
      durationTicks: RIGHT_READ_DUR,
      status: alive ? 'live' : 'failed',
      color: alive ? PARTITION_COLORS[i] : '#ef4444',
    })
    if (alive) {
      rightMetrics.reads += 1
      rightMetrics.ok += 1
    } else {
      rightMetrics.failed += 1
    }
    rightMetrics.rtts += 1
    rightMetrics.bytesNetwork += ROW_PAYLOAD_BYTES
  }
  rightMetrics.lastLatencyMs = 6
  next = pushEvent(next, 'right', `RANGE [${lo}..${hi}] — fan-out 4 shards`, '#D4654A')
  next.queryCounter += 14

  return {
    ...next,
    inFlight,
    metrics: { left: leftMetrics, right: rightMetrics },
    lastOp: `SELECT WHERE id BETWEEN ${lo} AND ${hi}`,
  }
}

// ─── Failure ─────────────────────────────────────────────────────────────────

export function killLeftServer(state: ShardingState): ShardingState {
  if (!state.leftServerAlive) return state
  return pushEvent(
    { ...state, leftServerAlive: false, lastOp: 'LEFT SERVER KILLED — total outage' },
    'left', 'SERVER DOWN — all 4 partitions unavailable', '#ef4444',
  )
}

export function reviveLeftServer(state: ShardingState): ShardingState {
  if (state.leftServerAlive) return state
  return pushEvent(
    { ...state, leftServerAlive: true, lastOp: 'LEFT SERVER REVIVED' },
    'left', 'SERVER UP', '#4CAF50',
  )
}

export function killShard(state: ShardingState, id: number): ShardingState {
  const shard = state.rightShards[id]
  if (!shard || !shard.alive) return state
  const rightShards = state.rightShards.map((s, i) => (i === id ? { ...s, alive: false } : s))
  return pushEvent(
    { ...state, rightShards, lastOp: `SHARD ${SHARD_LABELS[id]} KILLED — partial outage` },
    'right', `${SHARD_LABELS[id]} DOWN — keys w/ bucket ${id} unavailable`, '#ef4444',
  )
}

export function reviveShard(state: ShardingState, id: number): ShardingState {
  const shard = state.rightShards[id]
  if (!shard || shard.alive) return state
  const rightShards = state.rightShards.map((s, i) => (i === id ? { ...s, alive: true } : s))
  return pushEvent(
    { ...state, rightShards, lastOp: `SHARD ${SHARD_LABELS[id]} REVIVED` },
    'right', `${SHARD_LABELS[id]} UP`, '#4CAF50',
  )
}

// ─── Mode 4: 2PC ─────────────────────────────────────────────────────────────

export function startTxn(state: ShardingState, keyA: number, keyB: number): ShardingState {
  const bA = bucketOf(keyA)
  const bB = bucketOf(keyB)
  let next: ShardingState = { ...state }

  // LEFT: trivial single-server transaction. No animation, just log.
  let leftMetrics = { ...state.metrics.left }
  if (state.leftServerAlive) {
    leftMetrics.writes += 2
    leftMetrics.ok += 2
    leftMetrics.lastLatencyMs = 1
    next = pushEvent(next, 'left', `BEGIN; UPDATE k=${keyA}; UPDATE k=${keyB}; COMMIT;`, '#4A6FA5')
  } else {
    leftMetrics.failed += 2
    next = pushEvent(next, 'left', `TXN FAILED — server down`, '#ef4444')
  }

  // RIGHT: enter 2PC FSM. Spawn PREPARE particles to both shards.
  const inFlight = [...state.inFlight]
  inFlight.push({
    id: nextQueryId(next), side: 'right', kind: 'txn-prepare',
    key: keyA, bucket: bA,
    fromX: RIGHT_ROUTER.x, fromY: RIGHT_ROUTER.y,
    toX: RIGHT_SHARD_X[bA], toY: RIGHT_SHARD_Y_TOP,
    startTick: state.tick, durationTicks: TXN_HOP_DUR,
    status: 'live', color: '#d97706',
  })
  next.queryCounter += 1
  inFlight.push({
    id: nextQueryId(next), side: 'right', kind: 'txn-prepare',
    key: keyB, bucket: bB,
    fromX: RIGHT_ROUTER.x, fromY: RIGHT_ROUTER.y,
    toX: RIGHT_SHARD_X[bB], toY: RIGHT_SHARD_Y_TOP,
    startTick: state.tick, durationTicks: TXN_HOP_DUR,
    status: 'live', color: '#d97706',
  })
  next.queryCounter += 1

  const txn: TxnState = {
    keys: [keyA, keyB],
    buckets: [bA, bB],
    phase: 'prepare',
    votesYes: 0,
    acksCount: 0,
    startTick: state.tick,
    log: [
      `T+0  COORDINATOR → PREPARE k=${keyA} to ${SHARD_LABELS[bA]}`,
      `T+0  COORDINATOR → PREPARE k=${keyB} to ${SHARD_LABELS[bB]}`,
    ],
  }

  return {
    ...next,
    inFlight,
    txn,
    metrics: { ...next.metrics, left: leftMetrics },
    lastOp: `ATOMIC TRANSFER k=${keyA} ↔ k=${keyB} — LEFT trivial • RIGHT 2PC`,
  }
}

function txnAdvance(state: ShardingState): ShardingState {
  const t = state.txn
  if (!t || t.phase === 'done' || t.phase === 'abort') return state

  // Drive FSM by looking at completed in-flight txn particles.
  const justDone = state.inFlight.filter(q => q.status === 'done' && q.kind.startsWith('txn'))
  if (justDone.length === 0) return state

  let txn = t
  let inFlight = [...state.inFlight]
  let rightMetrics = { ...state.metrics.right }
  let next: ShardingState = state

  // PREPARE → spawn VOTE back from each shard
  const preparesDone = justDone.filter(q => q.kind === 'txn-prepare')
  for (const q of preparesDone) {
    // Spawn a vote particle returning to coordinator
    inFlight.push({
      id: nextQueryId(next), side: 'right', kind: 'txn-vote',
      key: q.key, bucket: q.bucket,
      fromX: RIGHT_SHARD_X[q.bucket!], fromY: RIGHT_SHARD_Y_TOP,
      toX: RIGHT_ROUTER.x, toY: RIGHT_ROUTER.y,
      startTick: state.tick, durationTicks: TXN_HOP_DUR,
      status: 'live', color: '#4CAF50',
    })
    next.queryCounter += 1
    rightMetrics.rtts += 1
    txn = {
      ...txn,
      phase: 'voting',
      log: [...txn.log, `T+${state.tick - txn.startTick}  ${SHARD_LABELS[q.bucket!]} acquires lock, persists prepare-log`],
    }
  }

  const votesDone = justDone.filter(q => q.kind === 'txn-vote')
  if (votesDone.length > 0) {
    txn = {
      ...txn,
      votesYes: txn.votesYes + votesDone.length,
      log: [
        ...txn.log,
        ...votesDone.map(q => `T+${state.tick - txn.startTick}  ${SHARD_LABELS[q.bucket!]} → VOTE-YES`),
      ],
    }
    // If all votes in, fire COMMIT
    if (txn.votesYes >= 2) {
      txn = {
        ...txn,
        phase: 'commit',
        log: [...txn.log, `T+${state.tick - txn.startTick}  COORDINATOR writes COMMIT log; broadcasts COMMIT`],
      }
      for (const b of txn.buckets) {
        inFlight.push({
          id: nextQueryId(next), side: 'right', kind: 'txn-commit',
          bucket: b,
          fromX: RIGHT_ROUTER.x, fromY: RIGHT_ROUTER.y,
          toX: RIGHT_SHARD_X[b], toY: RIGHT_SHARD_Y_TOP,
          startTick: state.tick, durationTicks: TXN_HOP_DUR,
          status: 'live', color: '#4A6FA5',
        })
        next.queryCounter += 1
        rightMetrics.rtts += 1
      }
    }
  }

  const commitsDone = justDone.filter(q => q.kind === 'txn-commit')
  for (const q of commitsDone) {
    inFlight.push({
      id: nextQueryId(next), side: 'right', kind: 'txn-ack',
      bucket: q.bucket,
      fromX: RIGHT_SHARD_X[q.bucket!], fromY: RIGHT_SHARD_Y_TOP,
      toX: RIGHT_ROUTER.x, toY: RIGHT_ROUTER.y,
      startTick: state.tick, durationTicks: TXN_HOP_DUR,
      status: 'live', color: '#4CAF50',
    })
    next.queryCounter += 1
    rightMetrics.rtts += 1
    txn = {
      ...txn,
      phase: 'acking',
      log: [...txn.log, `T+${state.tick - txn.startTick}  ${SHARD_LABELS[q.bucket!]} applies write, releases lock`],
    }
  }

  const acksDone = justDone.filter(q => q.kind === 'txn-ack')
  if (acksDone.length > 0) {
    txn = {
      ...txn,
      acksCount: txn.acksCount + acksDone.length,
      log: [
        ...txn.log,
        ...acksDone.map(q => `T+${state.tick - txn.startTick}  ${SHARD_LABELS[q.bucket!]} → ACK`),
      ],
    }
    if (txn.acksCount >= 2) {
      const totalT = state.tick - txn.startTick
      txn = {
        ...txn,
        phase: 'done',
        log: [...txn.log, `T+${totalT}  TXN COMMITTED — 4 round-trips, latency ≈ ${(totalT * 80 / 1000).toFixed(1)}s`],
      }
      rightMetrics.writes += 2
      rightMetrics.ok += 2
      rightMetrics.lastLatencyMs = totalT * 80 / 1000 * 1000  // ms
    }
  }

  return {
    ...next,
    inFlight,
    txn,
    metrics: { ...next.metrics, right: rightMetrics },
  }
}

// ─── Tick: advance particles + FSM ───────────────────────────────────────────

export function shardingTick(state: ShardingState): ShardingState {
  const newTick = state.tick + 1

  // Mark particles whose time has elapsed as done
  let inFlight: QueryInFlight[] = state.inFlight.map(q => {
    if (q.status !== 'live') return q
    if (newTick >= q.startTick + q.durationTicks) {
      return { ...q, status: 'done' }
    }
    return q
  })

  // Mode 5: accumulate scale storage when ramping
  let scaleTicks = state.scaleTicks
  let scaleStorageBytes = state.scaleStorageBytes
  if (state.mode === 5 && state.scaleRamping) {
    scaleTicks += 1
    scaleStorageBytes = Math.min(
      LEFT_DISK_CAP_BYTES * 4,  // RIGHT total capacity = 4× LEFT
      scaleStorageBytes + state.scaleLoadRps * BYTES_PER_TICK_PER_RPS,
    )
  }

  let next: ShardingState = { ...state, tick: newTick, inFlight, scaleTicks, scaleStorageBytes }

  // Advance 2PC FSM if active
  if (next.txn) next = txnAdvance(next)

  // Prune particles done > 4 ticks ago (let them flash briefly)
  next = {
    ...next,
    inFlight: next.inFlight.filter(q => {
      if (q.status === 'live') return true
      return newTick < q.startTick + q.durationTicks + 4
    }),
  }

  return next
}
