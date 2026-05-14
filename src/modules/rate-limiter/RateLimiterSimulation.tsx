import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import type { Stage } from '../../simulation/types'
import type { RateLimiterState } from './rate-limiter.types'
import {
  createInitialRateLimiterState,
  rateLimitProcessRequest,
  rateLimitTick,
  rateLimitSetCapacity,
  rateLimitSetRefillRate,
  rateLimitSetDrainRate,
  rateLimitSetWindowSize,
  rateLimitSetLimit,
  rateLimitTriggerBurst,
} from './RateLimiterEngine'

interface Props { stage?: Stage; fixModeIndex?: number }

type Action =
  | { type: 'send-request' }
  | { type: 'tick' }
  | { type: 'set-capacity'; value: number }
  | { type: 'set-refill-rate'; value: number }
  | { type: 'set-drain-rate'; value: number }
  | { type: 'set-window-size'; value: number }
  | { type: 'set-limit'; value: number }
  | { type: 'trigger-burst' }
  | { type: 'init'; mode: number }

function reducer(state: RateLimiterState, action: Action): RateLimiterState {
  switch (action.type) {
    case 'send-request': return rateLimitProcessRequest(state)
    case 'tick': return rateLimitTick(state)
    case 'set-capacity': return rateLimitSetCapacity(state, action.value)
    case 'set-refill-rate': return rateLimitSetRefillRate(state, action.value)
    case 'set-drain-rate': return rateLimitSetDrainRate(state, action.value)
    case 'set-window-size': return rateLimitSetWindowSize(state, action.value)
    case 'set-limit': return rateLimitSetLimit(state, action.value)
    case 'trigger-burst': return rateLimitTriggerBurst(state)
    case 'init': return createInitialRateLimiterState(action.mode)
    default: return state
  }
}

// Colors
const GREEN = '#22c55e'
const RED = '#ef4444'
const AMBER = '#f59e0b'
const BLUE = '#3b82f6'
const CREAM = '#F0F0E8'
const CREAM_ALT = '#E8E6D8'
const MUTED = '#8B8B7A'
const CORAL = '#D4654A'

export function RateLimiterSimulation({ fixModeIndex = -1 }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialRateLimiterState(fixModeIndex))
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [autoSending, setAutoSending] = useState(false)

  const stopAll = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null }
    setAutoSending(false)
  }, [])

  useEffect(() => { stopAll(); dispatch({ type: 'init', mode: fixModeIndex }) }, [fixModeIndex, stopAll])
  useEffect(() => () => stopAll(), [stopAll])

  // Tick interval — drives time-based mechanics
  useEffect(() => {
    tickRef.current = setInterval(() => dispatch({ type: 'tick' }), 300)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [fixModeIndex])

  const toggleAuto = useCallback(() => {
    if (autoSending) {
      if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null }
      setAutoSending(false)
    } else {
      autoRef.current = setInterval(() => dispatch({ type: 'send-request' }), 200)
      setAutoSending(true)
    }
  }, [autoSending])

  const algo = state.algorithm
  const s = state

  // -----------------------------------------------------------------------
  // SVG Renderers
  // -----------------------------------------------------------------------

  function renderClient(x: number, y: number) {
    return (
      <g>
        <rect x={x} y={y} width={120} height={90} rx="6" fill={CREAM_ALT} stroke="#4A6FA5" strokeWidth="2" />
        <rect x={x} y={y} width={120} height={18} rx="6" fill="#4A6FA5" opacity="0.15" />
        <text x={x + 60} y={y + 14} textAnchor="middle" fill="#4A6FA5" fontSize="7" fontFamily="'Press Start 2P', monospace">CLIENT</text>
        <text x={x + 60} y={y + 40} textAnchor="middle" fill="#333" fontSize="10" fontFamily="'Space Mono', monospace">Sent: {s.totalRequests}</text>
        <text x={x + 60} y={y + 58} textAnchor="middle" fill={GREEN} fontSize="9" fontFamily="'Space Mono', monospace">{s.allowedCount} allowed</text>
        <text x={x + 60} y={y + 73} textAnchor="middle" fill={RED} fontSize="9" fontFamily="'Space Mono', monospace">{s.rejectedCount} rejected</text>
        {autoSending && (
          <circle cx={x + 108} cy={y + 8} r="4" fill={GREEN}>
            <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
    )
  }

  function renderServer(x: number, y: number) {
    const cpu = s.server.cpuPct
    const barColor = cpu >= 80 ? RED : cpu >= 50 ? AMBER : GREEN
    const alive = s.server.alive
    return (
      <g>
        <rect x={x} y={y} width={120} height={90} rx="6" fill={CREAM_ALT} stroke={alive ? GREEN : RED} strokeWidth="2" />
        <rect x={x} y={y} width={120} height={18} rx="6" fill={alive ? GREEN : RED} opacity="0.15" />
        <text x={x + 60} y={y + 14} textAnchor="middle" fill={alive ? GREEN : RED} fontSize="7" fontFamily="'Press Start 2P', monospace">SERVER</text>
        {alive ? (
          <>
            <text x={x + 15} y={y + 38} fill="#555" fontSize="8" fontFamily="'Space Mono', monospace">CPU</text>
            <rect x={x + 42} y={y + 29} width={65} height={12} rx="3" fill="#ddd" stroke="#999" strokeWidth="0.5" />
            <rect x={x + 42} y={y + 29} width={Math.max(0, 65 * cpu / 100)} height={12} rx="3" fill={barColor} />
            <text x={x + 74} y={y + 38} textAnchor="middle" fill="#333" fontSize="7" fontFamily="'VT323', monospace">{cpu}%</text>
            <text x={x + 60} y={y + 58} textAnchor="middle" fill="#555" fontSize="9" fontFamily="'Space Mono', monospace">{s.server.latencyMs}ms latency</text>
            <text x={x + 60} y={y + 75} textAnchor="middle" fill="#555" fontSize="9" fontFamily="'Space Mono', monospace">{s.server.processed} processed</text>
          </>
        ) : (
          <>
            <line x1={x + 30} y1={y + 35} x2={x + 90} y2={y + 75} stroke={RED} strokeWidth="4" strokeLinecap="round" />
            <line x1={x + 90} y1={y + 35} x2={x + 30} y2={y + 75} stroke={RED} strokeWidth="4" strokeLinecap="round" />
            <text x={x + 60} y={y + 60} textAnchor="middle" fill={RED} fontSize="8" fontFamily="'Press Start 2P', monospace">CRASHED</text>
          </>
        )}
      </g>
    )
  }

  function renderArrow(x1: number, y1: number, x2: number, y2: number, color: string) {
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" strokeDasharray="6,3" opacity="0.6" />
        <polygon points={`${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`} fill={color} opacity="0.6" />
      </g>
    )
  }

  // --- Base: No Rate Limiting ---
  function renderBase() {
    return (
      <g>
        <text x={450} y={25} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">NO RATE LIMITING</text>
        <text x={450} y={42} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">All requests hit server directly — no protection</text>
        {renderClient(30, 100)}
        {renderArrow(150, 145, 320, 145, s.server.alive ? GREEN : RED)}
        {/* Direct connection — no limiter box */}
        <text x={235} y={135} textAnchor="middle" fill={s.server.cpuPct >= 80 ? RED : MUTED} fontSize="9" fontFamily="'Space Mono', monospace">
          {s.server.cpuPct >= 80 ? 'OVERLOADED!' : 'no limiter'}
        </text>
        {renderServer(320, 100)}

        {/* Request particles */}
        {s.recentRequests.slice(0, 5).map((req, i) => {
          const progress = Math.min(1, (s.tick - req.timestamp) / 3)
          const px = 150 + progress * 170
          return (
            <circle key={req.id} cx={px} cy={145} r={4} fill={req.status === 'allowed' ? GREEN : RED} opacity={1 - i * 0.15}>
              <animate attributeName="r" values="4;6;4" dur="0.6s" repeatCount="indefinite" />
            </circle>
          )
        })}
      </g>
    )
  }

  // --- Token Bucket ---
  function renderTokenBucket() {
    const tb = s.tokenBucket
    const bucketX = 250, bucketY = 60, bucketW = 180, bucketH = 200
    const fillPct = tb.tokens / tb.capacity
    const fillH = fillPct * (bucketH - 20)

    return (
      <g>
        <text x={450} y={25} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">TOKEN BUCKET</text>
        <text x={450} y={42} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Tokens refill over time. Each request costs 1 token.</text>

        {renderClient(30, 100)}
        {renderArrow(150, 145, 245, 145, BLUE)}
        {renderServer(670, 100)}
        {renderArrow(435, 145, 665, 145, GREEN)}

        {/* Bucket shape */}
        <rect x={bucketX} y={bucketY} width={bucketW} height={bucketH} rx="8" fill="#E8E6D8" stroke="#4A6FA5" strokeWidth="2" />
        {/* Capacity line */}
        <line x1={bucketX + 5} y1={bucketY + 10} x2={bucketX + bucketW - 5} y2={bucketY + 10} stroke="#4A6FA5" strokeWidth="1" strokeDasharray="4,2" />
        <text x={bucketX + bucketW + 5} y={bucketY + 14} fill="#4A6FA5" fontSize="7" fontFamily="'Space Mono', monospace">cap={tb.capacity}</text>

        {/* Fill level */}
        <rect
          x={bucketX + 4} y={bucketY + bucketH - fillH - 4}
          width={bucketW - 8} height={fillH}
          rx="4" fill={fillPct > 0.3 ? '#60a5fa' : fillPct > 0 ? AMBER : RED}
          opacity="0.7"
        />

        {/* Token circles */}
        {Array.from({ length: Math.min(Math.floor(tb.tokens), 20) }).map((_, i) => {
          const col = i % 4
          const row = Math.floor(i / 4)
          const cx = bucketX + 30 + col * 40
          const cy = bucketY + bucketH - 20 - row * 25
          return (
            <circle key={i} cx={cx} cy={cy} r={8} fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5" opacity="0.9">
              <animate attributeName="opacity" values="0.9;0.7;0.9" dur="1.5s" begin={`${i * 0.1}s`} repeatCount="indefinite" />
            </circle>
          )
        })}

        {/* Token count */}
        <text x={bucketX + bucketW / 2} y={bucketY + bucketH + 20} textAnchor="middle" fill="#333" fontSize="12" fontFamily="'VT323', monospace">
          {tb.tokens.toFixed(1)} / {tb.capacity} tokens
        </text>

        {/* Refill indicator */}
        <text x={bucketX + bucketW / 2} y={bucketY - 8} textAnchor="middle" fill="#4A6FA5" fontSize="8" fontFamily="'Space Mono', monospace">
          +{tb.refillRate}/tick refill
        </text>
        <text x={bucketX + bucketW / 2} y={bucketY - 20} textAnchor="middle" fill={BLUE} fontSize="7" fontFamily="'Space Mono', monospace">
          ↓ ↓ ↓
        </text>
      </g>
    )
  }

  // --- Sliding Window Log ---
  function renderSlidingWindowLog() {
    const swl = s.slidingWindowLog
    const tlX = 180, tlY = 120, tlW = 500, tlH = 30
    const windowStart = s.tick - swl.windowSize
    const timeRange = swl.windowSize + 5

    return (
      <g>
        <text x={450} y={25} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">SLIDING WINDOW LOG</text>
        <text x={450} y={42} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Store every timestamp. Count requests in sliding window.</text>

        {renderClient(20, 170)}
        {renderServer(740, 170)}

        {/* Timeline */}
        <rect x={tlX} y={tlY} width={tlW} height={tlH} rx="4" fill="#ddd" stroke="#999" strokeWidth="1" />

        {/* Window overlay */}
        {(() => {
          const wxStart = Math.max(0, ((s.tick - swl.windowSize) - (s.tick - timeRange)) / timeRange * tlW)
          const wxEnd = tlW
          return (
            <rect x={tlX + wxStart} y={tlY - 5} width={wxEnd - wxStart} height={tlH + 10} rx="4" fill={BLUE} opacity="0.15" stroke={BLUE} strokeWidth="1.5" strokeDasharray="4,2" />
          )
        })()}

        {/* Timestamp markers */}
        {swl.timestamps.map((t, i) => {
          const relT = (t - (s.tick - timeRange)) / timeRange
          const cx = tlX + relT * tlW
          const inWindow = t > windowStart
          return (
            <g key={i}>
              <circle cx={cx} cy={tlY + tlH / 2} r={5} fill={inWindow ? GREEN : '#aaa'} opacity={inWindow ? 0.9 : 0.3} />
              <text x={cx} y={tlY + tlH + 15} textAnchor="middle" fill={inWindow ? '#333' : '#aaa'} fontSize="7" fontFamily="'VT323', monospace">t{t}</text>
            </g>
          )
        })}

        {/* Labels */}
        <text x={tlX} y={tlY - 10} fill={MUTED} fontSize="8" fontFamily="'Space Mono', monospace">t={Math.max(0, s.tick - timeRange)}</text>
        <text x={tlX + tlW} y={tlY - 10} textAnchor="end" fill="#333" fontSize="8" fontFamily="'Space Mono', monospace">now (t={s.tick})</text>

        {/* Window label */}
        <text x={tlX + tlW / 2} y={tlY - 25} textAnchor="middle" fill={BLUE} fontSize="8" fontFamily="'Space Mono', monospace">
          window = {swl.windowSize} ticks
        </text>

        {/* Count */}
        <text x={450} y={tlY + tlH + 40} textAnchor="middle" fill="#333" fontSize="12" fontFamily="'VT323', monospace">
          Requests in window: {swl.timestamps.filter(t => t > windowStart).length} / {swl.limit}
        </text>

        {/* Memory indicator */}
        <text x={450} y={tlY + tlH + 60} textAnchor="middle" fill={AMBER} fontSize="9" fontFamily="'Space Mono', monospace">
          Memory: {swl.timestamps.length} timestamps stored (O(n))
        </text>

        {renderArrow(140, 215, 175, 135, BLUE)}
        {renderArrow(685, 135, 735, 215, GREEN)}
      </g>
    )
  }

  // --- Fixed Window Counter ---
  function renderFixedWindow() {
    const fw = s.fixedWindow
    const boxW = 110, boxH = 100, gap = 20
    const startX = 200
    const windowY = 90

    // Show previous window + current window
    const prevPct = fw.prevCount / fw.limit
    const currPct = fw.count / fw.limit

    return (
      <g>
        <text x={450} y={25} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">FIXED WINDOW COUNTER</text>
        <text x={450} y={42} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Counter per window. Resets at boundary. Exploitable!</text>

        {renderClient(20, 170)}
        {renderServer(740, 170)}

        {/* Previous window */}
        <rect x={startX} y={windowY} width={boxW} height={boxH} rx="6" fill="#ddd" stroke="#999" strokeWidth="1.5" opacity="0.5" />
        <text x={startX + boxW / 2} y={windowY + 15} textAnchor="middle" fill={MUTED} fontSize="7" fontFamily="'Press Start 2P', monospace">PREV</text>
        <rect x={startX + 10} y={windowY + boxH - 10 - prevPct * 60} width={boxW - 20} height={prevPct * 60} rx="3" fill={MUTED} opacity="0.4" />
        <text x={startX + boxW / 2} y={windowY + 40} textAnchor="middle" fill={MUTED} fontSize="16" fontFamily="'VT323', monospace">
          {fw.prevCount}/{fw.limit}
        </text>

        {/* Current window */}
        <rect x={startX + boxW + gap} y={windowY} width={boxW} height={boxH} rx="6" fill={CREAM_ALT} stroke={fw.count >= fw.limit ? RED : '#4A6FA5'} strokeWidth="2" />
        <text x={startX + boxW + gap + boxW / 2} y={windowY + 15} textAnchor="middle" fill="#4A6FA5" fontSize="7" fontFamily="'Press Start 2P', monospace">CURRENT</text>
        <rect x={startX + boxW + gap + 10} y={windowY + boxH - 10 - currPct * 60} width={boxW - 20} height={Math.min(currPct, 1) * 60} rx="3" fill={fw.count >= fw.limit ? RED : GREEN} opacity="0.6" />
        <text x={startX + boxW + gap + boxW / 2} y={windowY + 40} textAnchor="middle" fill={fw.count >= fw.limit ? RED : '#333'} fontSize="16" fontFamily="'VT323', monospace">
          {fw.count}/{fw.limit}
        </text>

        {/* Next window placeholder */}
        <rect x={startX + 2 * (boxW + gap)} y={windowY} width={boxW} height={boxH} rx="6" fill="#eee" stroke="#ccc" strokeWidth="1" strokeDasharray="4,3" />
        <text x={startX + 2 * (boxW + gap) + boxW / 2} y={windowY + 55} textAnchor="middle" fill="#bbb" fontSize="7" fontFamily="'Press Start 2P', monospace">NEXT</text>

        {/* Boundary danger zone */}
        <rect x={startX + boxW + gap / 2 - 2} y={windowY - 5} width={4} height={boxH + 10} fill={RED} opacity="0.3" rx="2" />
        <text x={startX + boxW + gap / 2} y={windowY - 10} textAnchor="middle" fill={RED} fontSize="7" fontFamily="'Space Mono', monospace">boundary</text>

        {/* Window info */}
        <text x={startX + boxW + gap / 2} y={windowY + boxH + 20} textAnchor="middle" fill="#555" fontSize="9" fontFamily="'Space Mono', monospace">
          Window size: {fw.windowSize} ticks | Tick: {s.tick}
        </text>

        {/* Burst warning */}
        {s.burstTriggered && (
          <g>
            <rect x={startX + 50} y={windowY + boxH + 35} width={300} height={30} rx="6" fill={RED} opacity="0.15" stroke={RED} strokeWidth="1" />
            <text x={startX + 200} y={windowY + boxH + 55} textAnchor="middle" fill={RED} fontSize="9" fontFamily="'Space Mono', monospace" fontWeight="bold">
              THUNDERING HERD: {fw.limit * 2} requests passed in rapid succession!
            </text>
          </g>
        )}

        {renderArrow(140, 215, 195, 140, BLUE)}
        {renderArrow(575, 140, 735, 215, GREEN)}
      </g>
    )
  }

  // --- Sliding Window Counter ---
  function renderSlidingWindowCounter() {
    const swc = s.slidingWindowCounter
    const elapsed = Math.min(1, Math.max(0, (s.tick - swc.windowStart) / swc.windowSize))
    const estimated = swc.prevCount * (1 - elapsed) + swc.count
    const boxW = 140, boxH = 100, gap = 30
    const startX = 180
    const windowY = 80

    return (
      <g>
        <text x={450} y={20} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">SLIDING WINDOW COUNTER</text>
        <text x={450} y={37} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Weighted formula smooths boundary problem</text>

        {renderClient(15, 170)}
        {renderServer(745, 170)}

        {/* Previous window */}
        <rect x={startX} y={windowY} width={boxW} height={boxH} rx="6" fill={CREAM_ALT} stroke={MUTED} strokeWidth="1.5" opacity={0.4 + 0.6 * (1 - elapsed)} />
        <text x={startX + boxW / 2} y={windowY + 15} textAnchor="middle" fill={MUTED} fontSize="7" fontFamily="'Press Start 2P', monospace">PREV WINDOW</text>
        <text x={startX + boxW / 2} y={windowY + 50} textAnchor="middle" fill={MUTED} fontSize="20" fontFamily="'VT323', monospace">{swc.prevCount}</text>
        <text x={startX + boxW / 2} y={windowY + 70} textAnchor="middle" fill={MUTED} fontSize="9" fontFamily="'Space Mono', monospace">
          weight: {(1 - elapsed).toFixed(2)}
        </text>

        {/* Current window */}
        <rect x={startX + boxW + gap} y={windowY} width={boxW} height={boxH} rx="6" fill={CREAM_ALT} stroke="#4A6FA5" strokeWidth="2" />
        <text x={startX + boxW + gap + boxW / 2} y={windowY + 15} textAnchor="middle" fill="#4A6FA5" fontSize="7" fontFamily="'Press Start 2P', monospace">CURR WINDOW</text>
        <text x={startX + boxW + gap + boxW / 2} y={windowY + 50} textAnchor="middle" fill="#333" fontSize="20" fontFamily="'VT323', monospace">{swc.count}</text>
        <text x={startX + boxW + gap + boxW / 2} y={windowY + 70} textAnchor="middle" fill="#4A6FA5" fontSize="9" fontFamily="'Space Mono', monospace">
          weight: 1.0
        </text>

        {/* Elapsed progress bar */}
        <text x={startX + boxW + gap / 2} y={windowY + boxH + 18} textAnchor="middle" fill="#555" fontSize="8" fontFamily="'Space Mono', monospace">
          elapsed: {(elapsed * 100).toFixed(0)}%
        </text>
        <rect x={startX} y={windowY + boxH + 24} width={2 * boxW + gap} height={8} rx="4" fill="#ddd" />
        <rect x={startX} y={windowY + boxH + 24} width={(2 * boxW + gap) * elapsed} height={8} rx="4" fill={BLUE} />

        {/* Formula */}
        <rect x={startX - 10} y={windowY + boxH + 45} width={2 * boxW + gap + 20} height={35} rx="6" fill="#1e293b" opacity="0.9" />
        <text x={startX + boxW + gap / 2} y={windowY + boxH + 58} textAnchor="middle" fill="#facc15" fontSize="9" fontFamily="'VT323', monospace">
          est = {swc.prevCount} x {(1 - elapsed).toFixed(2)} + {swc.count} = {estimated.toFixed(1)}
        </text>
        <text x={startX + boxW + gap / 2} y={windowY + boxH + 73} textAnchor="middle" fill={estimated >= swc.limit ? RED : GREEN} fontSize="9" fontFamily="'VT323', monospace">
          {estimated.toFixed(1)} {estimated >= swc.limit ? '>=' : '<'} {swc.limit} limit → {estimated >= swc.limit ? 'REJECT' : 'ALLOW'}
        </text>

        {renderArrow(135, 215, 175, 130, BLUE)}
        {renderArrow(530, 130, 740, 215, GREEN)}
      </g>
    )
  }

  // --- Leaky Bucket ---
  function renderLeakyBucket() {
    const lb = s.leakyBucket
    const pipeX = 330, pipeY = 55, pipeW = 120, pipeH = 220
    const slotH = Math.min(24, (pipeH - 20) / lb.capacity)

    return (
      <g>
        <text x={450} y={20} textAnchor="middle" fill={CORAL} fontSize="9" fontFamily="'Press Start 2P', monospace">LEAKY BUCKET</text>
        <text x={450} y={37} textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="'Space Mono', monospace">Queue drains at constant rate. Overflow = reject.</text>

        {renderClient(30, 120)}
        {renderServer(670, 120)}

        {/* Pipe/Queue shape */}
        <rect x={pipeX} y={pipeY} width={pipeW} height={pipeH} rx="6" fill={CREAM_ALT} stroke="#4A6FA5" strokeWidth="2" />

        {/* Capacity markers */}
        {Array.from({ length: lb.capacity }).map((_, i) => {
          const sy = pipeY + pipeH - 10 - (i + 1) * slotH
          return (
            <line key={i} x1={pipeX + 5} y1={sy} x2={pipeX + pipeW - 5} y2={sy} stroke="#ccc" strokeWidth="0.5" strokeDasharray="3,3" />
          )
        })}

        {/* Queue items */}
        {lb.queue.map((req, i) => {
          const ry = pipeY + pipeH - 12 - (i + 1) * slotH
          return (
            <g key={req.id}>
              <rect x={pipeX + 8} y={ry} width={pipeW - 16} height={slotH - 2} rx="3" fill={BLUE} opacity="0.7" />
              <text x={pipeX + pipeW / 2} y={ry + slotH / 2 + 3} textAnchor="middle" fill="white" fontSize="7" fontFamily="'VT323', monospace">
                #{req.id}
              </text>
            </g>
          )
        })}

        {/* Entry arrow (top) */}
        <text x={pipeX + pipeW / 2} y={pipeY - 8} textAnchor="middle" fill={BLUE} fontSize="8" fontFamily="'Space Mono', monospace">↓ enqueue</text>

        {/* Drain indicator (bottom) */}
        <text x={pipeX + pipeW / 2} y={pipeY + pipeH + 18} textAnchor="middle" fill={GREEN} fontSize="8" fontFamily="'Space Mono', monospace">
          ↓ drain: {lb.drainRate}/tick
        </text>
        {lb.queue.length > 0 && (
          <circle cx={pipeX + pipeW / 2} cy={pipeY + pipeH + 30} r={4} fill={GREEN}>
            <animate attributeName="cy" values={`${pipeY + pipeH + 25};${pipeY + pipeH + 40}`} dur="0.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="0.5s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Queue status */}
        <text x={pipeX + pipeW / 2} y={pipeY + pipeH + 50} textAnchor="middle" fill="#333" fontSize="11" fontFamily="'VT323', monospace">
          Queue: {lb.queue.length} / {lb.capacity}
        </text>

        {/* Fullness bar */}
        <rect x={pipeX} y={pipeY + pipeH + 56} width={pipeW} height={8} rx="4" fill="#ddd" />
        <rect x={pipeX} y={pipeY + pipeH + 56} width={pipeW * lb.queue.length / lb.capacity} height={8} rx="4"
          fill={lb.queue.length >= lb.capacity ? RED : lb.queue.length >= lb.capacity * 0.7 ? AMBER : GREEN} />

        {renderArrow(150, 165, 325, 100, BLUE)}
        {renderArrow(455, 180, 665, 165, GREEN)}

        {/* Overflow indicator */}
        {lb.queue.length >= lb.capacity && (
          <text x={pipeX + pipeW + 15} y={pipeY + 30} fill={RED} fontSize="8" fontFamily="'Space Mono', monospace" fontWeight="bold">
            FULL!
          </text>
        )}
      </g>
    )
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  function renderVisualization() {
    if (algo === 'none') return renderBase()
    if (algo === 'token-bucket') return renderTokenBucket()
    if (algo === 'sliding-window-log') return renderSlidingWindowLog()
    if (algo === 'fixed-window') return renderFixedWindow()
    if (algo === 'sliding-window-counter') return renderSlidingWindowCounter()
    if (algo === 'leaky-bucket') return renderLeakyBucket()
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* SVG Canvas */}
      <div className="flex-1 relative overflow-hidden" style={{ background: CREAM }}>
        <svg viewBox="0 0 900 340" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <rect width="900" height="340" fill={CREAM} />
          {renderVisualization()}
        </svg>
      </div>

      {/* Event Log */}
      <div style={{ background: '#1e293b', borderTop: '2px solid #334155', height: '80px', overflowY: 'auto', padding: '4px 10px' }}>
        {s.recentEvents.slice(0, 6).map(ev => (
          <div key={ev.id} style={{ color: ev.color, fontSize: '11px', fontFamily: "'VT323', monospace", lineHeight: '13px' }}>
            {ev.text}
          </div>
        ))}
        {s.recentEvents.length === 0 && (
          <div style={{ color: MUTED, fontSize: '11px', fontFamily: "'VT323', monospace" }}>
            {algo === 'none' ? 'Send requests to see server degrade...' : `${algo} ready — send requests to test`}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2" style={{ background: CREAM_ALT, borderTop: `1px solid #B0B09A`, minHeight: '48px' }}>
        <button
          className="retro-btn text-xs px-3 py-1"
          onClick={() => dispatch({ type: 'send-request' })}
          disabled={algo === 'none' && !s.server.alive}
        >
          SEND
        </button>
        <button
          className={`retro-btn text-xs px-3 py-1 ${autoSending ? 'retro-btn--accent' : ''}`}
          onClick={toggleAuto}
          disabled={algo === 'none' && !s.server.alive}
        >
          {autoSending ? 'STOP' : 'AUTO'}
        </button>
        <button
          className="retro-btn text-xs px-3 py-1"
          onClick={() => { stopAll(); dispatch({ type: 'init', mode: fixModeIndex }) }}
        >
          RESET
        </button>

        {/* Algorithm-specific controls */}
        {algo === 'token-bucket' && (
          <>
            <span className="text-xs font-mono" style={{ color: MUTED }}>cap:</span>
            <input type="range" min="1" max="20" value={s.tokenBucket.capacity}
              onChange={e => dispatch({ type: 'set-capacity', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.tokenBucket.capacity}</span>
            <span className="text-xs font-mono" style={{ color: MUTED }}>refill:</span>
            <input type="range" min="1" max="5" step="0.5" value={s.tokenBucket.refillRate}
              onChange={e => dispatch({ type: 'set-refill-rate', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.tokenBucket.refillRate}/t</span>
          </>
        )}

        {algo === 'sliding-window-log' && (
          <>
            <span className="text-xs font-mono" style={{ color: MUTED }}>window:</span>
            <input type="range" min="5" max="20" value={s.slidingWindowLog.windowSize}
              onChange={e => dispatch({ type: 'set-window-size', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.slidingWindowLog.windowSize}</span>
            <span className="text-xs font-mono" style={{ color: MUTED }}>limit:</span>
            <input type="range" min="1" max="10" value={s.slidingWindowLog.limit}
              onChange={e => dispatch({ type: 'set-limit', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.slidingWindowLog.limit}</span>
          </>
        )}

        {algo === 'fixed-window' && (
          <>
            <span className="text-xs font-mono" style={{ color: MUTED }}>window:</span>
            <input type="range" min="5" max="20" value={s.fixedWindow.windowSize}
              onChange={e => dispatch({ type: 'set-window-size', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.fixedWindow.windowSize}</span>
            <span className="text-xs font-mono" style={{ color: MUTED }}>limit:</span>
            <input type="range" min="1" max="10" value={s.fixedWindow.limit}
              onChange={e => dispatch({ type: 'set-limit', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.fixedWindow.limit}</span>
            <button className="retro-btn retro-btn--accent text-xs px-3 py-1" onClick={() => dispatch({ type: 'trigger-burst' })}>
              TRIGGER BURST
            </button>
          </>
        )}

        {algo === 'sliding-window-counter' && (
          <>
            <span className="text-xs font-mono" style={{ color: MUTED }}>window:</span>
            <input type="range" min="5" max="20" value={s.slidingWindowCounter.windowSize}
              onChange={e => dispatch({ type: 'set-window-size', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.slidingWindowCounter.windowSize}</span>
            <span className="text-xs font-mono" style={{ color: MUTED }}>limit:</span>
            <input type="range" min="1" max="10" value={s.slidingWindowCounter.limit}
              onChange={e => dispatch({ type: 'set-limit', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.slidingWindowCounter.limit}</span>
          </>
        )}

        {algo === 'leaky-bucket' && (
          <>
            <span className="text-xs font-mono" style={{ color: MUTED }}>queue cap:</span>
            <input type="range" min="1" max="15" value={s.leakyBucket.capacity}
              onChange={e => dispatch({ type: 'set-capacity', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.leakyBucket.capacity}</span>
            <span className="text-xs font-mono" style={{ color: MUTED }}>drain:</span>
            <input type="range" min="1" max="5" value={s.leakyBucket.drainRate}
              onChange={e => dispatch({ type: 'set-drain-rate', value: +e.target.value })}
              className="w-16 h-1" />
            <span className="text-xs font-mono" style={{ color: '#333' }}>{s.leakyBucket.drainRate}/t</span>
          </>
        )}
      </div>
    </div>
  )
}
