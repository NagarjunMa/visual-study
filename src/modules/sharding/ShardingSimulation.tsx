import { useReducer, useEffect, useRef, useState, useCallback } from 'react'
import { LearningModuleShell, type LearningTraceStep } from '../../components/LearningModuleShell'
import type { Stage } from '../../simulation/types'
import type { ShardingState, QueryInFlight, Bucket } from './sharding.types'
import {
  createInitialShardingState, shardingSetMode, shardingTick,
  insertKey, insertNextKey, pointQuery, rangeQuery,
  killLeftServer, reviveLeftServer, killShard, reviveShard,
  startTxn,
  setScaleLoad, toggleScaleRamp, resetScale,
  leftCpuPct, leftLatencyMs, leftErrorPct, rightShardCpuPct, rightShardLatencyMs,
  LEFT_DISK_CAP_BYTES, SCALE_MAX_RPS, SHARD_COUNT,
  KEY_SET, PARTITION_COLORS, PARTITION_LABELS, SHARD_LABELS,
  VIEW_W, VIEW_H, DIVIDER_X,
  LEFT_PARTITION_X, LEFT_SERVER_BOX,
  RIGHT_SHARD_X,
} from './ShardingEngine'

const V_MID = 264

interface Props { stage?: Stage; fixModeIndex?: number }

type Action =
  | { type: 'init'; mode: number }
  | { type: 'tick' }
  | { type: 'insert'; key: number }
  | { type: 'insert-next' }
  | { type: 'point-query'; key: number }
  | { type: 'range-query'; lo: number; hi: number }
  | { type: 'kill-left' }
  | { type: 'revive-left' }
  | { type: 'kill-shard'; id: number }
  | { type: 'revive-shard'; id: number }
  | { type: 'start-txn'; keyA: number; keyB: number }
  | { type: 'set-scale-load'; rps: number }
  | { type: 'toggle-scale-ramp' }
  | { type: 'reset-scale' }

function reducer(state: ShardingState, action: Action): ShardingState {
  switch (action.type) {
    case 'init': return shardingSetMode(state, action.mode)
    case 'tick': return shardingTick(state)
    case 'insert': return insertKey(state, action.key)
    case 'insert-next': return insertNextKey(state)
    case 'point-query': return pointQuery(state, action.key)
    case 'range-query': return rangeQuery(state, action.lo, action.hi)
    case 'kill-left': return killLeftServer(state)
    case 'revive-left': return reviveLeftServer(state)
    case 'kill-shard': return killShard(state, action.id)
    case 'revive-shard': return reviveShard(state, action.id)
    case 'start-txn': return startTxn(state, action.keyA, action.keyB)
    case 'set-scale-load': return setScaleLoad(state, action.rps)
    case 'toggle-scale-ramp': return toggleScaleRamp(state)
    case 'reset-scale': return resetScale(state)
    default: return state
  }
}

const TICK_MS = 80
const TXN_KEY_A = 42   // bucket 2
const TXN_KEY_B = 113  // bucket 1

export function ShardingSimulation({ fixModeIndex = -1 }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialShardingState(fixModeIndex))
  const [autoInsert, setAutoInsert] = useState(false)
  const [pointKey, setPointKey] = useState<number>(42)
  const [rangeLo, setRangeLo] = useState<number>(10)
  const [rangeHi, setRangeHi] = useState<number>(500)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const insertRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset on mode change
  useEffect(() => {
    setAutoInsert(false)
    if (insertRef.current) { clearInterval(insertRef.current); insertRef.current = null }
    dispatch({ type: 'init', mode: fixModeIndex })
  }, [fixModeIndex])

  // Tick loop
  useEffect(() => {
    tickRef.current = setInterval(() => dispatch({ type: 'tick' }), TICK_MS)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  // Auto-insert loop (mode 0)
  useEffect(() => {
    if (autoInsert && fixModeIndex === 0) {
      insertRef.current = setInterval(() => dispatch({ type: 'insert-next' }), 900)
      return () => { if (insertRef.current) { clearInterval(insertRef.current); insertRef.current = null } }
    }
  }, [autoInsert, fixModeIndex])

  // Stop auto-insert when key set exhausted
  useEffect(() => {
    if (state.insertCursor >= KEY_SET.length && autoInsert) {
      setAutoInsert(false)
      if (insertRef.current) { clearInterval(insertRef.current); insertRef.current = null }
    }
  }, [state.insertCursor, autoInsert])

  const stopAutoInsert = useCallback(() => {
    setAutoInsert(false)
    if (insertRef.current) { clearInterval(insertRef.current); insertRef.current = null }
  }, [])

  // ─── Particle interpolation ──────────────────────────────────────────────

  function particlePos(q: QueryInFlight, tick: number): { x: number; y: number; prog: number } {
    const elapsed = tick - q.startTick
    const prog = Math.max(0, Math.min(1, elapsed / q.durationTicks))
    // Failed particles stall at 40%
    const p = q.status === 'failed' ? Math.min(prog, 0.4) : prog
    return {
      x: q.fromX + (q.toX - q.fromX) * p,
      y: q.fromY + (q.toY - q.fromY) * p,
      prog: p,
    }
  }

  // ─── LEFT (Partitioning) ─────────────────────────────────────────────────

  function renderLeft() {
    const alive = state.leftServerAlive
    const sb = LEFT_SERVER_BOX
    return (
      <g>
        {/* Half label */}
        <text x={350} y={36} fill="#4A6FA5" fontSize={11} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
          PARTITIONING
        </text>
        <text x={350} y={52} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle">
          one server · one disk · one failure domain
        </text>

        {/* Client */}
        <rect x={290} y={72} width={160} height={36} rx={4} fill="#D0CEBA" stroke="#7A7A6E" strokeWidth={1.5} />
        <text x={370} y={94} fill="#2A2A28" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">CLIENT</text>

        {/* Planner */}
        <line x1={370} y1={108} x2={370} y2={130} stroke="#7A7A6E" strokeWidth={1.5} />
        <polygon points={`370,130 366,124 374,124`} fill="#7A7A6E" />
        <rect x={250} y={130} width={240} height={50} rx={4} fill="#D0CEBA" stroke="#4A6FA5" strokeWidth={2} />
        <rect x={250} y={130} width={240} height={16} rx={4} fill="#4A6FA5" opacity={0.18} />
        <text x={370} y={143} fill="#4A6FA5" fontSize={8} fontFamily="'Press Start 2P', monospace" textAnchor="middle">QUERY PLANNER</text>
        <text x={370} y={166} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle">in-process · ~µs</text>

        {/* Server box */}
        <rect x={sb.x} y={sb.y} width={sb.w} height={sb.h} rx={6}
          fill="#E8E6D8" stroke={alive ? '#4A6FA5' : '#ef4444'} strokeWidth={2.5}
          strokeDasharray={alive ? 'none' : '8 5'}
          opacity={alive ? 1 : 0.55} />
        <rect x={sb.x} y={sb.y} width={sb.w} height={24} rx={6} fill={alive ? '#4A6FA5' : '#ef4444'} opacity={0.18} />
        <text x={sb.x + 14} y={sb.y + 17} fill={alive ? '#4A6FA5' : '#ef4444'} fontSize={8} fontFamily="'Press Start 2P', monospace">
          POSTGRESQL · 1 PROCESS
        </text>
        <text x={sb.x + sb.w - 12} y={sb.y + 17} fill="#7A7A6E" fontSize={8} fontFamily="'Space Mono', monospace" textAnchor="end">
          PARTITION BY HASH(id) MOD 4
        </text>

        {/* 4 partition slots */}
        {[0, 1, 2, 3].map(i => {
          const px = LEFT_PARTITION_X[i] - 70
          const color = PARTITION_COLORS[i]
          const rows = state.leftPartitions[i].rows
          return (
            <g key={i} opacity={alive ? 1 : 0.4}>
              <rect x={px} y={270} width={140} height={220} rx={4} fill="#F0F0E8" stroke={color} strokeWidth={1.5} />
              <rect x={px} y={270} width={140} height={20} rx={4} fill={color} opacity={0.18} />
              <text x={px + 70} y={284} fill={color} fontSize={8} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
                {PARTITION_LABELS[i]}
              </text>
              <text x={px + 70} y={304} fill="#7A7A6E" fontSize={7} fontFamily="'Space Mono', monospace" textAnchor="middle">
                {rows.length} rows
              </text>
              {rows.slice(0, 10).map((r, ri) => (
                <text key={r.id} x={px + 70} y={322 + ri * 14} fill="#2A2A28" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle">
                  {r.id}
                </text>
              ))}
            </g>
          )
        })}

        {/* Dead overlay */}
        {!alive && (
          <g>
            <line x1={sb.x + 80} y1={sb.y + 60} x2={sb.x + sb.w - 80} y2={sb.y + sb.h - 60}
              stroke="#ef4444" strokeWidth={6} strokeLinecap="round" />
            <line x1={sb.x + sb.w - 80} y1={sb.y + 60} x2={sb.x + 80} y2={sb.y + sb.h - 60}
              stroke="#ef4444" strokeWidth={6} strokeLinecap="round" />
            <rect x={sb.x + sb.w / 2 - 90} y={sb.y + sb.h / 2 - 18} width={180} height={36} rx={4} fill="#ef4444" />
            <text x={sb.x + sb.w / 2} y={sb.y + sb.h / 2 + 6} fill="#fff" fontSize={11}
              fontFamily="'Press Start 2P', monospace" textAnchor="middle">DB DOWN</text>
          </g>
        )}
      </g>
    )
  }

  // ─── RIGHT (Sharding) ────────────────────────────────────────────────────

  function renderRight() {
    return (
      <g>
        {/* Half label */}
        <text x={1050} y={36} fill="#D4654A" fontSize={11} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
          SHARDING
        </text>
        <text x={1050} y={52} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle">
          N processes · N disks · N failure domains
        </text>

        {/* Client */}
        <rect x={970} y={72} width={160} height={36} rx={4} fill="#D0CEBA" stroke="#7A7A6E" strokeWidth={1.5} />
        <text x={1050} y={94} fill="#2A2A28" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">CLIENT</text>

        {/* Router */}
        <line x1={1050} y1={108} x2={1050} y2={130} stroke="#7A7A6E" strokeWidth={1.5} />
        <polygon points={`1050,130 1046,124 1054,124`} fill="#7A7A6E" />
        <rect x={930} y={130} width={240} height={50} rx={4} fill="#D0CEBA" stroke="#D4654A" strokeWidth={2} />
        <rect x={930} y={130} width={240} height={16} rx={4} fill="#D4654A" opacity={0.18} />
        <text x={1050} y={143} fill="#D4654A" fontSize={8} fontFamily="'Press Start 2P', monospace" textAnchor="middle">SHARD ROUTER</text>
        <text x={1050} y={166} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle">
          external · network hop ~ms
        </text>

        {/* Network band label */}
        <text x={1050} y={222} fill="#7A7A6E" fontSize={7} fontFamily="'Press Start 2P', monospace" textAnchor="middle" letterSpacing="2">
          NETWORK
        </text>
        <line x1={745} y1={232} x2={1355} y2={232} stroke="#B0B09A" strokeDasharray="3 3" strokeWidth={1} />
        <line x1={745} y1={262} x2={1355} y2={262} stroke="#B0B09A" strokeDasharray="3 3" strokeWidth={1} />

        {/* Network lines from router to each shard */}
        {[0, 1, 2, 3].map(i => (
          <line key={`net-${i}`} x1={1050} y1={180} x2={RIGHT_SHARD_X[i]} y2={270}
            stroke="#9A9A82" strokeWidth={1.2} strokeDasharray="4 3" />
        ))}

        {/* 4 independent shards */}
        {[0, 1, 2, 3].map(i => {
          const sx = RIGHT_SHARD_X[i] - 70
          const color = PARTITION_COLORS[i]
          const shard = state.rightShards[i]
          const alive = shard.alive
          return (
            <g key={i} opacity={alive ? 1 : 0.45}>
              <rect x={sx} y={270} width={140} height={220} rx={4}
                fill="#E8E6D8" stroke={alive ? color : '#ef4444'} strokeWidth={2}
                strokeDasharray={alive ? 'none' : '6 4'} />
              <rect x={sx} y={270} width={140} height={20} rx={4} fill={alive ? color : '#ef4444'} opacity={0.18} />
              <text x={sx + 70} y={284} fill={alive ? color : '#ef4444'} fontSize={8} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
                {SHARD_LABELS[i]}
              </text>
              <text x={sx + 70} y={304} fill="#7A7A6E" fontSize={7} fontFamily="'Space Mono', monospace" textAnchor="middle">
                {shard.rows.length} rows
              </text>
              {shard.rows.slice(0, 10).map((r, ri) => (
                <text key={r.id} x={sx + 70} y={322 + ri * 14} fill="#2A2A28" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle">
                  {r.id}
                </text>
              ))}
              {!alive && (
                <g>
                  <line x1={sx + 30} y1={310} x2={sx + 110} y2={470}
                    stroke="#ef4444" strokeWidth={4} strokeLinecap="round" />
                  <line x1={sx + 110} y1={310} x2={sx + 30} y2={470}
                    stroke="#ef4444" strokeWidth={4} strokeLinecap="round" />
                  <rect x={sx + 20} y={420} width={100} height={24} rx={3} fill="#ef4444" />
                  <text x={sx + 70} y={437} fill="#fff" fontSize={9}
                    fontFamily="'Press Start 2P', monospace" textAnchor="middle">DOWN</text>
                </g>
              )}
            </g>
          )
        })}
      </g>
    )
  }

  // ─── Particles ───────────────────────────────────────────────────────────

  function renderParticles() {
    return (
      <g>
        {state.inFlight.map(q => {
          const pos = particlePos(q, state.tick)
          const color = q.color ?? (q.side === 'left' ? '#4A6FA5' : '#D4654A')
          const isFailed = q.status === 'failed'
          const isTxn = q.kind.startsWith('txn')
          return (
            <g key={q.id}>
              <circle cx={pos.x} cy={pos.y} r={isTxn ? 7 : 6}
                fill={color} stroke="#2A2A28" strokeWidth={1} opacity={0.92} />
              {isFailed && (
                <text x={pos.x} y={pos.y + 3} fill="#fff" fontSize={9}
                  fontFamily="'Press Start 2P', monospace" textAnchor="middle">X</text>
              )}
              {q.kind === 'write' && q.key !== undefined && !isFailed && (
                <text x={pos.x} y={pos.y - 10} fill="#2A2A28" fontSize={8}
                  fontFamily="'Space Mono', monospace" textAnchor="middle">{q.key}</text>
              )}
              {isTxn && (
                <text x={pos.x} y={pos.y - 12} fill={color} fontSize={7}
                  fontFamily="'Press Start 2P', monospace" textAnchor="middle">
                  {q.kind === 'txn-prepare' ? 'PREP' :
                   q.kind === 'txn-vote' ? 'VOTE' :
                   q.kind === 'txn-commit' ? 'COMMIT' : 'ACK'}
                </text>
              )}
            </g>
          )
        })}
      </g>
    )
  }

  // ─── Metrics + log ───────────────────────────────────────────────────────

  function renderMetricsBar() {
    const lm = state.metrics.left
    const rm = state.metrics.right
    const bytesStr = (n: number) => n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}KB`
    return (
      <g>
        {/* LEFT metrics */}
        <rect x={20} y={510} width={660} height={92} rx={4} fill="#D0CEBA" stroke="#B0B09A" strokeWidth={1} />
        <text x={32} y={526} fill="#4A6FA5" fontSize={7} fontFamily="'Press Start 2P', monospace">LEFT METRICS</text>
        <text x={32} y={548} fill="#7A7A6E" fontSize={10} fontFamily="'Space Mono', monospace">
          writes: {lm.writes}   reads: {lm.reads}   ok: {lm.ok}   fail: <tspan fill={lm.failed > 0 ? '#ef4444' : '#7A7A6E'}>{lm.failed}</tspan>
        </text>
        <text x={32} y={566} fill="#7A7A6E" fontSize={10} fontFamily="'Space Mono', monospace">
          network RTTs: <tspan fontWeight="bold" fill="#4CAF50">0</tspan>   bytes over net: <tspan fontWeight="bold" fill="#4CAF50">0B</tspan>
        </text>
        <text x={32} y={584} fill="#7A7A6E" fontSize={10} fontFamily="'Space Mono', monospace">
          last latency: {lm.lastLatencyMs.toFixed(1)} ms
        </text>
        <text x={32} y={597} fill="#4A6FA5" fontSize={8} fontFamily="'Space Mono', monospace" fontStyle="italic">
          {state.leftServerAlive ? '● ONLINE' : '● OFFLINE — all 4 partitions unreachable'}
        </text>

        {/* RIGHT metrics */}
        <rect x={720} y={510} width={660} height={92} rx={4} fill="#D0CEBA" stroke="#B0B09A" strokeWidth={1} />
        <text x={732} y={526} fill="#D4654A" fontSize={7} fontFamily="'Press Start 2P', monospace">RIGHT METRICS</text>
        <text x={732} y={548} fill="#7A7A6E" fontSize={10} fontFamily="'Space Mono', monospace">
          writes: {rm.writes}   reads: {rm.reads}   ok: {rm.ok}   fail: <tspan fill={rm.failed > 0 ? '#ef4444' : '#7A7A6E'}>{rm.failed}</tspan>
        </text>
        <text x={732} y={566} fill="#7A7A6E" fontSize={10} fontFamily="'Space Mono', monospace">
          network RTTs: <tspan fontWeight="bold" fill="#D4654A">{rm.rtts}</tspan>   bytes over net: <tspan fontWeight="bold" fill="#D4654A">{bytesStr(rm.bytesNetwork)}</tspan>
        </text>
        <text x={732} y={584} fill="#7A7A6E" fontSize={10} fontFamily="'Space Mono', monospace">
          last latency: {rm.lastLatencyMs.toFixed(1)} ms
        </text>
        <text x={732} y={597} fill="#D4654A" fontSize={8} fontFamily="'Space Mono', monospace" fontStyle="italic">
          {state.rightShards.filter(s => s.alive).length}/4 shards online
        </text>
      </g>
    )
  }

  // ─── 2PC log overlay (mode 4) ────────────────────────────────────────────

  function renderTxnLog() {
    if (fixModeIndex !== 4 || !state.txn) return null
    const lines = state.txn.log.slice(-9)
    const phaseColor = state.txn.phase === 'done' ? '#4CAF50' : state.txn.phase === 'abort' ? '#ef4444' : '#d97706'
    return (
      <g>
        <rect x={720} y={510} width={660} height={92} rx={4} fill="#2A2A28" stroke={phaseColor} strokeWidth={2} />
        <text x={732} y={526} fill={phaseColor} fontSize={7} fontFamily="'Press Start 2P', monospace">
          2PC LOG · PHASE: {state.txn.phase.toUpperCase()}
        </text>
        {lines.map((line, i) => (
          <text key={i} x={732} y={540 + i * 10} fill={i === lines.length - 1 ? '#fff' : '#A0A096'}
            fontSize={8} fontFamily="'Space Mono', monospace">
            {line.length > 86 ? line.slice(0, 86) + '…' : line}
          </text>
        ))}
      </g>
    )
  }

  // ─── Mode 5: Scale Wall ──────────────────────────────────────────────────

  function renderScaleWall() {
    const rps = state.scaleLoadRps
    const storageBytes = state.scaleStorageBytes
    const leftDiskPct = Math.min(100, (storageBytes / LEFT_DISK_CAP_BYTES) * 100)
    const rightDiskPctPerShard = Math.min(100, leftDiskPct / SHARD_COUNT)
    const lcpu = leftCpuPct(rps)
    const llat = leftLatencyMs(rps, leftDiskPct)
    const lerr = leftErrorPct(rps, leftDiskPct)
    const rcpu = rightShardCpuPct(rps)
    const rlat = rightShardLatencyMs(rps)
    const atWall = lcpu >= 99 || leftDiskPct >= 99

    const leftStatus =
      leftDiskPct >= 100 ? { txt: 'DISK FULL', color: '#ef4444' } :
      lcpu >= 99 ? { txt: 'THRASHING', color: '#ef4444' } :
      lcpu >= 85 ? { txt: 'OVERLOADED', color: '#d97706' } :
      lcpu >= 60 ? { txt: 'STRESSED', color: '#d97706' } :
      { txt: 'HEALTHY', color: '#4CAF50' }

    const tbStr = (pct: number) => `${(pct / 100).toFixed(2)} TB / 1 TB`

    function bar(x: number, y: number, w: number, h: number, pct: number, fillColor: string) {
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={3} fill="#F0F0E8" stroke="#7A7A6E" strokeWidth={1} />
          <rect x={x + 1} y={y + 1} width={(w - 2) * (pct / 100)} height={h - 2} rx={2} fill={fillColor} />
          <text x={x + w + 8} y={y + h - 3} fill="#2A2A28" fontSize={11} fontFamily="'Space Mono', monospace" fontWeight="bold">
            {pct.toFixed(0)}%
          </text>
        </g>
      )
    }

    const cpuColor = (pct: number) =>
      pct >= 90 ? '#ef4444' : pct >= 75 ? '#d97706' : pct >= 50 ? '#C4A55A' : '#4CAF50'

    return (
      <g>
        {/* ─── LEFT: one server ─────────────────────────────────────── */}
        <text x={350} y={36} fill="#4A6FA5" fontSize={11} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
          PARTITIONING · 1 SERVER
        </text>
        <text x={350} y={52} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle">
          one process · one disk · one CPU envelope
        </text>

        <rect x={40} y={70} width={640} height={420} rx={6}
          fill="#E8E6D8" stroke={atWall ? '#ef4444' : '#4A6FA5'} strokeWidth={atWall ? 3 : 2}
          strokeDasharray={atWall ? '8 5' : 'none'} />
        <rect x={40} y={70} width={640} height={24} rx={6} fill={atWall ? '#ef4444' : '#4A6FA5'} opacity={0.18} />
        <text x={54} y={87} fill={atWall ? '#ef4444' : '#4A6FA5'} fontSize={8} fontFamily="'Press Start 2P', monospace">
          POSTGRESQL · one big box
        </text>
        <text x={668} y={87} fill="#7A7A6E" fontSize={8} fontFamily="'Space Mono', monospace" textAnchor="end">
          vertical scale only
        </text>

        {/* CPU */}
        <text x={60} y={130} fill="#2A2A28" fontSize={10} fontFamily="'Space Mono', monospace" fontWeight="bold">CPU</text>
        {bar(110, 115, 480, 22, lcpu, cpuColor(lcpu))}

        {/* Disk */}
        <text x={60} y={172} fill="#2A2A28" fontSize={10} fontFamily="'Space Mono', monospace" fontWeight="bold">DISK</text>
        {bar(110, 157, 480, 22, leftDiskPct, cpuColor(leftDiskPct))}
        <text x={110} y={194} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace">
          {tbStr(leftDiskPct)}
        </text>

        {/* Latency */}
        <text x={60} y={235} fill="#2A2A28" fontSize={10} fontFamily="'Space Mono', monospace" fontWeight="bold">LATENCY</text>
        <text x={110} y={245} fill={llat > 100 ? '#ef4444' : llat > 20 ? '#d97706' : '#4CAF50'}
          fontSize={28} fontFamily="'Space Mono', monospace" fontWeight="bold">
          {llat >= 9999 ? '∞' : llat < 100 ? llat.toFixed(1) + ' ms' : llat.toFixed(0) + ' ms'}
        </text>

        {/* Errors */}
        <text x={60} y={295} fill="#2A2A28" fontSize={10} fontFamily="'Space Mono', monospace" fontWeight="bold">ERRORS</text>
        <text x={110} y={305} fill={lerr > 0 ? '#ef4444' : '#4CAF50'}
          fontSize={20} fontFamily="'Space Mono', monospace" fontWeight="bold">
          {lerr.toFixed(0)}%
        </text>

        {/* Status badge */}
        <rect x={60} y={345} width={580} height={36} rx={4} fill={leftStatus.color} opacity={0.18} stroke={leftStatus.color} strokeWidth={1.5} />
        <text x={350} y={369} fill={leftStatus.color} fontSize={13} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
          {leftStatus.txt}
        </text>

        {/* Throughput / capacity reads */}
        <text x={60} y={410} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace">
          throughput cap: 100K rps @ 100% CPU
        </text>
        <text x={60} y={426} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace">
          disk cap: 1 TB (one machine)
        </text>
        <text x={60} y={442} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace">
          to scale: buy a bigger box — eventually no bigger box exists
        </text>

        {atWall && (
          <g>
            <rect x={70} y={460} width={580} height={24} rx={3} fill="#ef4444" />
            <text x={360} y={477} fill="#fff" fontSize={10} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
              AT WALL — cannot scale further
            </text>
          </g>
        )}

        {/* ─── RIGHT: N shards ─────────────────────────────────────── */}
        <text x={1050} y={36} fill="#D4654A" fontSize={11} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
          SHARDING · {SHARD_COUNT} SHARDS
        </text>
        <text x={1050} y={52} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle">
          load split N ways · capacity = N × one box
        </text>

        {/* Aggregate banner */}
        <rect x={730} y={70} width={640} height={32} rx={4} fill="#4CAF50" opacity={0.15} stroke="#4CAF50" strokeWidth={1.5} />
        <text x={1050} y={91} fill="#4CAF50" fontSize={10} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
          {rcpu < 75 ? 'ALL SHARDS HEALTHY' : rcpu < 95 ? 'SHARDS WARMING' : 'ADD MORE SHARDS'}
        </text>

        {/* 4 shard cards */}
        {[0, 1, 2, 3].map(i => {
          const sx = 740 + i * 160
          const color = PARTITION_COLORS[i]
          return (
            <g key={i}>
              <rect x={sx} y={115} width={140} height={300} rx={4} fill="#F0F0E8" stroke={color} strokeWidth={2} />
              <rect x={sx} y={115} width={140} height={20} rx={4} fill={color} opacity={0.18} />
              <text x={sx + 70} y={129} fill={color} fontSize={8} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
                {SHARD_LABELS[i]}
              </text>

              {/* CPU mini-bar */}
              <text x={sx + 10} y={156} fill="#7A7A6E" fontSize={8} fontFamily="'Space Mono', monospace">CPU</text>
              <rect x={sx + 10} y={160} width={120} height={14} rx={2} fill="#E8E6D8" stroke="#B0B09A" strokeWidth={0.5} />
              <rect x={sx + 11} y={161} width={118 * rcpu / 100} height={12} rx={1} fill={cpuColor(rcpu)} />
              <text x={sx + 70} y={172} fill="#2A2A28" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">
                {rcpu.toFixed(0)}%
              </text>

              {/* Disk mini-bar */}
              <text x={sx + 10} y={194} fill="#7A7A6E" fontSize={8} fontFamily="'Space Mono', monospace">DISK</text>
              <rect x={sx + 10} y={198} width={120} height={14} rx={2} fill="#E8E6D8" stroke="#B0B09A" strokeWidth={0.5} />
              <rect x={sx + 11} y={199} width={118 * rightDiskPctPerShard / 100} height={12} rx={1} fill={cpuColor(rightDiskPctPerShard)} />
              <text x={sx + 70} y={210} fill="#2A2A28" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">
                {rightDiskPctPerShard.toFixed(0)}%
              </text>

              {/* Latency */}
              <text x={sx + 70} y={245} fill="#7A7A6E" fontSize={7} fontFamily="'Press Start 2P', monospace" textAnchor="middle">LAT</text>
              <text x={sx + 70} y={268} fill="#4CAF50" fontSize={16} fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">
                {rlat.toFixed(1)} ms
              </text>

              {/* Status */}
              <rect x={sx + 10} y={290} width={120} height={22} rx={3} fill="#4CAF50" opacity={0.15} stroke="#4CAF50" strokeWidth={1} />
              <text x={sx + 70} y={306} fill="#4CAF50" fontSize={8} fontFamily="'Press Start 2P', monospace" textAnchor="middle">HEALTHY</text>

              {/* Slot for "share of load" */}
              <text x={sx + 70} y={335} fill="#7A7A6E" fontSize={8} fontFamily="'Space Mono', monospace" textAnchor="middle">
                {(rps / SHARD_COUNT / 1000).toFixed(1)}K rps
              </text>
              <text x={sx + 70} y={350} fill="#7A7A6E" fontSize={8} fontFamily="'Space Mono', monospace" textAnchor="middle">
                {tbStr(rightDiskPctPerShard).replace(' TB / 1 TB', ' TB')}
              </text>
            </g>
          )
        })}

        {/* RIGHT capacity reads */}
        <text x={740} y={440} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace">
          aggregate throughput cap: {(SHARD_COUNT * 100).toFixed(0)}K rps  ({SHARD_COUNT}× one box)
        </text>
        <text x={740} y={456} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace">
          aggregate disk: {SHARD_COUNT} TB  ({SHARD_COUNT}× one box)
        </text>
        <text x={740} y={472} fill="#7A7A6E" fontSize={9} fontFamily="'Space Mono', monospace">
          to scale further: add another shard (horizontal) — no ceiling
        </text>

        {/* ─── Bottom verdict bar ─────────────────────────────────── */}
        <rect x={20} y={510} width={1360} height={92} rx={4} fill="#D0CEBA" stroke="#B0B09A" strokeWidth={1} />
        <text x={32} y={530} fill="#2A2A28" fontSize={9} fontFamily="'Press Start 2P', monospace">
          SCALE WALL · same load offered to both
        </text>
        <text x={32} y={552} fill="#7A7A6E" fontSize={11} fontFamily="'Space Mono', monospace">
          load offered: <tspan fontWeight="bold" fill="#2A2A28">{(rps / 1000).toFixed(0)}K rps</tspan>   ·   ramp: {state.scaleRamping ? <tspan fill="#4CAF50" fontWeight="bold">ON</tspan> : <tspan fill="#7A7A6E">off</tspan>}   ·   ticks under load: {state.scaleTicks}
        </text>
        <text x={32} y={572} fill="#4A6FA5" fontSize={10} fontFamily="'Space Mono', monospace">
          LEFT: CPU {lcpu.toFixed(0)}%  ·  DISK {leftDiskPct.toFixed(0)}%  ·  LAT {llat >= 9999 ? '∞' : llat.toFixed(0) + ' ms'}  ·  ERR {lerr.toFixed(0)}%
        </text>
        <text x={32} y={588} fill="#D4654A" fontSize={10} fontFamily="'Space Mono', monospace">
          RIGHT: per-shard CPU {rcpu.toFixed(0)}%  ·  DISK {rightDiskPctPerShard.toFixed(0)}%  ·  LAT {rlat.toFixed(1)} ms  ·  capacity = {SHARD_COUNT}× LEFT
        </text>
      </g>
    )
  }

  // ─── Title / divider / status ────────────────────────────────────────────

  function renderChrome() {
    return (
      <g>
        <rect width={VIEW_W} height={VIEW_H} fill="#F0F0E8" />

        {/* Stage title */}
        <text x={VIEW_W / 2} y={18} fill="#2A2A28" fontSize={11} fontFamily="'Press Start 2P', monospace" textAnchor="middle">
          PARTITIONING (one node) ║ SHARDING (N nodes)
        </text>

        {/* Divider */}
        <line x1={DIVIDER_X} y1={28} x2={DIVIDER_X} y2={500}
          stroke="#B0B09A" strokeWidth={2} strokeDasharray="6 4" />
        <rect x={DIVIDER_X - 14} y={V_MID - 12} width={28} height={24} rx={4} fill="#C5C6A8" stroke="#7A7A6E" strokeWidth={1} />
        <text x={DIVIDER_X} y={V_MID + 5} fill="#2A2A28" fontSize={9} fontFamily="'Press Start 2P', monospace" textAnchor="middle">vs</text>

        {/* Status line at top under title */}
        <text x={VIEW_W / 2} y={VIEW_H - 6} fill="#D4654A" fontSize={9} fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">
          {state.lastOp}
        </text>
      </g>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  const modeLabel = fixModeIndex === -1 ? 'topology' : fixModeIndex === 0 ? 'writes' : fixModeIndex === 1 ? 'point read' : fixModeIndex === 2 ? 'range scan' : fixModeIndex === 3 ? 'failure' : fixModeIndex === 4 ? 'atomic txn' : 'scale wall'
  const liveInFlight = state.inFlight.filter(q => q.status === 'live').length
  const failedInFlight = state.inFlight.filter(q => q.status === 'failed').length
  const traceSteps: LearningTraceStep[] = [
    { title: '1. Same Hash', detail: 'Both sides use hash(key) mod 4 to choose a bucket.', meta: `next key index=${state.insertCursor}`, color: '#3b82f6' },
    { title: '2. Placement', detail: 'Partitioning places buckets inside one server; sharding places buckets on separate servers.', meta: `${state.leftPartitions.reduce((sum, p) => sum + p.rows.length, 0)} rows loaded`, color: '#22c55e' },
    { title: '3. Operation', detail: state.lastOp, meta: `mode=${modeLabel}`, color: '#f59e0b' },
    { title: '4. Consequence', detail: fixModeIndex === 3 ? 'Failure blast radius differs: one partitioned server fails all data, one shard fails only its bucket.' : fixModeIndex === 5 ? 'Load and disk growth hit one-node limits sooner than horizontally sharded capacity.' : 'Network cost, transaction cost, and scan cost diverge after placement.', meta: `live=${liveInFlight}, failed=${failedInFlight}`, color: failedInFlight > 0 ? '#ef4444' : '#06b6d4' },
  ]
  const leftStoragePct = Math.min(100, (state.scaleStorageBytes / LEFT_DISK_CAP_BYTES) * 100)
  const leftCpu = leftCpuPct(state.scaleLoadRps)
  const leftLatency = fixModeIndex === 5 ? leftLatencyMs(state.scaleLoadRps, leftStoragePct) : state.metrics.left.lastLatencyMs
  const leftErrors = fixModeIndex === 5 ? leftErrorPct(state.scaleLoadRps, leftStoragePct) : state.metrics.left.failed
  const rightCpu = rightShardCpuPct(state.scaleLoadRps)
  const rightLatency = fixModeIndex === 5 ? rightShardLatencyMs(state.scaleLoadRps) : state.metrics.right.lastLatencyMs

  const stateBody = (
    <div className="space-y-1">
      <div>Mode: {modeLabel}</div>
      <div>Tick: {state.tick}; in-flight: {liveInFlight}</div>
      <div>Left CPU: {leftCpu.toFixed(0)}%; latency: {leftLatency >= 9999 ? '∞' : `${leftLatency.toFixed(0)}ms`}; failures: {leftErrors}</div>
      <div>Right avg shard CPU: {rightCpu.toFixed(0)}%; latency: {rightLatency.toFixed(1)}ms</div>
    </div>
  )

  return (
    <LearningModuleShell
      visual={(
      <div className="h-full flex items-center justify-center overflow-hidden px-2">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
          {renderChrome()}
          {fixModeIndex === 5 ? renderScaleWall() : (
            <>
              {renderLeft()}
              {renderRight()}
              {renderParticles()}
              {fixModeIndex === 4 && state.txn ? renderTxnLog() : renderMetricsBar()}
            </>
          )}
          {fixModeIndex === 4 && state.txn && (
            // Show LEFT metrics still even with 2PC log on right
            <g>
              <rect x={20} y={510} width={660} height={92} rx={4} fill="#D0CEBA" stroke="#B0B09A" strokeWidth={1} />
              <text x={32} y={526} fill="#4A6FA5" fontSize={7} fontFamily="'Press Start 2P', monospace">LEFT — ACID (single node)</text>
              <text x={32} y={548} fill="#7A7A6E" fontSize={10} fontFamily="'Space Mono', monospace">
                BEGIN; UPDATE k={TXN_KEY_A}; UPDATE k={TXN_KEY_B}; COMMIT;
              </text>
              <text x={32} y={566} fill="#4CAF50" fontSize={10} fontFamily="'Space Mono', monospace" fontWeight="bold">
                1 transaction, 1 log write, ~1 ms
              </text>
              <text x={32} y={584} fill="#7A7A6E" fontSize={10} fontFamily="'Space Mono', monospace">
                ok writes: {state.metrics.left.ok}   fail: <tspan fill={state.metrics.left.failed > 0 ? '#ef4444' : '#7A7A6E'}>{state.metrics.left.failed}</tspan>
              </text>
              <text x={32} y={597} fill="#4A6FA5" fontSize={8} fontFamily="'Space Mono', monospace" fontStyle="italic">
                no 2PC, no coordinator, no lock hold — one process owns both rows
              </text>
            </g>
          )}
        </svg>
      </div>
      )}
      traceTitle="DISTRIBUTED DATA TRACE"
      traceMeta={state.lastOp}
      traceSteps={traceSteps}
      stateTitle="WHAT THE SYSTEM RECORDS"
      stateBody={stateBody}
      eventsTitle="OPERATION LOG"
      events={[
        { id: 'last-op', text: state.lastOp, color: failedInFlight > 0 ? '#ef4444' : '#f97316' },
        { id: 'metrics', text: `left ok=${state.metrics.left.ok} fail=${state.metrics.left.failed}; right ok=${state.metrics.right.ok} fail=${state.metrics.right.failed}`, color: '#93c5fd' },
      ]}
      emptyEventText="Choose a mode and run an operation to compare placement consequences."
      latestKey={modeLabel}
      controls={(
        <>
          {renderControls()}
          <div className="flex items-center gap-3 font-mono-clean" style={{ fontSize: '10px', color: '#7A7A6E' }}>
            <span>tick: {state.tick}</span>
            <span>·</span>
            <span>in-flight: {liveInFlight}</span>
            <span>·</span>
            <span>mode: {modeLabel}</span>
          </div>
        </>
      )}
      minVisualHeight={260}
    />
  )

  // ─── Controls panel (mode-gated) ─────────────────────────────────────────

  function renderControls() {
    if (fixModeIndex === -1) {
      return (
        <div className="font-mono-clean text-xs" style={{ color: '#7A7A6E' }}>
          Topology view — pick a fix mode in the sidebar to start operations.
          The same keys will be hashed by both sides ({KEY_SET.length} keys: {KEY_SET.slice(0, 6).join(', ')}, …).
        </div>
      )
    }

    if (fixModeIndex === 0) {
      const remaining = KEY_SET.length - state.insertCursor
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={() => dispatch({ type: 'insert-next' })} disabled={remaining <= 0}
            className="retro-btn retro-btn--sm" style={{ minWidth: 160 }}>
            ▶ INSERT NEXT KEY ({remaining} left)
          </button>
          <button onClick={() => { if (autoInsert) stopAutoInsert(); else setAutoInsert(true) }} disabled={remaining <= 0 && !autoInsert}
            className="retro-btn retro-btn--sm">
            {autoInsert ? '⏸ STOP AUTO' : '▶ AUTO-INSERT ALL'}
          </button>
          <button onClick={() => { stopAutoInsert(); dispatch({ type: 'init', mode: 0 }) }} className="retro-btn retro-btn--sm">
            ↺ RESET
          </button>
          <span className="font-mono-clean text-xs ml-3" style={{ color: '#7A7A6E' }}>
            same `hash(key) % 4`, different transport — watch the RTT counter on the right
          </span>
        </div>
      )
    }

    if (fixModeIndex === 1) {
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <label className="font-mono-clean text-xs" style={{ color: '#7A7A6E' }}>SELECT WHERE id =</label>
          <input type="number" value={pointKey} onChange={e => setPointKey(Number(e.target.value))}
            className="w-20 px-2 py-1 text-xs font-mono rounded"
            style={{ background: '#F0F0E8', border: '1px solid #B0B09A', color: '#2A2A28' }} />
          <button onClick={() => dispatch({ type: 'point-query', key: pointKey })}
            className="retro-btn retro-btn--sm">▶ QUERY</button>
          <span className="font-mono-clean text-xs" style={{ color: '#7A7A6E' }}>quick pick:</span>
          {[3, 42, 113, 256, 999].map(k => (
            <button key={k} onClick={() => { setPointKey(k); dispatch({ type: 'point-query', key: k }) }}
              className="retro-btn retro-btn--sm" style={{ fontSize: '10px', padding: '2px 8px' }}>
              {k} → b{(((k % 4) + 4) % 4)}
            </button>
          ))}
        </div>
      )
    }

    if (fixModeIndex === 2) {
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <label className="font-mono-clean text-xs" style={{ color: '#7A7A6E' }}>SELECT WHERE id BETWEEN</label>
          <input type="number" value={rangeLo} onChange={e => setRangeLo(Number(e.target.value))}
            className="w-20 px-2 py-1 text-xs font-mono rounded"
            style={{ background: '#F0F0E8', border: '1px solid #B0B09A', color: '#2A2A28' }} />
          <span className="font-mono-clean text-xs" style={{ color: '#7A7A6E' }}>AND</span>
          <input type="number" value={rangeHi} onChange={e => setRangeHi(Number(e.target.value))}
            className="w-20 px-2 py-1 text-xs font-mono rounded"
            style={{ background: '#F0F0E8', border: '1px solid #B0B09A', color: '#2A2A28' }} />
          <button onClick={() => dispatch({ type: 'range-query', lo: rangeLo, hi: rangeHi })}
            className="retro-btn retro-btn--sm">▶ RANGE SCAN</button>
          <span className="font-mono-clean text-xs ml-3" style={{ color: '#7A7A6E' }}>
            LEFT: sequential across 4 partitions · RIGHT: fan-out across 4 shards (network)
          </span>
        </div>
      )
    }

    if (fixModeIndex === 3) {
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={() => dispatch({ type: state.leftServerAlive ? 'kill-left' : 'revive-left' })}
            className="retro-btn retro-btn--sm"
            style={state.leftServerAlive
              ? { background: '#ef4444', color: '#fff', borderColor: '#b91c1c' }
              : { background: '#4CAF50', color: '#fff', borderColor: '#388E3C' }}>
            {state.leftServerAlive ? '☠ KILL LEFT SERVER' : '✚ REVIVE LEFT SERVER'}
          </button>
          {[0, 1, 2, 3].map(i => {
            const alive = state.rightShards[i].alive
            return (
              <button key={i} onClick={() => dispatch({ type: alive ? 'kill-shard' : 'revive-shard', id: i })}
                className="retro-btn retro-btn--sm"
                style={alive
                  ? { background: '#D4654A', color: '#fff', borderColor: '#B5503A' }
                  : { background: '#4CAF50', color: '#fff', borderColor: '#388E3C' }}>
                {alive ? `☠ KILL ${SHARD_LABELS[i]}` : `✚ REVIVE ${SHARD_LABELS[i]}`}
              </button>
            )
          })}
          <button onClick={() => dispatch({ type: 'point-query', key: pointKey })}
            className="retro-btn retro-btn--sm">▶ TEST QUERY k={pointKey}</button>
          <span className="font-mono-clean text-xs ml-2" style={{ color: '#7A7A6E' }}>
            kill the server / a shard, then re-run queries to compare blast radius
          </span>
        </div>
      )
    }

    if (fixModeIndex === 5) {
      const presets = [10_000, 50_000, 100_000, 150_000, 200_000]
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <label className="font-mono-clean text-xs" style={{ color: '#7A7A6E' }}>LOAD (rps):</label>
          <input type="range" min={0} max={SCALE_MAX_RPS} step={5000}
            value={state.scaleLoadRps}
            onChange={e => dispatch({ type: 'set-scale-load', rps: Number(e.target.value) })}
            className="w-48" />
          <span className="font-mono-clean text-xs font-bold" style={{ color: '#2A2A28', minWidth: 70 }}>
            {(state.scaleLoadRps / 1000).toFixed(0)}K rps
          </span>
          <div className="flex gap-1">
            {presets.map(p => (
              <button key={p} onClick={() => dispatch({ type: 'set-scale-load', rps: p })}
                className="retro-btn retro-btn--sm" style={{ fontSize: '10px', padding: '2px 8px' }}>
                {p / 1000}K
              </button>
            ))}
          </div>
          <button onClick={() => dispatch({ type: 'toggle-scale-ramp' })}
            className="retro-btn retro-btn--sm"
            style={state.scaleRamping
              ? { background: '#ef4444', color: '#fff', borderColor: '#b91c1c' }
              : { background: '#4CAF50', color: '#fff', borderColor: '#388E3C' }}>
            {state.scaleRamping ? '⏸ STOP RAMP' : '▶ START RAMP (fill disks)'}
          </button>
          <button onClick={() => dispatch({ type: 'reset-scale' })} className="retro-btn retro-btn--sm">
            ↺ RESET
          </button>
          <span className="font-mono-clean text-xs ml-2" style={{ color: '#7A7A6E' }}>
            crank load → LEFT hits CPU wall · ramp → LEFT hits disk wall · RIGHT shares load N ways
          </span>
        </div>
      )
    }

    if (fixModeIndex === 4) {
      const txnRunning = !!state.txn && state.txn.phase !== 'done' && state.txn.phase !== 'abort'
      const bA = (((TXN_KEY_A % 4) + 4) % 4) as Bucket
      const bB = (((TXN_KEY_B % 4) + 4) % 4) as Bucket
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={() => dispatch({ type: 'start-txn', keyA: TXN_KEY_A, keyB: TXN_KEY_B })}
            disabled={txnRunning}
            className="retro-btn retro-btn--sm" style={{ minWidth: 220 }}>
            ▶ ATOMIC TRANSFER k={TXN_KEY_A} ({SHARD_LABELS[bA]}) ↔ k={TXN_KEY_B} ({SHARD_LABELS[bB]})
          </button>
          <button onClick={() => dispatch({ type: 'init', mode: 4 })} className="retro-btn retro-btn--sm">
            ↺ RESET
          </button>
          <span className="font-mono-clean text-xs ml-2" style={{ color: '#7A7A6E' }}>
            LEFT: single-node ACID. RIGHT: 2-Phase Commit — PREPARE → VOTE → COMMIT → ACK (4 RTTs)
          </span>
        </div>
      )
    }

    return null
  }
}
