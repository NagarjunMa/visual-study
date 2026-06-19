import type {
  Peak, HashPair, Song, HistogramBin, MatchResult,
  QueryHashMatch, ShazamState, ShazamEvent,
} from './shazam.types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_BINS = 24
const FREQ_BINS = 16
const DEFAULT_THRESHOLD = 90
const MIN_THRESHOLD = 30
const MAX_THRESHOLD = 240
const TARGET_ZONE_TIME = [1, 5]   // anchor+1 to anchor+5
const TARGET_ZONE_FREQ = 4        // ±4 freq bins
const FAN_OUT = 5                 // max targets per anchor

// ---------------------------------------------------------------------------
// Deterministic pseudo-random (LCG seeded)
// ---------------------------------------------------------------------------

function lcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

// ---------------------------------------------------------------------------
// Song definitions — deterministic peak patterns
// ---------------------------------------------------------------------------

function defineSongs(): Song[] {
  function makePeaks(baseFreqs: number[], density: number, seed: number): Peak[] {
    const r = lcg(seed)
    const peaks: Peak[] = []
    for (let t = 1; t < TIME_BINS - 1; t++) {
      for (const bf of baseFreqs) {
        if (r() < density) {
          const freq = Math.max(1, Math.min(FREQ_BINS - 2, bf + Math.floor((r() - 0.5) * 2)))
          const energy = 120 + Math.floor(r() * 130)
          peaks.push({ time: t, freq, energy })
        }
      }
    }
    return peaks
  }

  return [
    {
      id: 0, name: 'Electronic Beat', color: '#8b5cf6',
      peaks: makePeaks([2, 5, 8, 11], 0.5, 100),
      hashes: [],
    },
    {
      id: 1, name: 'Piano Melody', color: '#06b6d4',
      peaks: makePeaks([3, 6, 9, 12], 0.45, 200),
      hashes: [],
    },
    {
      id: 2, name: 'Rock Guitar', color: '#ef4444',
      peaks: makePeaks([4, 7, 10, 13], 0.55, 300),
      hashes: [],
    },
    {
      id: 3, name: 'Jazz Trumpet', color: '#f59e0b',
      peaks: makePeaks([5, 8, 11, 14], 0.4, 400),
      hashes: [],
    },
    {
      id: 4, name: 'Pop Vocal', color: '#22c55e',
      peaks: makePeaks([3, 5, 8, 10], 0.5, 500),
      hashes: [],
    },
  ].map(song => ({ ...song, hashes: generateHashes(song.peaks) }))
}

// ---------------------------------------------------------------------------
// Generate query: noisy subset of target song (Song #2: Rock Guitar)
// ---------------------------------------------------------------------------

function generateQuery(songs: Song[]): { peaks: Peak[]; hashes: HashPair[] } {
  const target = songs[2] // Rock Guitar
  const rng = lcg(777)
  const TIME_OFFSET = 3 // query is shifted +3 in time

  // Take ~70% of target peaks, shifted in time, add noise peaks
  const peaks: Peak[] = []
  for (const p of target.peaks) {
    if (rng() < 0.7) {
      peaks.push({
        time: Math.min(TIME_BINS - 2, p.time + TIME_OFFSET),
        freq: p.freq + (rng() < 0.1 ? (rng() < 0.5 ? 1 : -1) : 0), // slight freq jitter
        energy: Math.max(50, p.energy + Math.floor((rng() - 0.5) * 40)),
      })
    }
  }
  // Add 3-5 noise peaks
  for (let i = 0; i < 4; i++) {
    peaks.push({
      time: 2 + Math.floor(rng() * (TIME_BINS - 4)),
      freq: 1 + Math.floor(rng() * (FREQ_BINS - 2)),
      energy: 60 + Math.floor(rng() * 80),
    })
  }

  return { peaks, hashes: generateHashes(peaks) }
}

// ---------------------------------------------------------------------------
// Spectrogram generation from peaks (gaussian energy spread)
// ---------------------------------------------------------------------------

export function generateSpectrogram(peaks: Peak[]): number[][] {
  const grid: number[][] = Array.from({ length: TIME_BINS }, () => Array(FREQ_BINS).fill(0))

  // Base noise floor
  const rng = lcg(99)
  for (let t = 0; t < TIME_BINS; t++) {
    for (let f = 0; f < FREQ_BINS; f++) {
      grid[t][f] = 5 + Math.floor(rng() * 15) // low noise
    }
  }

  // Spread energy around peaks with gaussian falloff
  for (const p of peaks) {
    for (let t = Math.max(0, p.time - 3); t <= Math.min(TIME_BINS - 1, p.time + 3); t++) {
      for (let f = Math.max(0, p.freq - 3); f <= Math.min(FREQ_BINS - 1, p.freq + 3); f++) {
        const dt = t - p.time
        const df = f - p.freq
        const dist2 = dt * dt + df * df
        grid[t][f] += Math.floor(p.energy * Math.exp(-dist2 / 1.8))
      }
    }
  }

  // Clamp to 255
  for (let t = 0; t < TIME_BINS; t++) {
    for (let f = 0; f < FREQ_BINS; f++) {
      grid[t][f] = Math.min(255, grid[t][f])
    }
  }

  return grid
}

// ---------------------------------------------------------------------------
// Peak extraction — local maxima above threshold
// ---------------------------------------------------------------------------

export function extractPeaks(grid: number[][], threshold: number): Peak[] {
  const peaks: Peak[] = []
  for (let t = 1; t < TIME_BINS - 1; t++) {
    for (let f = 1; f < FREQ_BINS - 1; f++) {
      const val = grid[t][f]
      if (val < threshold) continue
      let isMax = true
      for (let dt = -1; dt <= 1 && isMax; dt++) {
        for (let df = -1; df <= 1 && isMax; df++) {
          if (dt === 0 && df === 0) continue
          if (grid[t + dt][f + df] >= val) isMax = false
        }
      }
      if (isMax) peaks.push({ time: t, freq: f, energy: val })
    }
  }
  return peaks
}

// ---------------------------------------------------------------------------
// Hash generation — anchor + target zone pairing
// ---------------------------------------------------------------------------

export function computeHash(f1: number, f2: number, dt: number): number {
  return ((f1 & 0x3FF) << 22) | ((f2 & 0x3FF) << 12) | (dt & 0xFFF)
}

export function generateHashes(peaks: Peak[]): HashPair[] {
  const sorted = [...peaks].sort((a, b) => a.time - b.time || a.freq - b.freq)
  const hashes: HashPair[] = []

  for (const anchor of sorted) {
    let count = 0
    for (const target of sorted) {
      if (count >= FAN_OUT) break
      const dt = target.time - anchor.time
      if (dt < TARGET_ZONE_TIME[0] || dt > TARGET_ZONE_TIME[1]) continue
      const df = Math.abs(target.freq - anchor.freq)
      if (df > TARGET_ZONE_FREQ) continue

      const hash = computeHash(anchor.freq, target.freq, dt)
      hashes.push({ anchor, target, hash, f1: anchor.freq, f2: target.freq, dt })
      count++
    }
  }

  return hashes
}

export function generateAnchorPairs(peaks: Peak[]): { anchor: Peak; targets: Peak[]; hashes: HashPair[] }[] {
  const sorted = [...peaks].sort((a, b) => a.time - b.time || a.freq - b.freq)
  const pairs: { anchor: Peak; targets: Peak[]; hashes: HashPair[] }[] = []

  for (const anchor of sorted) {
    const targets: Peak[] = []
    const hashes: HashPair[] = []
    let count = 0
    for (const target of sorted) {
      if (count >= FAN_OUT) break
      const dt = target.time - anchor.time
      if (dt < TARGET_ZONE_TIME[0] || dt > TARGET_ZONE_TIME[1]) continue
      const df = Math.abs(target.freq - anchor.freq)
      if (df > TARGET_ZONE_FREQ) continue

      targets.push(target)
      const hash = computeHash(anchor.freq, target.freq, dt)
      hashes.push({ anchor, target, hash, f1: anchor.freq, f2: target.freq, dt })
      count++
    }
    if (targets.length > 0) pairs.push({ anchor, targets, hashes })
  }

  return pairs
}

// ---------------------------------------------------------------------------
// Per-query-hash precomputed matches (full database scan)
// ---------------------------------------------------------------------------

export function buildQueryHashMatches(queryHashes: HashPair[], songs: Song[]): QueryHashMatch[] {
  return queryHashes.map((qh, i) => {
    const matches: { songId: number; offset: number }[] = []
    for (const song of songs) {
      for (const sh of song.hashes) {
        if (qh.hash === sh.hash) {
          matches.push({ songId: song.id, offset: qh.anchor.time - sh.anchor.time })
        }
      }
    }
    return { queryIdx: i, hash: qh.hash, matches }
  })
}

// ---------------------------------------------------------------------------
// Partial match results — derive bars/histograms from first `upTo` lookups
// ---------------------------------------------------------------------------

export function buildPartialMatchResults(
  queryHashMatches: QueryHashMatch[], songs: Song[], upTo: number,
): MatchResult[] {
  const songBins = new Map<number, Map<number, number>>()
  const songTotals = new Map<number, number>()
  for (const song of songs) {
    songBins.set(song.id, new Map())
    songTotals.set(song.id, 0)
  }

  const limit = Math.min(upTo, queryHashMatches.length)
  for (let i = 0; i < limit; i++) {
    for (const m of queryHashMatches[i].matches) {
      const bins = songBins.get(m.songId)!
      bins.set(m.offset, (bins.get(m.offset) || 0) + 1)
      songTotals.set(m.songId, (songTotals.get(m.songId) || 0) + 1)
    }
  }

  return songs.map(song => {
    const bins = songBins.get(song.id)!
    const histogram: HistogramBin[] = [...bins.entries()]
      .map(([offset, count]) => ({ offset, count }))
      .sort((a, b) => a.offset - b.offset)
    const maxCount = histogram.reduce((max, b) => Math.max(max, b.count), 0)
    return {
      songId: song.id, songName: song.name, color: song.color,
      histogram, maxCount, totalMatches: songTotals.get(song.id) || 0,
    }
  })
}

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

function addEvent(
  events: ShazamEvent[], counter: number, text: string, color: string,
): { events: ShazamEvent[]; counter: number } {
  return { events: [{ id: counter + 1, text, color }, ...events].slice(0, 12), counter: counter + 1 }
}

// ---------------------------------------------------------------------------
// Create initial state per mode
// ---------------------------------------------------------------------------

export function createInitialShazamState(mode: number): ShazamState {
  const songs = defineSongs()
  const targetSong = songs[2] // Rock Guitar — the one we'll match
  const spectrogram = generateSpectrogram(targetSong.peaks)
  const peaks = extractPeaks(spectrogram, DEFAULT_THRESHOLD)
  const anchorPairs = generateAnchorPairs(peaks)
  const allHashes = anchorPairs.flatMap(ap => ap.hashes)
  const query = generateQuery(songs)
  const queryHashMatches = buildQueryHashMatches(query.hashes, songs)
  const matchResults = buildPartialMatchResults(queryHashMatches, songs, query.hashes.length)
  const matchedSongId = matchResults.reduce((best, r) => r.maxCount > (best?.maxCount ?? 0) ? r : best, matchResults[0])?.songId ?? null

  // Spectrogram fully built unless mode 0 (build animation), waveform skipped (mode -1)
  const built = mode === 0 ? 0 : TIME_BINS

  return {
    tick: 0,
    mode,
    spectrogram,
    spectrogramBuilt: built,
    peaks,
    peakThreshold: DEFAULT_THRESHOLD,
    anchorPairs,
    allHashes,
    currentAnchorIdx: 0,
    songs,
    queryPeaks: query.peaks,
    queryHashes: query.hashes,
    queryHashMatches,
    currentLookupIdx: 0,
    matchResults,
    matchedSongId,
    animating: false,
    lastOp: mode === -1 ? 'Audio waveform — raw amplitude over time' : 'Ready',
    recentEvents: [],
    eventCounter: 0,
  }
}

// ---------------------------------------------------------------------------
// Tick — advance animations
// ---------------------------------------------------------------------------

export function shazamTick(state: ShazamState): ShazamState {
  const s = { ...state, tick: state.tick + 1 }

  // Spectrogram build animation (Fix 0)
  if (s.mode === 0 && s.spectrogramBuilt < TIME_BINS) {
    s.spectrogramBuilt = Math.min(TIME_BINS, s.spectrogramBuilt + 1)
    if (s.spectrogramBuilt === TIME_BINS) {
      const { events, counter } = addEvent(s.recentEvents, s.eventCounter, 'Spectrogram complete — all time windows processed', '#22c55e')
      s.recentEvents = events
      s.eventCounter = counter
      s.animating = false
    }
    return s
  }

  // Anchor pair cycling (Fix 2) — wraps around for continuous demo
  if (s.mode === 2 && s.anchorPairs.length > 0) {
    const next = (s.currentAnchorIdx + 1) % s.anchorPairs.length
    s.currentAnchorIdx = next
    const ap = s.anchorPairs[next]
    const { events, counter } = addEvent(
      s.recentEvents, s.eventCounter,
      `Anchor #${next + 1}/${s.anchorPairs.length} (t=${ap.anchor.time}, f=${ap.anchor.freq}) → ${ap.targets.length} targets, ${ap.hashes.length} hashes`,
      '#3b82f6',
    )
    s.recentEvents = events
    s.eventCounter = counter
    return s
  }

  // Hash lookup advance (Fix 3-4) — one hash per tick
  if (s.mode >= 3 && s.currentLookupIdx < s.queryHashes.length) {
    const qIdx = s.currentLookupIdx
    s.currentLookupIdx = qIdx + 1
    const qhm = s.queryHashMatches[qIdx]
    const hashHex = qhm.hash.toString(16).padStart(8, '0').slice(0, 8)

    if (qhm.matches.length > 0) {
      // Log first match (or aggregate)
      const m = qhm.matches[0]
      const songName = s.songs[m.songId].name
      const songColor = s.songs[m.songId].color
      const { events, counter } = addEvent(
        s.recentEvents, s.eventCounter,
        `#${qIdx + 1}: 0x${hashHex} → ${songName} (offset ${m.offset >= 0 ? '+' : ''}${m.offset})`,
        songColor,
      )
      s.recentEvents = events
      s.eventCounter = counter
    } else {
      const { events, counter } = addEvent(
        s.recentEvents, s.eventCounter,
        `#${qIdx + 1}: 0x${hashHex} → no match`,
        '#64748b',
      )
      s.recentEvents = events
      s.eventCounter = counter
    }

    // Final result on completion
    if (s.currentLookupIdx === s.queryHashes.length) {
      const final = buildPartialMatchResults(s.queryHashMatches, s.songs, s.queryHashes.length)
      const best = final.reduce((b, r) => r.maxCount > b.maxCount ? r : b, final[0])
      const offset = best.histogram.find(b => b.count === best.maxCount)?.offset ?? 0
      const { events, counter } = addEvent(
        s.recentEvents, s.eventCounter,
        `★ MATCH FOUND: "${best.songName}" — ${best.maxCount} hashes coherent at offset ${offset >= 0 ? '+' : ''}${offset}`,
        '#22c55e',
      )
      s.recentEvents = events
      s.eventCounter = counter
      s.animating = false
    }
    return s
  }

  // Mode -1, 1: nothing to advance, just tick (waveform/constellation animate via SVG)
  return s
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function shazamSetThreshold(state: ShazamState, value: number): ShazamState {
  const clamped = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, value))
  const peaks = extractPeaks(state.spectrogram, clamped)
  const anchorPairs = generateAnchorPairs(peaks)
  const allHashes = anchorPairs.flatMap(ap => ap.hashes)
  const { events, counter } = addEvent(
    state.recentEvents, state.eventCounter,
    `Threshold → ${clamped}: ${peaks.length} peaks survived, ${allHashes.length} hashes`,
    '#f59e0b',
  )
  return {
    ...state, peaks, peakThreshold: clamped,
    anchorPairs, allHashes,
    currentAnchorIdx: 0, // reset cycle so new peaks visible
    recentEvents: events, eventCounter: counter,
  }
}

export function shazamStartAnimation(state: ShazamState): ShazamState {
  return { ...state, animating: true, currentAnchorIdx: 0, currentLookupIdx: 0 }
}

export function shazamStopAnimation(state: ShazamState): ShazamState {
  return { ...state, animating: false }
}

export function shazamBuildSpectrogram(state: ShazamState): ShazamState {
  return { ...state, spectrogramBuilt: 0 }
}

// ---------------------------------------------------------------------------
// Exported constants for rendering
// ---------------------------------------------------------------------------

export { TIME_BINS, FREQ_BINS, TARGET_ZONE_TIME, TARGET_ZONE_FREQ, MIN_THRESHOLD, MAX_THRESHOLD, DEFAULT_THRESHOLD }

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

export function energyToColor(energy: number, dimmed = false): string {
  const e = dimmed ? energy * 0.3 : energy
  if (e < 20) return '#0f172a'
  if (e < 50) return '#1e293b'
  if (e < 80) return '#1e3a5f'
  if (e < 110) return '#164e63'
  if (e < 140) return '#166534'
  if (e < 170) return '#a16207'
  if (e < 200) return '#dc2626'
  if (e < 230) return '#f97316'
  return '#fef08a'
}
