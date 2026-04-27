export interface MemtableEntry {
  key: string
  value: string
  tombstone: boolean
  timestamp: number
}

export interface BloomFilter {
  bits: boolean[]
}

export interface SSTable {
  id: string
  level: number
  entries: MemtableEntry[]
  bloomFilter: BloomFilter
}

export interface LSMState {
  wal: string[]
  memtable: MemtableEntry[]
  memtableCapacity: number
  sstables: SSTable[][]
  nextTimestamp: number
  nextSstableId: number
  lastOp: string
}

export type LSMAnimStep =
  | { type: 'wal-write'; entry: string }
  | { type: 'memtable-insert'; key: string; value: string }
  | { type: 'memtable-flush'; sstableId: string; count: number }
  | { type: 'bloom-check'; sstableId: string; key: string; result: boolean }
  | { type: 'sstable-read'; sstableId: string; found: boolean }
  | { type: 'compaction'; sourceLevel: number; targetLevel: number; count: number }
