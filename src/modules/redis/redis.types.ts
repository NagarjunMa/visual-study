export type PersistenceMode = 'none' | 'rdb' | 'aof'

export interface RedisEntry {
  key: string
  value: string
  ttl: number | null  // null = no expiry, number = milliseconds
  lruTime: number
  index: number  // unique identifier for animation
}

export interface HashBucket {
  entries: RedisEntry[]
}

export interface LRUNode {
  key: string
  prev: string | null  // key of prev node
  next: string | null  // key of next node
}

export interface RedisState {
  buckets: HashBucket[]  // 8 buckets
  lruOrder: Map<string, LRUNode>  // key → LRU node
  lruHead: string | null  // key of MRU node
  lruTail: string | null  // key of LRU node
  capacity: number  // max entries before eviction
  persistence: PersistenceMode
  rdbSnapshot: RedisEntry[]  // saved state for RDB recovery
  aofLog: string[]  // command log for AOF recovery
  crashed: boolean
  currentTime: number  // for TTL countdown
}

export type RedisAnimStep =
  | { type: 'hash-key', key: string, bucketIdx: number, hash: number }
  | { type: 'bucket-traverse', bucketIdx: number, foundAt: number | null }
  | { type: 'entry-create', key: string, value: string, bucketIdx: number }
  | { type: 'lru-move-head', key: string }
  | { type: 'lru-evict', key: string }
  | { type: 'ttl-expire', key: string }
  | { type: 'aof-write', command: string }
  | { type: 'rdb-snapshot-save' }
  | { type: 'crash' }
  | { type: 'restart-none' }
  | { type: 'restart-rdb', recovered: number }
  | { type: 'restart-aof', replayCount: number }

export interface AnimContext {
  steps: RedisAnimStep[]
  currentStep: number
  isAnimating: boolean
}
