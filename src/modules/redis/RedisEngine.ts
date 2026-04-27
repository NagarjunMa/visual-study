import type { RedisState, RedisEntry, RedisAnimStep, PersistenceMode } from './redis.types'

const BUCKET_COUNT = 8
const RDB_SAVE_INTERVAL = 5  // Save RDB every 5 SETs

function simpleHash(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash) % BUCKET_COUNT
}

export function createInitialRedisState(capacity: number = 10, persistence: PersistenceMode = 'none'): RedisState {
  const buckets = Array.from({ length: BUCKET_COUNT }, () => ({ entries: [] }))
  return {
    buckets,
    lruHead: null,
    lruTail: null,
    lruMap: new Map(),
    capacity,
    persistence,
    rdbSnapshot: [],
    aofLog: [],
    crashed: false,
    currentTime: 0,
  }
}

function getTotalEntryCount(state: RedisState): number {
  return state.buckets.reduce((sum, b) => sum + b.entries.length, 0)
}

export function redisSet(
  state: RedisState,
  key: string,
  value: string,
  ttl: number | null = null
): { newState: RedisState; steps: RedisAnimStep[] } {
  const steps: RedisAnimStep[] = []
  const hash = simpleHash(key)
  steps.push({ type: 'hash-key', key, bucketIdx: hash, hash })

  const bucket = state.buckets[hash]
  const existingIdx = bucket.entries.findIndex(e => e.key === key)

  const newState = { ...state }
  newState.buckets = state.buckets.map((b, i) => (i === hash ? { entries: [...b.entries] } : b))
  newState.lruMap = new Map(state.lruMap)
  newState.currentTime = state.currentTime + 1

  const newEntry: RedisEntry = { key, value, ttl }

  // Check if we're updating or inserting
  if (existingIdx >= 0) {
    // Update existing entry
    newState.buckets[hash].entries[existingIdx] = newEntry
  } else {
    // Insert new entry — evict LRU if at capacity
    const totalEntries = getTotalEntryCount(newState)
    if (totalEntries >= newState.capacity && newState.lruTail) {
      const lruKey = newState.lruTail
      const lruNode = newState.lruMap.get(lruKey)

      // Unlink from LRU chain
      if (lruNode?.prev) {
        const prevNode = newState.lruMap.get(lruNode.prev)
        if (prevNode) prevNode.next = null
        newState.lruTail = lruNode.prev
      } else {
        newState.lruTail = null
        newState.lruHead = null
      }
      newState.lruMap.delete(lruKey)

      // Remove from bucket
      for (let i = 0; i < BUCKET_COUNT; i++) {
        const idx = newState.buckets[i].entries.findIndex(e => e.key === lruKey)
        if (idx >= 0) {
          newState.buckets[i].entries.splice(idx, 1)
          steps.push({ type: 'lru-evict', key: lruKey })
          break
        }
      }
    }

    newState.buckets[hash].entries.push(newEntry)
  }

  // Update LRU chain: move key to head (MRU)
  const oldNode = newState.lruMap.get(key)
  if (oldNode) {
    // Unlink from chain
    if (oldNode.prev) {
      const prevNode = newState.lruMap.get(oldNode.prev)
      if (prevNode) prevNode.next = oldNode.next
    }
    if (oldNode.next) {
      const nextNode = newState.lruMap.get(oldNode.next)
      if (nextNode) nextNode.prev = oldNode.prev
    }
    if (newState.lruTail === key && oldNode.prev) {
      newState.lruTail = oldNode.prev
    }
    if (newState.lruHead === key) {
      newState.lruHead = oldNode.next
    }
  }

  // Link to head
  const headNode = newState.lruHead ? newState.lruMap.get(newState.lruHead) : null
  if (headNode) {
    headNode.prev = key
  }
  newState.lruMap.set(key, { prev: null, next: newState.lruHead || null })
  if (!newState.lruHead) {
    newState.lruTail = key
  }
  newState.lruHead = key
  steps.push({ type: 'lru-move-head', key })

  // AOF log
  if (newState.persistence === 'aof') {
    const cmd = ttl ? `SET ${key} ${value} EX ${ttl}` : `SET ${key} ${value}`
    newState.aofLog.push(cmd)
    steps.push({ type: 'aof-write', command: cmd })
  }

  // RDB periodic snapshot (every 5 SETs)
  if (newState.persistence === 'rdb' && newState.currentTime % RDB_SAVE_INTERVAL === 0) {
    newState.rdbSnapshot = []
    for (const b of newState.buckets) {
      newState.rdbSnapshot.push(...b.entries)
    }
    steps.push({ type: 'rdb-snapshot-save' })
  }

  return { newState, steps }
}

export function redisGet(state: RedisState, key: string): { found: boolean; value: string | null; steps: RedisAnimStep[] } {
  const steps: RedisAnimStep[] = []
  const hash = simpleHash(key)
  steps.push({ type: 'hash-key', key, bucketIdx: hash, hash })

  const bucket = state.buckets[hash]
  const entryIdx = bucket.entries.findIndex(e => e.key === key)
  steps.push({ type: 'bucket-traverse', bucketIdx: hash, foundAt: entryIdx >= 0 ? entryIdx : null })

  if (entryIdx < 0) {
    return { found: false, value: null, steps }
  }

  const entry = bucket.entries[entryIdx]

  // Check TTL
  if (entry.ttl !== null && state.currentTime >= entry.ttl) {
    steps.push({ type: 'ttl-expire', key })
    return { found: false, value: null, steps }
  }

  // Found and not expired — update LRU access
  steps.push({ type: 'lru-move-head', key })

  return { found: true, value: entry.value, steps }
}

export function redisCrash(state: RedisState): { newState: RedisState; recovered: { count: number; mode: string } } {
  const newState = { ...state, crashed: true }

  if (state.persistence === 'none') {
    // Total data loss
    newState.buckets = Array.from({ length: BUCKET_COUNT }, () => ({ entries: [] }))
    newState.lruMap = new Map()
    newState.lruHead = null
    newState.lruTail = null
    return { newState, recovered: { count: 0, mode: 'Data lost (no persistence)' } }
  }

  if (state.persistence === 'rdb') {
    // Recover from RDB snapshot
    newState.buckets = Array.from({ length: BUCKET_COUNT }, () => ({ entries: [] }))
    newState.lruMap = new Map()
    newState.lruHead = null
    newState.lruTail = null

    for (const entry of state.rdbSnapshot) {
      const hash = simpleHash(entry.key)
      newState.buckets[hash].entries.push(entry)

      const headNode = newState.lruHead ? newState.lruMap.get(newState.lruHead) : null
      if (headNode) headNode.prev = entry.key
      newState.lruMap.set(entry.key, { prev: null, next: newState.lruHead || null })
      if (!newState.lruHead) newState.lruTail = entry.key
      newState.lruHead = entry.key
    }

    return { newState, recovered: { count: state.rdbSnapshot.length, mode: 'RDB recovery' } }
  }

  if (state.persistence === 'aof') {
    // Replay AOF log
    newState.buckets = Array.from({ length: BUCKET_COUNT }, () => ({ entries: [] }))
    newState.lruMap = new Map()
    newState.lruHead = null
    newState.lruTail = null

    let count = 0
    // Set persistence to 'none' during replay to prevent re-appending to aofLog
    const replayState: RedisState = { ...newState, persistence: 'none' }
    for (const cmd of state.aofLog) {
      if (cmd.startsWith('SET')) {
        const parts = cmd.split(' ')
        const key = parts[1]
        const value = parts[2]
        const { newState: updatedState } = redisSet(replayState, key, value)
        Object.assign(replayState, updatedState)
        count++
      }
    }

    // Restore persistence mode after replay
    replayState.persistence = 'aof'
    return { newState: replayState, recovered: { count, mode: 'AOF replay' } }
  }

  return { newState, recovered: { count: 0, mode: 'Unknown' } }
}

export function advanceTime(state: RedisState, delta: number): RedisState {
  return { ...state, currentTime: state.currentTime + delta }
}
