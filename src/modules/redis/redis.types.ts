export type PersistenceMode = 'none' | 'rdb' | 'aof'

export interface RedisEntry {
  key: string
  value: string
  ttl: number | null
}

export interface HashBucket {
  entries: RedisEntry[]
}

export interface RedisState {
  // ─── In-memory (RAM) — lost on crash ───
  buckets: HashBucket[]        // 8 hash buckets, entries stored here
  lruHead: string | null       // MRU key
  lruTail: string | null       // LRU key
  lruMap: Map<string, { prev: string | null; next: string | null }>  // doubly-linked list

  // ─── Config ───
  capacity: number             // total max entries before eviction
  persistence: PersistenceMode
  currentTime: number          // ticks, for TTL & RDB triggers

  // ─── Disk (survives crash) ───
  rdbSnapshot: RedisEntry[]    // last explicit snapshot
  aofLog: string[]             // every write command since last clear

  // ─── Status ───
  crashed: boolean
}

export type RedisAnimStep =
  | { type: 'hash-key'; key: string; bucketIdx: number; hash: number }
  | { type: 'bucket-traverse'; bucketIdx: number; foundAt: number | null }
  | { type: 'lru-move-head'; key: string }
  | { type: 'lru-evict'; key: string }
  | { type: 'ttl-expire'; key: string }
  | { type: 'aof-write'; command: string }
  | { type: 'rdb-snapshot-save' }
  | { type: 'crash' }
  | { type: 'restart'; mode: string; recoveredCount: number }
