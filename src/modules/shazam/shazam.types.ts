export interface Peak {
  time: number
  freq: number
  energy: number
}

export interface HashPair {
  anchor: Peak
  target: Peak
  hash: number
  f1: number
  f2: number
  dt: number
}

export interface Song {
  id: number
  name: string
  peaks: Peak[]
  hashes: HashPair[]
  color: string
}

export interface HistogramBin {
  offset: number
  count: number
}

export interface MatchResult {
  songId: number
  songName: string
  color: string
  histogram: HistogramBin[]
  maxCount: number
  totalMatches: number
}

export interface QueryHashMatch {
  queryIdx: number
  hash: number
  matches: { songId: number; offset: number }[]
}

export interface ShazamEvent {
  id: number
  text: string
  color: string
}

export interface ShazamState {
  tick: number
  mode: number  // current fix-mode index (-1, 0..4)

  // Spectrogram grid: [time][freq] = energy 0-255
  spectrogram: number[][]
  spectrogramBuilt: number // how many columns revealed (for animation)

  // Peaks extracted from spectrogram
  peaks: Peak[]
  peakThreshold: number

  // Hashing
  anchorPairs: { anchor: Peak; targets: Peak[]; hashes: HashPair[] }[]
  allHashes: HashPair[]
  currentAnchorIdx: number // animation cursor

  // Database
  songs: Song[]

  // Query
  queryPeaks: Peak[]
  queryHashes: HashPair[]
  queryHashMatches: QueryHashMatch[]  // precomputed per-hash song matches
  currentLookupIdx: number // animation cursor — # of query hashes processed
  matchResults: MatchResult[]
  matchedSongId: number | null

  // UI state
  animating: boolean
  lastOp: string
  recentEvents: ShazamEvent[]
  eventCounter: number
}
