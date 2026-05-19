export type Bucket = 0 | 1 | 2 | 3

export interface Row {
  id: number
  bucket: Bucket
}

export interface NodeState {
  id: number
  alive: boolean
  rows: Row[]
}

export type QueryKind =
  | 'write'
  | 'point'
  | 'range'
  | 'txn-prepare'
  | 'txn-vote'
  | 'txn-commit'
  | 'txn-ack'

export type Side = 'left' | 'right'

export interface QueryInFlight {
  id: number
  side: Side
  kind: QueryKind
  key?: number
  bucket?: Bucket
  fromX: number
  fromY: number
  toX: number
  toY: number
  startTick: number
  durationTicks: number
  status: 'live' | 'done' | 'failed'
  returnTrip?: boolean
  color?: string
}

export interface ShardingEvent {
  id: number
  side: Side
  text: string
  color: string
}

export type TxnPhase = 'idle' | 'prepare' | 'voting' | 'commit' | 'acking' | 'done' | 'abort'

export interface TxnState {
  keys: [number, number]
  buckets: [Bucket, Bucket]
  phase: TxnPhase
  votesYes: number
  acksCount: number
  startTick: number
  log: string[]
}

export interface SideMetrics {
  reads: number
  writes: number
  bytesNetwork: number
  rtts: number
  ok: number
  failed: number
  lastLatencyMs: number
}

export interface ShardingState {
  tick: number
  mode: number  // -1 base, 0..4 fix modes

  // Topology
  leftPartitions: NodeState[]   // length 4
  leftServerAlive: boolean
  rightShards: NodeState[]      // length 4, independent alive flags

  // Activity
  inFlight: QueryInFlight[]
  recentEvents: ShardingEvent[]
  eventCounter: number
  queryCounter: number

  // Counters
  metrics: {
    left: SideMetrics
    right: SideMetrics
  }

  // 2PC state (mode 4)
  txn: TxnState | null

  // UI state
  lastOp: string
  insertCursor: number          // index into KEY_SET for mode 0 stepwise insert

  // Mode 5: Scale Wall
  scaleLoadRps: number          // simulated request rate
  scaleRamping: boolean         // when true, storage accumulates per tick
  scaleTicks: number            // ticks accumulated under load
  scaleStorageBytes: number     // total bytes written under load (LEFT total)
}
