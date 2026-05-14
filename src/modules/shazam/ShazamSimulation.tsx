import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import type { Stage } from '../../simulation/types'
import type { ShazamState } from './shazam.types'
import {
  createInitialShazamState, shazamTick, shazamSetThreshold,
  shazamStartAnimation, shazamStopAnimation, shazamBuildSpectrogram,
  buildPartialMatchResults,
  energyToColor, TIME_BINS, FREQ_BINS, TARGET_ZONE_TIME, TARGET_ZONE_FREQ,
  MIN_THRESHOLD, MAX_THRESHOLD,
} from './ShazamEngine'

interface Props { stage?: Stage; fixModeIndex?: number }

type Action =
  | { type: 'tick' }
  | { type: 'set-threshold'; value: number }
  | { type: 'start-animation' }
  | { type: 'stop-animation' }
  | { type: 'build-spectrogram' }
  | { type: 'init'; mode: number }

function reducer(state: ShazamState, action: Action): ShazamState {
  switch (action.type) {
    case 'tick': return shazamTick(state)
    case 'set-threshold': return shazamSetThreshold(state, action.value)
    case 'start-animation': return shazamStartAnimation(state)
    case 'stop-animation': return shazamStopAnimation(state)
    case 'build-spectrogram': return shazamBuildSpectrogram(state)
    case 'init': return createInitialShazamState(action.mode)
    default: return state
  }
}

const CREAM = '#F0F0E8'
const CREAM_ALT = '#E8E6D8'
const MUTED = '#8B8B7A'
const CORAL = '#D4654A'
const BLUE = '#3b82f6'
const GREEN = '#22c55e'

export function ShazamSimulation({ fixModeIndex = -1 }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialShazamState(fixModeIndex))
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isAuto, setIsAuto] = useState(false)

  const stopAll = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    setIsAuto(false)
  }, [])

  useEffect(() => { stopAll(); dispatch({ type: 'init', mode: fixModeIndex }) }, [fixModeIndex, stopAll])
  useEffect(() => () => stopAll(), [stopAll])

  const toggleAuto = useCallback(() => {
    if (isAuto) {
      dispatch({ type: 'stop-animation' })
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
      setIsAuto(false)
    } else {
      dispatch({ type: 'start-animation' })
      // Faster ticks for spectrogram build, slower for hash lookup so user can read
      const interval = fixModeIndex === 0 ? 150 : fixModeIndex === 2 ? 600 : 350
      tickRef.current = setInterval(() => dispatch({ type: 'tick' }), interval)
      setIsAuto(true)
    }
  }, [isAuto, fixModeIndex])

  const s = state

  // Spectrogram grid layout
  const SG_X = 80, SG_Y = 55, CELL_W = 30, CELL_H = 14

  // -----------------------------------------------------------------------
  // Base (-1): Waveform
  // -----------------------------------------------------------------------
  function renderWaveform() {
    const waveY = 170, waveH = 100, waveX = 60, waveW = 780
    const points: string[] = []
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * Math.PI * 12 + s.tick * 0.3
      const amp = Math.sin(t) * 0.4 + Math.sin(t * 2.2) * 0.25 + Math.sin(t * 3.7) * 0.15 + Math.sin(t * 5.1) * 0.1
      const x = waveX + (i / 200) * waveW
      const y = waveY + amp * waveH
      points.push(`${x},${y}`)
    }

    return (
      <g>
        <text x={450} y={22} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">RAW AUDIO WAVEFORM</text>
        <text x={450} y={38} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Amplitude over time — can't match this directly</text>

        {/* Axes */}
        <line x1={waveX} y1={waveY - waveH} x2={waveX} y2={waveY + waveH} stroke={MUTED} strokeWidth="1" />
        <line x1={waveX} y1={waveY} x2={waveX + waveW} y2={waveY} stroke={MUTED} strokeWidth="1" strokeDasharray="4,2" />
        <text x={waveX - 5} y={waveY - waveH + 5} textAnchor="end" fill={MUTED} fontSize="7" fontFamily="'Space Mono', monospace">+1</text>
        <text x={waveX - 5} y={waveY + 4} textAnchor="end" fill={MUTED} fontSize="7" fontFamily="'Space Mono', monospace">0</text>
        <text x={waveX - 5} y={waveY + waveH} textAnchor="end" fill={MUTED} fontSize="7" fontFamily="'Space Mono', monospace">-1</text>
        <text x={waveX + waveW / 2} y={waveY + waveH + 20} textAnchor="middle" fill={MUTED} fontSize="8" fontFamily="'Space Mono', monospace">Time →</text>
        <text x={25} y={waveY} textAnchor="middle" fill={MUTED} fontSize="7" fontFamily="'Space Mono', monospace" transform={`rotate(-90, 25, ${waveY})`}>Amplitude</text>

        {/* Waveform */}
        <polyline points={points.join(' ')} fill="none" stroke="#4A6FA5" strokeWidth="2" opacity="0.9" />

        {/* Composite label */}
        <text x={450} y={waveY + waveH + 40} textAnchor="middle" fill="#555" fontSize="9" fontFamily="'Space Mono', monospace">
          Composite: sin(200Hz) + sin(440Hz) + sin(880Hz) + sin(1200Hz)
        </text>
        <text x={450} y={waveY + waveH + 58} textAnchor="middle" fill={CORAL} fontSize="8" fontFamily="'Space Mono', monospace">
          Problem: noise, volume, timing make raw matching impossible
        </text>
      </g>
    )
  }

  // -----------------------------------------------------------------------
  // Fix 0: Spectrogram
  // -----------------------------------------------------------------------
  function renderSpectrogram() {
    const built = s.spectrogramBuilt
    return (
      <g>
        <text x={450} y={18} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">SPECTROGRAM (STFT)</text>
        <text x={450} y={33} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Each column = one FFT window. Color = energy at that frequency.</text>

        {/* Y axis — frequency */}
        <text x={SG_X - 8} y={SG_Y + FREQ_BINS * CELL_H / 2} textAnchor="middle" fill={MUTED} fontSize="7" fontFamily="'Space Mono', monospace" transform={`rotate(-90, ${SG_X - 8}, ${SG_Y + FREQ_BINS * CELL_H / 2})`}>Frequency ↑</text>
        {/* X axis — time */}
        <text x={SG_X + TIME_BINS * CELL_W / 2} y={SG_Y + FREQ_BINS * CELL_H + 18} textAnchor="middle" fill={MUTED} fontSize="8" fontFamily="'Space Mono', monospace">Time →</text>

        {/* Grid */}
        {s.spectrogram.map((col, t) => t < built && col.map((energy, f) => (
          <rect
            key={`${t}-${f}`}
            x={SG_X + t * CELL_W}
            y={SG_Y + (FREQ_BINS - 1 - f) * CELL_H}
            width={CELL_W - 1} height={CELL_H - 1}
            fill={energyToColor(energy)}
            rx="1"
          />
        )))}

        {/* Building cursor */}
        {built < TIME_BINS && (
          <rect x={SG_X + built * CELL_W} y={SG_Y} width={2} height={FREQ_BINS * CELL_H} fill="#facc15">
            <animate attributeName="opacity" values="1;0.3;1" dur="0.5s" repeatCount="indefinite" />
          </rect>
        )}

        {/* Freq labels */}
        {[0, 4, 8, 12, 15].map(f => (
          <text key={f} x={SG_X - 3} y={SG_Y + (FREQ_BINS - 1 - f) * CELL_H + CELL_H / 2 + 3} textAnchor="end" fill={MUTED} fontSize="6" fontFamily="'VT323', monospace">
            {(f * 250 + 100)}Hz
          </text>
        ))}

        {/* Stats */}
        <text x={SG_X + TIME_BINS * CELL_W + 15} y={SG_Y + 20} fill="#555" fontSize="9" fontFamily="'Space Mono', monospace">
          {TIME_BINS}×{FREQ_BINS} grid
        </text>
        <text x={SG_X + TIME_BINS * CELL_W + 15} y={SG_Y + 38} fill="#555" fontSize="9" fontFamily="'Space Mono', monospace">
          {TIME_BINS * FREQ_BINS} cells
        </text>
        <text x={SG_X + TIME_BINS * CELL_W + 15} y={SG_Y + 56} fill={built < TIME_BINS ? '#f59e0b' : GREEN} fontSize="9" fontFamily="'Space Mono', monospace">
          {built}/{TIME_BINS} built
        </text>

        {/* Color legend */}
        <g transform={`translate(${SG_X + TIME_BINS * CELL_W + 15}, ${SG_Y + 80})`}>
          <text x={0} y={0} fill={MUTED} fontSize="7" fontFamily="'Space Mono', monospace">Energy:</text>
          {[20, 60, 100, 140, 180, 220, 250].map((e, i) => (
            <rect key={e} x={i * 14} y={8} width={12} height={10} fill={energyToColor(e)} rx="1" />
          ))}
          <text x={0} y={28} fill={MUTED} fontSize="6" fontFamily="'VT323', monospace">low → high</text>
        </g>
      </g>
    )
  }

  // -----------------------------------------------------------------------
  // Fix 1: Constellation Map
  // -----------------------------------------------------------------------
  function renderConstellation() {
    return (
      <g>
        <text x={450} y={18} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">CONSTELLATION MAP</text>
        <text x={450} y={33} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Local maxima = peaks. Only the loudest survive noise.</text>

        {/* Dimmed spectrogram */}
        {s.spectrogram.map((col, t) => col.map((energy, f) => (
          <rect
            key={`${t}-${f}`}
            x={SG_X + t * CELL_W}
            y={SG_Y + (FREQ_BINS - 1 - f) * CELL_H}
            width={CELL_W - 1} height={CELL_H - 1}
            fill={energyToColor(energy, true)}
            rx="1"
          />
        )))}

        {/* Peak dots */}
        {s.peaks.map((p, i) => (
          <g key={i}>
            <circle
              cx={SG_X + p.time * CELL_W + CELL_W / 2}
              cy={SG_Y + (FREQ_BINS - 1 - p.freq) * CELL_H + CELL_H / 2}
              r={5} fill="#facc15" stroke="#fef08a" strokeWidth="1.5" opacity="0.95"
            >
              <animate attributeName="r" values="4;6;4" dur="2s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
            </circle>
          </g>
        ))}

        {/* Freq axis */}
        <text x={SG_X - 8} y={SG_Y + FREQ_BINS * CELL_H / 2} textAnchor="middle" fill={MUTED} fontSize="7" fontFamily="'Space Mono', monospace" transform={`rotate(-90, ${SG_X - 8}, ${SG_Y + FREQ_BINS * CELL_H / 2})`}>Frequency ↑</text>
        <text x={SG_X + TIME_BINS * CELL_W / 2} y={SG_Y + FREQ_BINS * CELL_H + 18} textAnchor="middle" fill={MUTED} fontSize="8" fontFamily="'Space Mono', monospace">Time →</text>

        {/* Stats */}
        <text x={SG_X + TIME_BINS * CELL_W + 15} y={SG_Y + 20} fill="#facc15" fontSize="10" fontFamily="'Space Mono', monospace" fontWeight="bold">
          {s.peaks.length} peaks
        </text>
        <text x={SG_X + TIME_BINS * CELL_W + 15} y={SG_Y + 40} fill={MUTED} fontSize="9" fontFamily="'Space Mono', monospace">
          from {TIME_BINS * FREQ_BINS} cells
        </text>
        <text x={SG_X + TIME_BINS * CELL_W + 15} y={SG_Y + 58} fill={MUTED} fontSize="8" fontFamily="'Space Mono', monospace">
          threshold: {s.peakThreshold}
        </text>
        <text x={SG_X + TIME_BINS * CELL_W + 15} y={SG_Y + 78} fill={GREEN} fontSize="8" fontFamily="'Space Mono', monospace">
          {((1 - s.peaks.length / (TIME_BINS * FREQ_BINS)) * 100).toFixed(1)}% reduction
        </text>
      </g>
    )
  }

  // -----------------------------------------------------------------------
  // Fix 2: Hashing — anchor + target zone
  // -----------------------------------------------------------------------
  function renderHashing() {
    const ap = s.anchorPairs[Math.min(s.currentAnchorIdx, s.anchorPairs.length - 1)]
    const visiblePairs = s.anchorPairs.slice(0, s.currentAnchorIdx + 1)
    const totalHashesSoFar = visiblePairs.reduce((sum, p) => sum + p.hashes.length, 0)

    return (
      <g>
        <text x={450} y={18} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">FINGERPRINT HASHING</text>
        <text x={450} y={33} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Anchor + target zone → hash = (f₁, f₂, Δt)</text>

        {/* Dimmed spectrogram */}
        {s.spectrogram.map((col, t) => col.map((energy, f) => (
          <rect
            key={`${t}-${f}`}
            x={SG_X + t * CELL_W}
            y={SG_Y + (FREQ_BINS - 1 - f) * CELL_H}
            width={CELL_W - 1} height={CELL_H - 1}
            fill={energyToColor(energy, true)}
            rx="1" opacity="0.5"
          />
        )))}

        {/* All peaks (dim) */}
        {s.peaks.map((p, i) => (
          <circle
            key={i}
            cx={SG_X + p.time * CELL_W + CELL_W / 2}
            cy={SG_Y + (FREQ_BINS - 1 - p.freq) * CELL_H + CELL_H / 2}
            r={3} fill="#facc15" opacity="0.3"
          />
        ))}

        {ap && (
          <g>
            {/* Target zone rectangle */}
            <rect
              x={SG_X + (ap.anchor.time + TARGET_ZONE_TIME[0]) * CELL_W}
              y={SG_Y + (FREQ_BINS - 1 - ap.anchor.freq - TARGET_ZONE_FREQ) * CELL_H}
              width={(TARGET_ZONE_TIME[1] - TARGET_ZONE_TIME[0] + 1) * CELL_W}
              height={(TARGET_ZONE_FREQ * 2 + 1) * CELL_H}
              fill={BLUE} opacity="0.12" stroke={BLUE} strokeWidth="1.5" strokeDasharray="4,2" rx="3"
            />
            <text
              x={SG_X + (ap.anchor.time + TARGET_ZONE_TIME[0]) * CELL_W + 3}
              y={SG_Y + (FREQ_BINS - 1 - ap.anchor.freq - TARGET_ZONE_FREQ) * CELL_H - 4}
              fill={BLUE} fontSize="6" fontFamily="'Space Mono', monospace"
            >target zone</text>

            {/* Anchor point */}
            <circle
              cx={SG_X + ap.anchor.time * CELL_W + CELL_W / 2}
              cy={SG_Y + (FREQ_BINS - 1 - ap.anchor.freq) * CELL_H + CELL_H / 2}
              r={7} fill={BLUE} stroke="white" strokeWidth="2"
            >
              <animate attributeName="r" values="6;8;6" dur="1s" repeatCount="indefinite" />
            </circle>

            {/* Target points + connecting lines */}
            {ap.targets.map((t, ti) => {
              const ax = SG_X + ap.anchor.time * CELL_W + CELL_W / 2
              const ay = SG_Y + (FREQ_BINS - 1 - ap.anchor.freq) * CELL_H + CELL_H / 2
              const tx = SG_X + t.time * CELL_W + CELL_W / 2
              const ty = SG_Y + (FREQ_BINS - 1 - t.freq) * CELL_H + CELL_H / 2
              return (
                <g key={ti}>
                  <line x1={ax} y1={ay} x2={tx} y2={ty} stroke="#ef4444" strokeWidth="1.5" opacity="0.7" />
                  <circle cx={tx} cy={ty} r={5} fill="#ef4444" stroke="white" strokeWidth="1" />
                </g>
              )
            })}
          </g>
        )}

        {/* Hash info panel */}
        <rect x={SG_X + TIME_BINS * CELL_W + 10} y={SG_Y} width={140} height={170} rx="6" fill="#1e293b" opacity="0.9" />
        {ap && (
          <g>
            <text x={SG_X + TIME_BINS * CELL_W + 20} y={SG_Y + 18} fill="#facc15" fontSize="7" fontFamily="'Press Start 2P', monospace">HASH PAIRS</text>
            {ap.hashes.slice(0, 5).map((h, i) => (
              <text key={i} x={SG_X + TIME_BINS * CELL_W + 20} y={SG_Y + 38 + i * 16} fill="#94a3b8" fontSize="9" fontFamily="'VT323', monospace">
                f₁={h.f1} f₂={h.f2} Δt={h.dt} →0x{h.hash.toString(16).slice(0, 6)}
              </text>
            ))}
            <text x={SG_X + TIME_BINS * CELL_W + 20} y={SG_Y + 130} fill={GREEN} fontSize="9" fontFamily="'Space Mono', monospace">
              Anchor {s.currentAnchorIdx + 1}/{s.anchorPairs.length}
            </text>
            <text x={SG_X + TIME_BINS * CELL_W + 20} y={SG_Y + 148} fill="#94a3b8" fontSize="9" fontFamily="'Space Mono', monospace">
              Total: {totalHashesSoFar} hashes
            </text>
          </g>
        )}
      </g>
    )
  }

  // -----------------------------------------------------------------------
  // Fix 3: Database Matching (partial results grow with currentLookupIdx)
  // -----------------------------------------------------------------------
  function renderMatching() {
    const lookupProgress = Math.min(s.currentLookupIdx, s.queryHashes.length)
    const pct = s.queryHashes.length > 0 ? (lookupProgress / s.queryHashes.length * 100).toFixed(0) : '0'
    const partial = buildPartialMatchResults(s.queryHashMatches, s.songs, lookupProgress)
    const finalMax = Math.max(8, ...s.matchResults.map(r => r.totalMatches))
    const lastIdx = lookupProgress - 1
    const lastQhm = lastIdx >= 0 ? s.queryHashMatches[lastIdx] : null
    const lastMatchedSongIds = new Set(lastQhm ? lastQhm.matches.map(m => m.songId) : [])

    // Visible window of query hashes (scroll with progress, show ~12 around current)
    const winSize = 12
    const winStart = Math.max(0, Math.min(s.queryHashes.length - winSize, lookupProgress - 6))
    const visibleHashes = s.queryHashes.slice(winStart, winStart + winSize)

    return (
      <g>
        <text x={450} y={18} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">DATABASE LOOKUP</text>
        <text x={450} y={33} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Each query hash → search 5 songs → tally per-song hits</text>

        {/* Query hashes (left) */}
        <rect x={20} y={50} width={200} height={260} rx="6" fill="#1e293b" opacity="0.95" />
        <text x={120} y={66} textAnchor="middle" fill="#facc15" fontSize="7" fontFamily="'Press Start 2P', monospace">QUERY HASHES</text>
        <text x={120} y={80} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="'Space Mono', monospace">{lookupProgress}/{s.queryHashes.length} processed ({pct}%)</text>

        {visibleHashes.map((h, vi) => {
          const i = winStart + vi
          const checked = i < lookupProgress
          const isCurrent = i === lastIdx
          const matchCount = s.queryHashMatches[i].matches.length
          const hashHex = h.hash.toString(16).padStart(8, '0').slice(0, 8)
          const fill = isCurrent ? '#facc15' : checked ? (matchCount > 0 ? GREEN : '#64748b') : '#475569'
          return (
            <g key={i}>
              {isCurrent && (
                <rect x={28} y={92 + vi * 17 - 9} width={184} height={14} rx="3" fill="#facc15" opacity="0.15" />
              )}
              <text x={32} y={92 + vi * 17} fill={fill} fontSize="9" fontFamily="'VT323', monospace">
                {checked ? (matchCount > 0 ? '✓' : '·') : '○'} #{(i + 1).toString().padStart(2, '0')} 0x{hashHex}
              </text>
              {checked && matchCount > 0 && (
                <text x={200} y={92 + vi * 17} textAnchor="end" fill="#94a3b8" fontSize="8" fontFamily="'VT323', monospace">×{matchCount}</text>
              )}
            </g>
          )
        })}

        {/* Lookup arrow + flying-hash particle when current hash matched */}
        <line x1={224} y1={180} x2={264} y2={180} stroke={BLUE} strokeWidth="2" strokeDasharray="4,2" />
        <polygon points="264,180 256,176 256,184" fill={BLUE} />
        {lastQhm && lastQhm.matches.length > 0 && (
          <circle cx={244} cy={180} r={4} fill="#facc15" stroke="white" strokeWidth="1">
            <animate attributeName="cx" values="224;264" dur="0.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.3" dur="0.4s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Song database (right) — bars grow with partial.totalMatches */}
        <rect x={272} y={50} width={605} height={260} rx="6" fill={CREAM_ALT} stroke="#B0B09A" strokeWidth="1" />
        <text x={574} y={66} textAnchor="middle" fill="#4A6FA5" fontSize="7" fontFamily="'Press Start 2P', monospace">DATABASE — 5 SONGS</text>
        <text x={574} y={80} textAnchor="middle" fill={MUTED} fontSize="8" fontFamily="'Space Mono', monospace">
          bar = total hits accumulating per query hash
        </text>

        {partial.map((mr, i) => {
          const barMax = 360
          const barW = Math.max(0, Math.min(barMax, (mr.totalMatches / finalMax) * barMax))
          const isLastMatched = lastMatchedSongIds.has(mr.songId)
          return (
            <g key={mr.songId} transform={`translate(282, ${100 + i * 40})`}>
              <circle cx={8} cy={10} r={6} fill={mr.color} />
              <text x={22} y={14} fill="#333" fontSize="9" fontFamily="'Space Mono', monospace" fontWeight="bold">
                {mr.songName}
              </text>
              {/* Bar background */}
              <rect x={22} y={20} width={barMax} height={12} rx="3" fill="#d4d4c8" />
              {/* Bar fill */}
              <rect x={22} y={20} width={barW} height={12} rx="3" fill={mr.color} opacity="0.85" />
              {/* Pulse ring on last-matched song */}
              {isLastMatched && (
                <circle cx={8} cy={10} r={6} fill="none" stroke={mr.color} strokeWidth="2">
                  <animate attributeName="r" values="6;14;6" dur="0.6s" repeatCount="1" />
                  <animate attributeName="opacity" values="1;0;1" dur="0.6s" repeatCount="1" />
                </circle>
              )}
              {/* Hit count */}
              <text x={22 + barMax + 8} y={29} fill={isLastMatched ? mr.color : '#555'} fontSize="10" fontFamily="'VT323', monospace" fontWeight={isLastMatched ? 'bold' : 'normal'}>
                {mr.totalMatches} hits
              </text>
              {/* "+N" flash on increment */}
              {isLastMatched && lastQhm && (
                <text x={22 + barW + 4} y={15} fill={mr.color} fontSize="10" fontFamily="'VT323', monospace" fontWeight="bold">
                  +{lastQhm.matches.filter(m => m.songId === mr.songId).length}
                  <animate attributeName="opacity" values="1;0" dur="0.8s" repeatCount="1" fill="freeze" />
                  <animate attributeName="y" values="15;5" dur="0.8s" repeatCount="1" fill="freeze" />
                </text>
              )}
            </g>
          )
        })}
      </g>
    )
  }

  // -----------------------------------------------------------------------
  // Fix 4: Time-Offset Histogram (bins grow with currentLookupIdx)
  // -----------------------------------------------------------------------
  function renderHistogram() {
    const lookupProgress = Math.min(s.currentLookupIdx, s.queryHashes.length)
    const partial = buildPartialMatchResults(s.queryHashMatches, s.songs, lookupProgress)
    const finalResults = s.matchResults
    const finalBest = finalResults.reduce((b, r) => r.maxCount > b.maxCount ? r : b, finalResults[0])
    const lookupDone = lookupProgress >= s.queryHashes.length

    // Last-checked hash → highlight bin in matching songs
    const lastIdx = lookupProgress - 1
    const lastQhm = lastIdx >= 0 ? s.queryHashMatches[lastIdx] : null
    const lastMatchOffsets = new Map<number, number>()
    if (lastQhm) lastQhm.matches.forEach(m => lastMatchOffsets.set(m.songId, m.offset))

    // Use FINAL maxCount for bar scaling so bars visibly fill in toward final spike
    const finalMax = Math.max(2, ...finalResults.map(r => r.maxCount))

    // Common offset axis range for all songs (so bar positions are comparable)
    const allOffsets = finalResults.flatMap(r => r.histogram.map(b => b.offset))
    const minOffset = allOffsets.length > 0 ? Math.min(...allOffsets) : -5
    const maxOffset = allOffsets.length > 0 ? Math.max(...allOffsets) : 5
    const offsetSpan = Math.max(10, maxOffset - minOffset + 1)

    const histW = 150, histH = 70
    const binW = Math.max(2, histW / offsetSpan)

    return (
      <g>
        <text x={450} y={18} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">TIME COHERENCY</text>
        <text x={450} y={33} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">
          True match → bars stack at one offset (spike). Random → scattered.
        </text>
        <text x={450} y={45} textAnchor="middle" fill={MUTED} fontSize="9" fontFamily="'Space Mono', monospace">
          Processed {lookupProgress}/{s.queryHashes.length} query hashes
        </text>

        {/* Song histograms — 5 panels in 2 rows (3 + 2) */}
        {partial.map((mr, i) => {
          const hx = 25 + (i % 3) * 290
          const hy = 60 + Math.floor(i / 3) * 130
          const isFinalMatch = mr.songId === finalBest.songId && lookupDone
          const isLeading = mr.songId === partial.reduce((b, r) => r.maxCount > b.maxCount ? r : b, partial[0]).songId && mr.maxCount > 0
          const lastOffset = lastMatchOffsets.get(mr.songId)

          return (
            <g key={mr.songId}>
              {/* Panel background */}
              <rect x={hx} y={hy} width={histW + 90} height={histH + 50} rx="6"
                fill={isFinalMatch ? '#052e16' : CREAM_ALT}
                stroke={isFinalMatch ? GREEN : isLeading ? mr.color : '#B0B09A'}
                strokeWidth={isFinalMatch ? 2 : isLeading ? 1.5 : 1}
              />
              <circle cx={hx + 10} cy={hy + 14} r={5} fill={mr.color} />
              <text x={hx + 20} y={hy + 17} fill={isFinalMatch ? GREEN : '#333'} fontSize="8" fontFamily="'Space Mono', monospace" fontWeight="bold">
                {mr.songName}
              </text>
              <text x={hx + histW + 70} y={hy + 17} textAnchor="end" fill={MUTED} fontSize="7" fontFamily="'VT323', monospace">
                {mr.totalMatches} hits
              </text>

              {/* Histogram bars */}
              {mr.histogram.map((bin) => {
                const barH = (bin.count / finalMax) * histH
                const bx = hx + 10 + (bin.offset - minOffset) * binW
                const isPeak = bin.count === mr.maxCount && mr.maxCount >= 2
                const isHit = bin.offset === lastOffset
                return (
                  <g key={bin.offset}>
                    <rect
                      x={bx} y={hy + 30 + histH - barH}
                      width={Math.max(2, binW - 1)} height={barH}
                      fill={isPeak ? (isFinalMatch ? GREEN : mr.color) : '#94a3b8'}
                      opacity={isPeak ? 0.95 : 0.55}
                      rx="1"
                    />
                    {/* Last-hit pulse */}
                    {isHit && (
                      <rect
                        x={bx - 1} y={hy + 30 + histH - barH - 2}
                        width={Math.max(4, binW + 1)} height={barH + 4}
                        fill="none" stroke="#facc15" strokeWidth="1.5" rx="2"
                      >
                        <animate attributeName="opacity" values="1;0" dur="0.6s" repeatCount="1" fill="freeze" />
                      </rect>
                    )}
                  </g>
                )
              })}

              {/* Axis */}
              <line x1={hx + 10} y1={hy + 30 + histH} x2={hx + 10 + histW} y2={hy + 30 + histH} stroke={MUTED} strokeWidth="0.5" />
              <text x={hx + 10} y={hy + 30 + histH + 10} fill={MUTED} fontSize="6" fontFamily="'VT323', monospace">{minOffset}</text>
              <text x={hx + 10 + histW} y={hy + 30 + histH + 10} textAnchor="end" fill={MUTED} fontSize="6" fontFamily="'VT323', monospace">{maxOffset}</text>
              <text x={hx + 10 + histW / 2} y={hy + 30 + histH + 10} textAnchor="middle" fill={MUTED} fontSize="6" fontFamily="'VT323', monospace">offset</text>

              {/* Peak score */}
              <text x={hx + histW + 50} y={hy + 60} textAnchor="middle"
                fill={isFinalMatch ? GREEN : isLeading ? mr.color : '#555'}
                fontSize="20" fontFamily="'VT323', monospace" fontWeight="bold">
                {mr.maxCount}
              </text>
              <text x={hx + histW + 50} y={hy + 75} textAnchor="middle" fill={MUTED} fontSize="6" fontFamily="'VT323', monospace">peak</text>

              {/* Match badge */}
              {isFinalMatch && (
                <g>
                  <rect x={hx + histW + 25} y={hy + 88} width={55} height={16} rx="8" fill={GREEN} />
                  <text x={hx + histW + 52} y={hy + 99} textAnchor="middle" fill="white" fontSize="6" fontFamily="'Press Start 2P', monospace">MATCH</text>
                </g>
              )}
            </g>
          )
        })}

        {/* Final result banner */}
        {lookupDone && (
          <g>
            <rect x={280} y={320} width={340} height={18} rx="9" fill="#052e16" stroke={GREEN} strokeWidth="1.5" />
            <text x={450} y={333} textAnchor="middle" fill={GREEN} fontSize="9" fontFamily="'Press Start 2P', monospace">
              ★ {finalBest.songName} — {finalBest.maxCount} coherent hashes
            </text>
          </g>
        )}
      </g>
    )
  }

  // -----------------------------------------------------------------------
  // Main render switch
  // -----------------------------------------------------------------------
  function renderVisualization() {
    if (fixModeIndex === -1) return renderWaveform()
    if (fixModeIndex === 0) return renderSpectrogram()
    if (fixModeIndex === 1) return renderConstellation()
    if (fixModeIndex === 2) return renderHashing()
    if (fixModeIndex === 3) return renderMatching()
    if (fixModeIndex === 4) return renderHistogram()
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* SVG Canvas */}
      <div className="flex-1 relative overflow-hidden" style={{ background: fixModeIndex === -1 || fixModeIndex === 4 ? CREAM : '#0f172a' }}>
        <svg viewBox="0 0 900 340" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <rect width="900" height="340" fill={fixModeIndex === -1 ? CREAM : fixModeIndex >= 3 ? CREAM : '#0f172a'} />
          {renderVisualization()}
        </svg>
      </div>

      {/* Event Log */}
      <div style={{ background: '#1e293b', borderTop: '2px solid #334155', height: '72px', overflowY: 'auto', padding: '4px 10px' }}>
        {s.recentEvents.slice(0, 5).map(ev => (
          <div key={ev.id} style={{ color: ev.color, fontSize: '11px', fontFamily: "'VT323', monospace", lineHeight: '13px' }}>
            {ev.text}
          </div>
        ))}
        {s.recentEvents.length === 0 && (
          <div style={{ color: MUTED, fontSize: '11px', fontFamily: "'VT323', monospace" }}>
            {fixModeIndex === -1 ? 'Audio waveform — explore fix modes to see the Shazam pipeline' : 'Press AUTO to animate, or STEP to advance manually'}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2" style={{ background: CREAM_ALT, borderTop: '1px solid #B0B09A', minHeight: '44px' }}>
        {fixModeIndex >= 0 && (
          <>
            <button className={`retro-btn text-xs px-3 py-1 ${isAuto ? 'retro-btn--accent' : ''}`} onClick={toggleAuto}>
              {isAuto ? 'STOP' : 'AUTO'}
            </button>
            <button className="retro-btn text-xs px-3 py-1" onClick={() => dispatch({ type: 'tick' })}>
              STEP
            </button>
          </>
        )}
        <button className="retro-btn text-xs px-3 py-1" onClick={() => { stopAll(); dispatch({ type: 'init', mode: fixModeIndex }) }}>
          RESET
        </button>

        {fixModeIndex === 0 && (
          <button className="retro-btn text-xs px-3 py-1" onClick={() => dispatch({ type: 'build-spectrogram' })}>
            REBUILD
          </button>
        )}

        {fixModeIndex === 1 && (
          <>
            <span className="text-xs font-mono" style={{ color: MUTED }}>threshold:</span>
            <input type="range" min={MIN_THRESHOLD} max={MAX_THRESHOLD} value={s.peakThreshold}
              onChange={e => dispatch({ type: 'set-threshold', value: +e.target.value })}
              className="w-32 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333', minWidth: '90px' }}>{s.peakThreshold} → {s.peaks.length} peaks</span>
            <span className="text-xs font-mono" style={{ color: MUTED }}>(low=noise, high=miss)</span>
          </>
        )}

        {fixModeIndex === 2 && (
          <span className="text-xs font-mono" style={{ color: MUTED }}>
            Anchor {Math.min(s.currentAnchorIdx + 1, s.anchorPairs.length)}/{s.anchorPairs.length} | {s.allHashes.length} total hashes
          </span>
        )}

        {fixModeIndex >= 3 && (
          <span className="text-xs font-mono" style={{ color: MUTED }}>
            Lookup: {Math.min(s.currentLookupIdx, s.queryHashes.length)}/{s.queryHashes.length} hashes
          </span>
        )}
      </div>
    </div>
  )
}
