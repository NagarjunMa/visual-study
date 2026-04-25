import type { RedisState, RedisEntry, RedisAnimStep, PersistenceMode } from './redis.types'

const BUCKET_COUNT = 8

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
    lruOrder: new Map(),
    lruHead: null,
    lruTail: null,
    capacity,
    persistence,
    rdbSnapshot: [],
    aofLog: [],
    crashed: false,
    currentTime: 0,
  }
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
  newState.lruOrder = new Map(state.lruOrder)

  const entryIndex = (newState.lruOrder.size % 10000) + state.currentTime
  const newEntry: RedisEntry = { key, value, ttl, lruTime: state.currentTime, index: entryIndex }

  if (existingIdx >= 0) {
    // Update existing
    newState.buckets[hash].entries[existingIdx] = newEntry
  } else {
    // Insert new
    if (newState.buckets[hash].entries.length >= newState.capacity) {
      // Evict LRU
      if (newState.lruTail) {
        const lruKey = newState.lruTail
        const tailNode = newState.lruOrder.get(lruKey)
        if (tailNode?.prev) {
          const prevNode = newState.lruOrder.get(tailNode.prev)
          if (prevNode) prevNode.next = null
          newState.lruHead = newState.lruTail === newState.lruHead ? null : tailNode.prev
        } else {
          newState.lruHead = null
        }
        newState.lruOrder.delete(lruKey)

        // Find and remove from bucket
        for (let i = 0; i < BUCKET_COUNT; i++) {
          const idx = newState.buckets[i].entries.findIndex(e => e.key === lruKey)
          if (idx >= 0) {
            newState.buckets[i].entries.splice(idx, 1)
            steps.push({ type: 'lru-evict', key: lruKey })
            break
          }
        }
        newState.lruTail = null
        for (const [k] of newState.lruOrder) {
          const node = newState.lruOrder.get(k)
          if (node && !node.next) newState.lruTail = k
        }
      }
    }
    newState.buckets[hash].entries.push(newEntry)
  }

  // Update LRU — move key to head
  const oldNode = newState.lruOrder.get(key)
  if (oldNode && oldNode.prev) {
    const prevNode = newState.lruOrder.get(oldNode.prev)
    if (prevNode) prevNode.next = oldNode.next
  }
  if (oldNode && oldNode.next) {
    const nextNode = newState.lruOrder.get(oldNode.next)
    if (nextNode) nextNode.prev = oldNode.prev
  }
  if (newState.lruTail === key && oldNode?.prev) {
    newState.lruTail = oldNode.prev
  }

  const headNode = newState.lruHead ? newState.lruOrder.get(newState.lruHead) : null
  if (headNode) {
    headNode.prev = key
  }
  newState.lruOrder.set(key, { key, prev: null, next: newState.lruHead || null })
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

  // RDB periodic snapshot (simulated: every 10 seconds)
  if (newState.persistence === 'rdb' && newState.currentTime % 10 === 0) {
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

  // Move to LRU head
  steps.push({ type: 'lru-move-head', key })

  return { found: true, value: entry.value, steps }
}

export function redisCrash(state: RedisState): { newState: RedisState; recovered: { count: number; mode: string } } {
  const newState = { ...state, crashed: true }

  if (state.persistence === 'none') {
    newState.buckets = Array.from({ length: BUCKET_COUNT }, () => ({ entries: [] }))
    newState.lruOrder = new Map()
    newState.lruHead = null
    newState.lruTail = null
    return { newState, recovered: { count: 0, mode: 'Data lost' } }
  }

  if (state.persistence === 'rdb') {
    // Recover from RDB snapshot
    newState.buckets = Array.from({ length: BUCKET_COUNT }, () => ({ entries: [] }))
    newState.lruOrder = new Map()
    newState.lruHead = null
    newState.lruTail = null

    for (const entry of state.rdbSnapshot) {
      const hash = simpleHash(entry.key)
      newState.buckets[hash].entries.push(entry)

      const headNode = newState.lruHead ? newState.lruOrder.get(newState.lruHead) : null
      if (headNode) headNode.prev = entry.key
      newState.lruOrder.set(entry.key, { key: entry.key, prev: null, next: newState.lruHead || null })
      if (!newState.lruHead) newState.lruTail = entry.key
      newState.lruHead = entry.key
    }

    return { newState, recovered: { count: state.rdbSnapshot.length, mode: 'RDB recovery' } }
  }

  if (state.persistence === 'aof') {
    // Replay AOF log
    newState.buckets = Array.from({ length: BUCKET_COUNT }, () => ({ entries: [] }))
    newState.lruOrder = new Map()
    newState.lruHead = null
    newState.lruTail = null

    let count = 0
    for (const cmd of state.aofLog) {
      if (cmd.startsWith('SET')) {
        const parts = cmd.split(' ')
        const key = parts[1]
        const value = parts[2]
        const { newState: updatedState } = redisSet(newState, key, value)
        Object.assign(newState, updatedState)
        count++
      }
    }

    return { newState, recovered: { count, mode: 'AOF replay' } }
  }

  return { newState, recovered: { count: 0, mode: 'Unknown' } }
}

export function advanceTime(state: RedisState, delta: number): RedisState {
  return { ...state, currentTime: state.currentTime + delta }
}
