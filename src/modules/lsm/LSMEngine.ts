import type { LSMState, MemtableEntry, SSTable, BloomFilter } from './lsm.types'

const BLOOM_BITS = 8
const COMPACTION_THRESHOLD = 3

function bloomHash1(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h) + key.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h) % BLOOM_BITS
}

function bloomHash2(key: string): number {
  let h = 5381
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) + key.charCodeAt(i)
  }
  return Math.abs(h) % BLOOM_BITS
}

function bloomAdd(filter: BloomFilter, key: string): BloomFilter {
  const bits = [...filter.bits]
  bits[bloomHash1(key)] = true
  bits[bloomHash2(key)] = true
  return { bits }
}

function bloomCheck(filter: BloomFilter, key: string): boolean {
  return filter.bits[bloomHash1(key)] && filter.bits[bloomHash2(key)]
}

function createInitialBloomFilter(): BloomFilter {
  return { bits: Array(BLOOM_BITS).fill(false) }
}

export function createInitialLSMState(capacity: number = 5): LSMState {
  return {
    wal: [],
    memtable: [],
    memtableCapacity: capacity,
    sstables: [[], []],
    nextTimestamp: 0,
    nextSstableId: 0,
    lastOp: 'Ready',
  }
}

export function lsmWrite(state: LSMState, key: string, value: string): LSMState {
  const timestamp = state.nextTimestamp
  const walEntry = `SET ${key} ${value}`
  const entry: MemtableEntry = { key, value, tombstone: false, timestamp }

  const existing = state.memtable.findIndex(e => e.key === key)
  let newMemtable: MemtableEntry[]
  if (existing >= 0) {
    newMemtable = [...state.memtable]
    newMemtable[existing] = entry
  } else {
    newMemtable = [...state.memtable, entry]
  }
  newMemtable.sort((a, b) => a.key.localeCompare(b.key))

  let newState: LSMState = {
    ...state,
    wal: [...state.wal, walEntry],
    memtable: newMemtable,
    nextTimestamp: timestamp + 1,
    lastOp: `SET ${key}="${value}" → Memtable`,
  }

  if (newState.memtable.length > newState.memtableCapacity) {
    newState = lsmFlush(newState)
  }

  return newState
}

export function lsmDelete(state: LSMState, key: string): LSMState {
  const timestamp = state.nextTimestamp
  const walEntry = `DEL ${key}`
  const tombstone: MemtableEntry = { key, value: '', tombstone: true, timestamp }

  const existing = state.memtable.findIndex(e => e.key === key)
  let newMemtable: MemtableEntry[]
  if (existing >= 0) {
    newMemtable = [...state.memtable]
    newMemtable[existing] = tombstone
  } else {
    newMemtable = [...state.memtable, tombstone]
  }
  newMemtable.sort((a, b) => a.key.localeCompare(b.key))

  return {
    ...state,
    wal: [...state.wal, walEntry],
    memtable: newMemtable,
    nextTimestamp: timestamp + 1,
    lastOp: `DEL ${key} → Tombstone`,
  }
}

export function lsmGet(state: LSMState, key: string): { found: boolean; value: string | null; source: string } {
  const memEntry = state.memtable.find(e => e.key === key)
  if (memEntry) {
    if (memEntry.tombstone) return { found: false, value: null, source: 'Tombstone in Memtable' }
    return { found: true, value: memEntry.value, source: 'Memtable hit' }
  }

  for (let i = state.sstables[0].length - 1; i >= 0; i--) {
    const sstable = state.sstables[0][i]
    if (!bloomCheck(sstable.bloomFilter, key)) continue
    const entry = sstable.entries.find(e => e.key === key)
    if (entry) {
      if (entry.tombstone) return { found: false, value: null, source: `Tombstone in L0 ${sstable.id}` }
      return { found: true, value: entry.value, source: `L0 ${sstable.id}` }
    }
  }

  if (state.sstables[1]) {
    for (let i = state.sstables[1].length - 1; i >= 0; i--) {
      const sstable = state.sstables[1][i]
      if (!bloomCheck(sstable.bloomFilter, key)) continue
      const entry = sstable.entries.find(e => e.key === key)
      if (entry) {
        if (entry.tombstone) return { found: false, value: null, source: `Tombstone in L1 ${sstable.id}` }
        return { found: true, value: entry.value, source: `L1 ${sstable.id}` }
      }
    }
  }

  return { found: false, value: null, source: 'Not found' }
}

export function lsmFlush(state: LSMState): LSMState {
  if (state.memtable.length === 0) {
    return { ...state, lastOp: 'Memtable empty' }
  }

  const entries = [...state.memtable]
  let filter = createInitialBloomFilter()
  for (const e of entries) {
    filter = bloomAdd(filter, e.key)
  }

  const newSSTable: SSTable = {
    id: `S${state.nextSstableId}`,
    level: 0,
    entries,
    bloomFilter: filter,
  }

  const newL0 = [...state.sstables[0], newSSTable]
  const newSstables = [newL0, ...state.sstables.slice(1)]

  let newState: LSMState = {
    ...state,
    memtable: [],
    sstables: newSstables,
    nextSstableId: state.nextSstableId + 1,
    lastOp: `Flush → ${newSSTable.id} (${entries.length} entries)`,
  }

  if (newL0.length >= COMPACTION_THRESHOLD) {
    newState = lsmCompact(newState, 0)
  }

  return newState
}

export function lsmCompact(state: LSMState, level: number): LSMState {
  const sourceSSTables = state.sstables[level] || []
  if (sourceSSTables.length < 2) {
    return { ...state, lastOp: 'Not enough SSTables for compaction' }
  }

  const allEntries = new Map<string, MemtableEntry>()
  for (const sstable of sourceSSTables) {
    for (const entry of sstable.entries) {
      const existing = allEntries.get(entry.key)
      if (!existing || entry.timestamp > existing.timestamp) {
        allEntries.set(entry.key, entry)
      }
    }
  }

  const mergedEntries = Array.from(allEntries.values())
    .sort((a, b) => a.key.localeCompare(b.key))

  let filter = createInitialBloomFilter()
  for (const e of mergedEntries) {
    filter = bloomAdd(filter, e.key)
  }

  const targetLevel = level + 1
  const newSSTable: SSTable = {
    id: `S${state.nextSstableId}`,
    level: targetLevel,
    entries: mergedEntries,
    bloomFilter: filter,
  }

  const newSstables = [...state.sstables]
  newSstables[level] = []
  if (!newSstables[targetLevel]) newSstables[targetLevel] = []
  newSstables[targetLevel] = [...newSstables[targetLevel], newSSTable]

  return {
    ...state,
    sstables: newSstables,
    nextSstableId: state.nextSstableId + 1,
    lastOp: `Compact L${level} (${sourceSSTables.length}) → L${targetLevel} ${newSSTable.id}`,
  }
}
