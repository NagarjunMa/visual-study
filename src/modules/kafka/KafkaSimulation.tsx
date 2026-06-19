import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import { LearningModuleShell, type LearningTraceStep } from '../../components/LearningModuleShell'
import type { Stage } from '../../simulation/types'
import type { KafkaState } from './kafka.types'
import {
  createInitialKafkaState, kafkaProduce, kafkaConsume,
  kafkaKillBroker, kafkaResurrectBroker,
  kafkaAddConsumer, kafkaRemoveConsumer, kafkaSetAcks,
  kafkaCommitPending, kafkaClearRebalance,
  getPartitionForKey, PARTITION_COLORS, PARTITION_COUNT,
} from './KafkaEngine'

interface Props { stage?: Stage; fixModeIndex?: number }

type Action =
  | { type: 'produce'; key: string; value: string }
  | { type: 'consume' }
  | { type: 'kill-broker'; brokerId: number }
  | { type: 'resurrect-broker'; brokerId: number }
  | { type: 'add-consumer' }
  | { type: 'remove-consumer'; consumerId: string }
  | { type: 'set-acks'; mode: 'acks-1' | 'acks-all' }
  | { type: 'commit-pending' }
  | { type: 'clear-rebalance' }
  | { type: 'init'; mode: number }

function reducer(state: KafkaState, action: Action): KafkaState {
  switch (action.type) {
    case 'produce': return kafkaProduce(state, action.key, action.value)
    case 'consume': return kafkaConsume(state, 'app')
    case 'kill-broker': return kafkaKillBroker(state, action.brokerId)
    case 'resurrect-broker': return kafkaResurrectBroker(state, action.brokerId)
    case 'add-consumer': return kafkaAddConsumer(state, 'app')
    case 'remove-consumer': return kafkaRemoveConsumer(state, 'app', action.consumerId)
    case 'set-acks': return kafkaSetAcks(state, action.mode)
    case 'commit-pending': return kafkaCommitPending(state)
    case 'clear-rebalance': return kafkaClearRebalance(state)
    case 'init': return createInitialKafkaState(action.mode)
    default: return state
  }
}

const SAMPLE_KEYS = ['user1', 'user2', 'user3', 'order1', 'order2', 'session1', 'payment1', 'user1', 'order1', 'user3']
const SAMPLE_VALUES = ['login', 'signup', 'click', 'created', 'paid', 'expired', 'refund', 'logout', 'shipped', 'viewed']

export function KafkaSimulation({ fixModeIndex = -1 }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialKafkaState(fixModeIndex))
  const [inputKey, setInputKey] = useState('user1')
  const [inputValue, setInputValue] = useState('login')
  const [autoProducing, setAutoProducing] = useState(false)
  const [autoConsuming, setAutoConsuming] = useState(false)
  const prodRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const consRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const counter = useRef(0)

  const stopAll = useCallback(() => {
    if (prodRef.current) { clearInterval(prodRef.current); prodRef.current = null }
    if (consRef.current) { clearInterval(consRef.current); consRef.current = null }
    setAutoProducing(false); setAutoConsuming(false)
  }, [])

  useEffect(() => { stopAll(); dispatch({ type: 'init', mode: fixModeIndex }); counter.current = 0 }, [fixModeIndex, stopAll])
  useEffect(() => () => stopAll(), [stopAll])

  useEffect(() => {
    if (state.pendingHwm) {
      const t = setTimeout(() => dispatch({ type: 'commit-pending' }), 600)
      return () => clearTimeout(t)
    }
  }, [state.pendingHwm])

  useEffect(() => {
    if (state.consumerGroups.some(g => g.isRebalancing)) {
      const t = setTimeout(() => dispatch({ type: 'clear-rebalance' }), 1500)
      return () => clearTimeout(t)
    }
  }, [state.consumerGroups])

  function toggleAutoProd() {
    if (autoProducing) { clearInterval(prodRef.current!); prodRef.current = null; setAutoProducing(false) }
    else {
      setAutoProducing(true)
      prodRef.current = setInterval(() => {
        const i = counter.current % SAMPLE_KEYS.length
        dispatch({ type: 'produce', key: SAMPLE_KEYS[i], value: SAMPLE_VALUES[i] })
        counter.current++
      }, 800)
    }
  }

  function toggleAutoCons() {
    if (autoConsuming) { clearInterval(consRef.current!); consRef.current = null; setAutoConsuming(false) }
    else { setAutoConsuming(true); consRef.current = setInterval(() => dispatch({ type: 'consume' }), 1200) }
  }

  const group = state.consumerGroups[0]
  const partCount = state.partitions.length
  const preview = inputKey ? getPartitionForKey(inputKey, partCount) : -1
  const totalLag = state.partitions.reduce((sum, p) => sum + Math.max(0, p.hwm - (group.offsets[p.id] ?? 0)), 0)

  function getTraceSteps(): LearningTraceStep[] {
    const target = preview >= 0 ? `P${preview}` : 'choose a key'
    const partition = preview >= 0 ? state.partitions[preview] : undefined
    const leader = partition ? `broker ${partition.leaderId}` : 'leader unknown'
    return [
      {
        title: '1. Produce',
        detail: `Message key="${inputKey || 'empty'}", value="${inputValue || 'empty'}" enters the producer.`,
        meta: `sent=${state.messageCounter}`,
        color: '#d97706',
      },
      {
        title: '2. Route',
        detail: partCount > 1 ? `Hash the key, then route to ${target}.` : 'Single-log mode sends every message to partition 0.',
        meta: partCount > 1 ? `hash(key) % ${partCount} = ${target}` : 'one topic log',
        color: '#3b82f6',
      },
      {
        title: '3. Append',
        detail: partition ? `Leader ${leader} appends at LEO ${partition.leo}; HWM is ${partition.hwm}.` : 'The log appends messages in offset order.',
        meta: state.acksMode === 'acks-all' ? 'acks=all waits for ISR before commit' : 'acks=1 returns after leader append',
        color: '#f59e0b',
      },
      {
        title: '4. Consume',
        detail: `Consumers read by offset; total lag is ${totalLag}.`,
        meta: group.isRebalancing ? 'group paused during rebalance' : `members=${group.consumers.length}`,
        color: '#047857',
      },
    ]
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Base mode — simple log
  // ═══════════════════════════════════════════════════════════════════════════
  function renderBase() {
    const p = state.partitions[0]
    const offset = group.offsets[0] ?? 0
    return (
      <svg viewBox="0 0 1000 380" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
        <rect width="1000" height="380" fill="#F0F0E8" />
        <text x="500" y="28" fill="#2A2A28" fontSize="12" fontWeight="bold" fontFamily="'Press Start 2P', monospace" textAnchor="middle">KAFKA — MESSAGE LOG</text>

        {/* Producer */}
        <rect x="40" y="60" width="180" height="160" rx="4" fill="#D0CEBA" stroke="#d97706" strokeWidth="2" />
        <rect x="40" y="60" width="180" height="20" rx="4" fill="#d97706" opacity="0.15" />
        <text x="130" y="75" fill="#d97706" fontSize="8" fontFamily="'Press Start 2P', monospace" textAnchor="middle">PRODUCER</text>
        <text x="55" y="100" fill="#7A7A6E" fontSize="10" fontFamily="'Space Mono', monospace">key: "{inputKey}"</text>
        <text x="55" y="118" fill="#7A7A6E" fontSize="10" fontFamily="'Space Mono', monospace">val: "{inputValue}"</text>
        <text x="55" y="142" fill="#7A7A6E" fontSize="9" fontFamily="'Space Mono', monospace">sent: {state.messageCounter}</text>
        {autoProducing && <circle cx="200" cy="140" r="4" fill="#16a34a"><animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" /></circle>}

        {/* Arrow */}
        <line x1="220" y1="140" x2="320" y2="140" stroke="#8A8A76" strokeWidth="2" strokeDasharray="6 4" />
        <polygon points="320,140 312,136 312,144" fill="#8A8A76" />

        {/* Topic log */}
        <rect x="330" y="60" width="340" height="280" rx="4" fill="#D0CEBA" stroke="#2563eb" strokeWidth="2" />
        <rect x="330" y="60" width="340" height="20" rx="4" fill="#2563eb" opacity="0.15" />
        <text x="500" y="75" fill="#2563eb" fontSize="8" fontFamily="'Press Start 2P', monospace" textAnchor="middle">TOPIC: events</text>

        {/* Messages */}
        <text x="340" y="100" fill="#7A7A6E" fontSize="7" fontFamily="'Press Start 2P', monospace">OFFSET  KEY       VALUE</text>
        {p.messages.slice(-10).map((m, i) => {
          const isConsumed = m.offset < offset
          return (
            <text key={m.offset} x="340" y={114 + i * 16} fill={isConsumed ? '#B0B09A' : '#2A2A28'}
              fontSize="10" fontFamily="'Space Mono', monospace"
              textDecoration={isConsumed ? 'line-through' : 'none'}>
              {String(m.offset).padStart(4)}    {m.key.padEnd(10)} {m.value}
            </text>
          )
        })}

        {/* Consumer offset pointer */}
        {p.messages.length > 0 && (
          <g>
            <line x1="660" y1="105" x2="660" y2={105 + Math.min(p.messages.length, 10) * 16}
              stroke="#047857" strokeWidth="2" />
            <text x="665" y={105 + Math.min(offset - (p.leo - Math.min(p.messages.length, 10)), Math.min(p.messages.length, 10)) * 16}
              fill="#047857" fontSize="8" fontFamily="'Space Mono', monospace" fontWeight="bold">
              ◀ offset={offset}
            </text>
          </g>
        )}

        {/* Arrow */}
        <line x1="670" y1="140" x2="760" y2="140" stroke="#8A8A76" strokeWidth="2" strokeDasharray="6 4" />
        <polygon points="760,140 752,136 752,144" fill="#8A8A76" />

        {/* Consumer */}
        <rect x="770" y="60" width="190" height="160" rx="4" fill="#D0CEBA" stroke="#047857" strokeWidth="2" />
        <rect x="770" y="60" width="190" height="20" rx="4" fill="#047857" opacity="0.15" />
        <text x="865" y="75" fill="#047857" fontSize="8" fontFamily="'Press Start 2P', monospace" textAnchor="middle">CONSUMER</text>
        <text x="785" y="100" fill="#047857" fontSize="11" fontFamily="'Space Mono', monospace" fontWeight="bold">offset: {offset}</text>
        <text x="785" y="118" fill="#7A7A6E" fontSize="9" fontFamily="'Space Mono', monospace">hwm: {p.hwm}</text>
        <text x="785" y="136" fill="#7A7A6E" fontSize="9" fontFamily="'Space Mono', monospace">
          lag: {Math.max(0, p.hwm - offset)} msg(s)
        </text>
        {autoConsuming && <circle cx="945" cy="68" r="4" fill="#16a34a"><animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" /></circle>}

        {/* Status */}
        <text x="40" y="370" fill="#D4654A" fontSize="9" fontFamily="'Space Mono', monospace" fontWeight="bold">{state.lastOp}</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Partitions mode
  // ═══════════════════════════════════════════════════════════════════════════
  function renderPartitions() {
    const offset = group.offsets
    return (
      <svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
        <rect width="1000" height="400" fill="#F0F0E8" />
        <text x="500" y="28" fill="#2A2A28" fontSize="12" fontWeight="bold" fontFamily="'Press Start 2P', monospace" textAnchor="middle">KAFKA — PARTITIONS</text>

        {/* Producer */}
        <rect x="30" y="50" width="200" height="200" rx="4" fill="#D0CEBA" stroke="#d97706" strokeWidth="2" />
        <rect x="30" y="50" width="200" height="20" rx="4" fill="#d97706" opacity="0.15" />
        <text x="130" y="65" fill="#d97706" fontSize="7" fontFamily="'Press Start 2P', monospace" textAnchor="middle">PRODUCER</text>
        <text x="45" y="90" fill="#7A7A6E" fontSize="9" fontFamily="'Space Mono', monospace">key: "{inputKey}"</text>
        <text x="45" y="106" fill="#7A7A6E" fontSize="9" fontFamily="'Space Mono', monospace">val: "{inputValue}"</text>

        {/* Hash formula */}
        <rect x="40" y="118" width="180" height="32" rx="3" fill="#F0F0E8" stroke="#B0B09A" strokeWidth="1" />
        <text x="130" y="132" fill="#2A2A28" fontSize="8" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">hash("{inputKey}") % {PARTITION_COUNT}</text>
        <text x="130" y="146" fill={preview >= 0 ? PARTITION_COLORS[preview] : '#7A7A6E'} fontSize="11" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">= P{preview}</text>

        <text x="45" y="172" fill="#7A7A6E" fontSize="8" fontFamily="'Space Mono', monospace">sent: {state.messageCounter}</text>
        {autoProducing && <circle cx="215" cy="170" r="4" fill="#16a34a"><animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" /></circle>}

        {/* Arrows to partitions */}
        <line x1="230" y1="150" x2="310" y2="150" stroke="#8A8A76" strokeWidth="1.5" strokeDasharray="5 3" />

        {/* 3 Partitions */}
        {state.partitions.map((p, i) => {
          const py = 50 + i * 110
          const color = PARTITION_COLORS[i]
          const msgs = p.messages.slice(-5)
          return (
            <g key={i}>
              <rect x="320" y={py} width="380" height="95" rx="4" fill="#D0CEBA" stroke={color} strokeWidth="2" />
              <rect x="320" y={py} width="380" height="18" rx="4" fill={color} opacity="0.15" />
              <text x="335" y={py + 14} fill={color} fontSize="7" fontFamily="'Press Start 2P', monospace">P{i}</text>
              <text x="690" y={py + 14} fill="#7A7A6E" fontSize="7" fontFamily="'Space Mono', monospace" textAnchor="end">
                leo={p.leo} | offset={offset[i] ?? 0}
              </text>
              {/* Messages */}
              {msgs.map((m, mi) => (
                <text key={m.offset} x="330" y={py + 32 + mi * 12} fill={(offset[i] ?? 0) > m.offset ? '#B0B09A' : '#2A2A28'}
                  fontSize="9" fontFamily="'Space Mono', monospace">
                  [{m.offset}] {m.key}={m.value}
                </text>
              ))}
              {msgs.length === 0 && <text x="330" y={py + 38} fill="#B0B09A" fontSize="9" fontFamily="'Space Mono', monospace">empty</text>}
            </g>
          )
        })}

        {/* Consumer */}
        <rect x="720" y="100" width="180" height="130" rx="4" fill="#D0CEBA" stroke="#047857" strokeWidth="2" />
        <rect x="720" y="100" width="180" height="18" rx="4" fill="#047857" opacity="0.15" />
        <text x="810" y="114" fill="#047857" fontSize="7" fontFamily="'Press Start 2P', monospace" textAnchor="middle">CONSUMER C0</text>
        {state.partitions.map((p, i) => (
          <text key={i} x="735" y={136 + i * 18} fill="#7A7A6E" fontSize="9" fontFamily="'Space Mono', monospace">
            P{i}: offset={offset[i] ?? 0} lag={Math.max(0, p.hwm - (offset[i] ?? 0))}
          </text>
        ))}
        {autoConsuming && <circle cx="885" cy="108" r="4" fill="#16a34a"><animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" /></circle>}

        <line x1="700" y1="165" x2="720" y2="165" stroke="#8A8A76" strokeWidth="1.5" strokeDasharray="5 3" />

        <text x="30" y="390" fill="#D4654A" fontSize="9" fontFamily="'Space Mono', monospace" fontWeight="bold">{state.lastOp}</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Brokers + Replication (Fix 1), Failure (Fix 2), Consumer Groups (Fix 3)
  // ═══════════════════════════════════════════════════════════════════════════
  function renderBrokers() {
    const BX = [240, 460, 680]
    const BW = 190
    const BY = 50
    const BH = 280
    const showKill = fixModeIndex >= 2
    const showConsGroups = fixModeIndex >= 3

    return (
      <svg viewBox="0 0 1200 480" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
        <rect width="1200" height="480" fill="#F0F0E8" />
        <text x="600" y="24" fill="#2A2A28" fontSize="11" fontWeight="bold" fontFamily="'Press Start 2P', monospace" textAnchor="middle">
          KAFKA — {fixModeIndex === 1 ? 'REPLICATION' : fixModeIndex === 2 ? 'BROKER FAILURE' : 'CONSUMER GROUPS'}
        </text>

        {/* Producer */}
        <rect x="20" y={BY} width="180" height="180" rx="4" fill="#D0CEBA" stroke="#d97706" strokeWidth="2" />
        <rect x="20" y={BY} width="180" height="18" rx="4" fill="#d97706" opacity="0.15" />
        <text x="110" y={BY + 14} fill="#d97706" fontSize="7" fontFamily="'Press Start 2P', monospace" textAnchor="middle">PRODUCER</text>
        <text x="32" y={BY + 38} fill="#7A7A6E" fontSize="8" fontFamily="'Space Mono', monospace">key: "{inputKey}"</text>
        <rect x="28" y={BY + 48} width="164" height="28" rx="3" fill="#F0F0E8" stroke="#B0B09A" strokeWidth="1" />
        <text x="110" y={BY + 60} fill="#2A2A28" fontSize="7" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">hash("{inputKey}")%3 = P{preview}</text>
        <text x="110" y={BY + 72} fill={PARTITION_COLORS[preview] || '#7A7A6E'} fontSize="9" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">→ P{preview}</text>
        <text x="32" y={BY + 100} fill="#7A7A6E" fontSize="8" fontFamily="'Space Mono', monospace">sent: {state.messageCounter}</text>
        <text x="32" y={BY + 116} fill={state.acksMode === 'acks-all' ? '#047857' : '#d97706'} fontSize="8" fontFamily="'Space Mono', monospace" fontWeight="bold">{state.acksMode}</text>
        {autoProducing && <circle cx="185" cy={BY + 98} r="4" fill="#16a34a"><animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" /></circle>}
        {state.pendingHwm && <text x="32" y={BY + 134} fill="#d97706" fontSize="7" fontFamily="'Space Mono', monospace">replicating P{state.pendingHwm.partitionId}...</text>}

        <line x1="200" y1={BY + 90} x2="240" y2={BY + 90} stroke="#8A8A76" strokeWidth="1.5" strokeDasharray="5 3" />

        {/* Brokers */}
        {state.brokers.map((b, bi) => {
          const bx = BX[bi]
          const alive = b.alive
          const isCtrl = state.controllerId === bi
          return (
            <g key={bi} opacity={alive ? 1 : 0.3}>
              <rect x={bx} y={BY} width={BW} height={BH} rx="4" fill="#D0CEBA" stroke={alive ? '#0284c7' : '#ef4444'} strokeWidth="2" />
              <rect x={bx} y={BY} width={BW} height="18" rx="4" fill={alive ? '#0284c7' : '#ef4444'} opacity="0.15" />
              <text x={bx + BW / 2} y={BY + 14} fill={alive ? '#0284c7' : '#ef4444'} fontSize="7" fontFamily="'Press Start 2P', monospace" textAnchor="middle">
                BROKER {bi}{isCtrl ? ' ★' : ''}
              </text>

              {!alive && (
                <g>
                  <line x1={bx + 50} y1={BY + 80} x2={bx + BW - 50} y2={BY + BH - 60} stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                  <line x1={bx + BW - 50} y1={BY + 80} x2={bx + 50} y2={BY + BH - 60} stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                  <text x={bx + BW / 2} y={BY + BH - 20} fill="#ef4444" fontSize="8" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">DOWN</text>
                </g>
              )}

              {alive && state.partitions.map((p, pi) => {
                const isLeader = p.leaderId === bi
                const isFollower = !isLeader && p.replicas.includes(bi)
                if (!isLeader && !isFollower) return null
                const role = isLeader ? 'L' : 'F'
                const py = BY + 24 + (isLeader ? pi : pi + PARTITION_COUNT) * 38
                if (py + 30 > BY + BH) return null
                const color = PARTITION_COLORS[pi]
                return (
                  <g key={`${bi}-${pi}-${role}`}>
                    <rect x={bx + 10} y={py} width={BW - 20} height="32" rx="3"
                      fill={isLeader ? color : '#F0F0E8'} stroke={color} strokeWidth={isLeader ? 2 : 1}
                      strokeDasharray={isLeader ? 'none' : '4 3'} opacity={isLeader ? 0.2 : 0.6} />
                    <rect x={bx + 12} y={py + 2} width="14" height="14" rx="2" fill={isLeader ? color : '#B0B09A'} />
                    <text x={bx + 19} y={py + 12} fill="#F0F0E8" fontSize="7" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">{role}</text>
                    <text x={bx + 32} y={py + 12} fill={color} fontSize="8" fontFamily="'Space Mono', monospace" fontWeight="bold">P{pi}</text>
                    {isLeader && (
                      <text x={bx + BW - 14} y={py + 12} fill="#7A7A6E" fontSize="6" fontFamily="'Space Mono', monospace" textAnchor="end">
                        leo={p.leo} hwm={p.hwm}
                      </text>
                    )}
                    {isLeader && <text x={bx + 32} y={py + 26} fill="#7A7A6E" fontSize="6" fontFamily="'Space Mono', monospace">ISR=[{p.isr.join(',')}]</text>}
                    {isLeader && p.leo > p.hwm && (
                      <text x={bx + BW - 14} y={py + 26} fill="#d97706" fontSize="6" fontFamily="'Space Mono', monospace" textAnchor="end" fontWeight="bold">uncommitted!</text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

        {/* Controller */}
        {showKill && (
          <g>
            <rect x="460" y={BY + BH + 10} width="200" height="28" rx="4" fill="#D0CEBA" stroke={state.isElecting ? '#d97706' : '#8A8A76'} strokeWidth={state.isElecting ? 2 : 1} />
            <text x="560" y={BY + BH + 28} fill={state.isElecting ? '#d97706' : '#7A7A6E'} fontSize="7" fontFamily="'Press Start 2P', monospace" textAnchor="middle">
              {state.isElecting ? 'ELECTING...' : `CONTROLLER: B${state.controllerId}`}
            </text>
          </g>
        )}

        {/* Consumer(s) */}
        <rect x="900" y={BY} width="270" height={BH} rx="4" fill="#D0CEBA" stroke="#047857" strokeWidth="2" />
        <rect x="900" y={BY} width="270" height="18" rx="4" fill="#047857" opacity="0.15" />
        <text x="1035" y={BY + 14} fill="#047857" fontSize="7" fontFamily="'Press Start 2P', monospace" textAnchor="middle">
          {showConsGroups ? 'GROUP: app' : 'CONSUMER'}
        </text>
        {autoConsuming && <circle cx="1155" cy={BY + 9} r="4" fill="#16a34a"><animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" /></circle>}

        {group.isRebalancing && (
          <g>
            <rect x="920" y={BY + BH / 2 - 16} width="230" height="32" rx="4" fill="#d97706" opacity="0.9" />
            <text x="1035" y={BY + BH / 2 + 4} fill="#F0F0E8" fontSize="7" fontFamily="'Press Start 2P', monospace" textAnchor="middle">REBALANCING...</text>
          </g>
        )}

        {group.consumers.map((c, ci) => {
          const cy = BY + 26 + ci * 48
          return (
            <g key={c.id} opacity={group.isRebalancing ? 0.4 : 1}>
              <rect x="910" y={cy} width="250" height="40" rx="3" fill="#F0F0E8" stroke="#047857" strokeWidth="1" />
              <text x="920" y={cy + 13} fill="#047857" fontSize="8" fontFamily="'Space Mono', monospace" fontWeight="bold">{c.id}</text>
              <text x="920" y={cy + 25} fill="#7A7A6E" fontSize="7" fontFamily="'Space Mono', monospace">partitions: [{c.assignedPartitions.join(',')}]</text>
              <text x="920" y={cy + 36} fill="#7A7A6E" fontSize="6" fontFamily="'Space Mono', monospace">
                {c.assignedPartitions.map(pid => `P${pid}=${group.offsets[pid] ?? 0}`).join(' ')}
              </text>
            </g>
          )
        })}

        {/* Consumer lag */}
        {(() => {
          const lag = state.partitions.reduce((s, p) => s + Math.max(0, p.hwm - (group.offsets[p.id] ?? 0)), 0)
          return lag > 0 ? <text x="1035" y={BY + BH - 8} fill="#d97706" fontSize="8" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">lag: {lag}</text> : null
        })()}

        <line x1="870" y1={BY + 90} x2="900" y2={BY + 90} stroke="#8A8A76" strokeWidth="1.5" strokeDasharray="5 3" />

        {/* Event log */}
        <rect x="20" y={BY + 240} width="210" height="110" rx="4" fill="#D0CEBA" stroke="#8A8A76" strokeWidth="1" />
        <text x="28" y={BY + 254} fill="#7A7A6E" fontSize="6" fontFamily="'Press Start 2P', monospace">EVENT LOG</text>
        {state.recentEvents.map((e, i) => (
          <text key={e.id} x="28" y={BY + 266 + i * 10} fill={e.color} fontSize="7" fontFamily="'Space Mono', monospace">{e.text.slice(0, 38)}</text>
        ))}

        <text x="240" y="470" fill="#D4654A" fontSize="8" fontFamily="'Space Mono', monospace" fontWeight="bold">{state.lastOp}</text>
      </svg>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER SWITCH
  // ═══════════════════════════════════════════════════════════════════════════
  function renderVisualization() {
    if (fixModeIndex <= -1) return renderBase()
    if (fixModeIndex === 0) return renderPartitions()
    return renderBrokers()
  }

  const controls = (
    <>
          <div className="flex gap-1 items-end">
            <div>
              <label className="block font-mono" style={{ color: '#7A7A6E', fontSize: '8px' }}>Key</label>
              <input type="text" value={inputKey} onChange={e => setInputKey(e.target.value)}
                className="w-20 px-1.5 py-0.5 text-xs font-mono rounded"
                style={{ background: '#F0F0E8', border: '1px solid #B0B09A', color: '#2A2A28' }} />
            </div>
            <div>
              <label className="block font-mono" style={{ color: '#7A7A6E', fontSize: '8px' }}>Value</label>
              <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)}
                className="w-20 px-1.5 py-0.5 text-xs font-mono rounded"
                style={{ background: '#F0F0E8', border: '1px solid #B0B09A', color: '#2A2A28' }} />
            </div>
            <button onClick={() => dispatch({ type: 'produce', key: inputKey, value: inputValue })}
              disabled={!inputKey} className="retro-btn text-xs px-3 py-1 disabled:opacity-50">STEP</button>
          </div>

          <button onClick={toggleAutoProd} className={`retro-btn text-xs px-3 py-1 ${autoProducing ? 'retro-btn--accent' : ''}`}>
            {autoProducing ? 'STOP' : 'AUTO'}
          </button>

          <button onClick={() => dispatch({ type: 'consume' })} className="retro-btn text-xs px-3 py-1">CONSUME</button>

          <button onClick={toggleAutoCons} className={`retro-btn text-xs px-3 py-1 ${autoConsuming ? 'retro-btn--accent' : ''}`}>
            {autoConsuming ? 'STOP C' : 'AUTO C'}
          </button>

          {/* Mode-specific controls */}
          {fixModeIndex >= 1 && (
            <div className="flex gap-1">
              <button onClick={() => dispatch({ type: 'set-acks', mode: 'acks-1' })}
                className={`retro-btn text-xs px-3 py-1 ${state.acksMode === 'acks-1' ? 'retro-btn--accent' : ''}`}>acks=1</button>
              <button onClick={() => dispatch({ type: 'set-acks', mode: 'acks-all' })}
                className={`retro-btn text-xs px-3 py-1 ${state.acksMode === 'acks-all' ? 'retro-btn--accent' : ''}`}>acks=all</button>
            </div>
          )}

          {fixModeIndex >= 2 && (
            <div className="flex gap-1">
              {state.brokers.map(b => (
                <button key={b.id} onClick={() => dispatch({ type: b.alive ? 'kill-broker' : 'resurrect-broker', brokerId: b.id })}
                  className={`retro-btn text-xs px-3 py-1 ${b.alive ? 'retro-btn--accent' : ''}`}>
                  {b.alive ? `KILL B${b.id}` : `REVIVE B${b.id}`}
                </button>
              ))}
            </div>
          )}

          {fixModeIndex >= 3 && (
            <div className="flex gap-1">
              <button onClick={() => dispatch({ type: 'add-consumer' })} disabled={group.consumers.length >= PARTITION_COUNT}
                className="retro-btn text-xs px-3 py-1 disabled:opacity-50">+C</button>
              {group.consumers.length > 1 && (
                <button onClick={() => dispatch({ type: 'remove-consumer', consumerId: group.consumers[group.consumers.length - 1].id })}
                  className="retro-btn retro-btn--accent text-xs px-3 py-1">-C</button>
              )}
            </div>
          )}

          <button onClick={() => { stopAll(); dispatch({ type: 'init', mode: fixModeIndex }) }}
            className="retro-btn text-xs px-3 py-1">RESET</button>
    </>
  )

  const stateBody = (
    <div className="space-y-1">
      <div>Topic mode: {partCount === 1 ? 'single append-only log' : `${partCount} partitions`}</div>
      <div>Preview route: {preview >= 0 ? `key "${inputKey}" -> P${preview}` : 'enter a key'}</div>
      <div>Durability: {state.acksMode}; total consumer lag: {totalLag}</div>
      <div>Consumer group: {group.consumers.length} member(s){group.isRebalancing ? ' rebalancing now' : ''}</div>
    </div>
  )

  return (
    <LearningModuleShell
      visual={<div className="flex h-full items-center justify-center overflow-hidden px-2">{renderVisualization()}</div>}
      traceTitle="MESSAGE DECISION TRACE"
      traceMeta={state.lastOp}
      traceSteps={getTraceSteps()}
      stateTitle="WHAT KAFKA RECORDS"
      stateBody={stateBody}
      eventsTitle="EVENT LOG"
      events={state.recentEvents.slice(0, 5).map(e => ({ id: e.id, text: e.text, color: e.color }))}
      emptyEventText="Step a produced message to see partition routing, append offsets, and consumption."
      latestKey={inputKey ? `key:${inputKey}` : undefined}
      controls={controls}
      minVisualHeight={240}
    />
  )
}
