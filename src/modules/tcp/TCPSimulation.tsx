import { useReducer, useRef, useEffect } from 'react'
import { LearningModuleShell, type LearningTraceStep } from '../../components/LearningModuleShell'
import type { Stage } from '../../simulation/types'
import type { TCPConnection } from './tcp.types'
import {
  createInitialTCPState, tickPackets,
  sendSyn, sendSynAck, sendAck, sendData,
  sendFin, sendFinAck, sendServerFin, sendFinalAck,
  synTimeout, sendRst,
} from './TCPEngine'

interface TCPSimulationProps {
  stage?: Stage
  fixModeIndex?: number
}

type TCPAction =
  | { type: 'tick' }
  | { type: 'connect'; fixMode: number }
  | { type: 'step'; fixMode: number }
  | { type: 'send-data' }
  | { type: 'close' }
  | { type: 'close-step' }
  | { type: 'final-ack' }
  | { type: 'reset' }

function reducer(state: TCPConnection, action: TCPAction): TCPConnection {
  switch (action.type) {
    case 'tick':
      return tickPackets(state)

    case 'connect':
      if (state.clientState !== 'CLOSED') return state
      return sendSyn(state)

    case 'step': {
      const fm = action.fixMode

      // Fix mode 0: SYN timeout — server never responds
      if (fm === 0 && state.phase === 'syn-sent' && state.retryCount < 3) {
        return synTimeout(state)
      }
      // Fix mode 0: after 3 retries, show final timeout
      if (fm === 0 && state.phase === 'syn-timeout' && state.retryCount < 3) {
        return synTimeout(state)
      }

      // Fix mode 1: RST — server actively rejects
      if (fm === 1 && state.phase === 'syn-sent') {
        return sendRst(state)
      }

      // Normal handshake progression
      switch (state.phase) {
        case 'syn-sent': return sendSynAck(state)
        case 'syn-ack-received': return sendAck(state)
        default: return state
      }
    }

    case 'send-data':
      if (!state.established) return state
      return sendData(state)

    case 'close':
      if (!state.established) return state
      return sendFin(state)

    case 'close-step': {
      if (state.phase === 'fin-sent') return sendFinAck(state)
      if (state.phase === 'fin-ack') return sendServerFin(state)
      return state
    }

    case 'final-ack':
      return sendFinalAck(state)

    case 'reset':
      return createInitialTCPState()

    default:
      return state
  }
}

function stateColor(s: string): string {
  switch (s) {
    case 'CLOSED': return '#7A7A6E'
    case 'SYN_SENT': case 'SYN_RECEIVED': return '#3b82f6'
    case 'ESTABLISHED': return '#22c55e'
    case 'FIN_WAIT_1': case 'FIN_WAIT_2': case 'TIME_WAIT': return '#f59e0b'
    case 'CLOSE_WAIT': case 'LAST_ACK': return '#ef4444'
    default: return '#7A7A6E'
  }
}

const CLIENT_X = 200
const SERVER_X = 900
const BOX_Y = 80
const BOX_W = 220
const BOX_H = 100
const LANE_TOP = 200
const LANE_BOT = 520

export function TCPSimulation({ fixModeIndex = -1 }: TCPSimulationProps) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialTCPState)
  const isRunning = useRef(false)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset when fix mode changes
  useEffect(() => {
    isRunning.current = false
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    dispatch({ type: 'reset' })
  }, [fixModeIndex])

  function startTicks() {
    if (!tickRef.current) {
      tickRef.current = setInterval(() => dispatch({ type: 'tick' }), 50)
    }
  }

  // Normal handshake: SYN → SYN-ACK → ACK
  function runNormalHandshake() {
    if (isRunning.current || state.clientState !== 'CLOSED') return
    isRunning.current = true
    startTicks()
    dispatch({ type: 'connect', fixMode: fixModeIndex })

    setTimeout(() => dispatch({ type: 'step', fixMode: fixModeIndex }), 1000)
    setTimeout(() => dispatch({ type: 'step', fixMode: fixModeIndex }), 2000)
    setTimeout(() => { isRunning.current = false }, 2500)
  }

  // Fix mode 0: SYN timeout with retries
  function runTimeoutHandshake() {
    if (isRunning.current || state.clientState !== 'CLOSED') return
    isRunning.current = true
    startTicks()
    dispatch({ type: 'connect', fixMode: 0 })

    // 3 timeouts with increasing delays (simulating backoff)
    setTimeout(() => dispatch({ type: 'step', fixMode: 0 }), 1200)   // timeout 1
    setTimeout(() => dispatch({ type: 'step', fixMode: 0 }), 2800)   // timeout 2
    setTimeout(() => dispatch({ type: 'step', fixMode: 0 }), 4800)   // timeout 3
    setTimeout(() => { isRunning.current = false }, 5500)
  }

  // Fix mode 1: RST
  function runRstHandshake() {
    if (isRunning.current || state.clientState !== 'CLOSED') return
    isRunning.current = true
    startTicks()
    dispatch({ type: 'connect', fixMode: 1 })

    setTimeout(() => dispatch({ type: 'step', fixMode: 1 }), 1200) // RST
    setTimeout(() => { isRunning.current = false }, 2000)
  }

  // Fix mode 2: Full close sequence
  function runCloseSequence() {
    if (!state.established) return
    isRunning.current = true
    dispatch({ type: 'close' })

    setTimeout(() => dispatch({ type: 'close-step' }), 1000)  // FIN-ACK
    setTimeout(() => dispatch({ type: 'close-step' }), 2000)  // Server FIN
    setTimeout(() => dispatch({ type: 'final-ack' }), 3000)   // Final ACK + TIME_WAIT
    setTimeout(() => { isRunning.current = false }, 3500)
  }

  function handleConnect() {
    if (fixModeIndex === 0) runTimeoutHandshake()
    else if (fixModeIndex === 1) runRstHandshake()
    else runNormalHandshake()
  }

  function handleStep() {
    if (isRunning.current) return
    startTicks()
    if (state.clientState === 'CLOSED') {
      dispatch({ type: 'connect', fixMode: fixModeIndex })
      return
    }
    if (fixModeIndex === 2 && state.established) {
      dispatch({ type: 'close' })
      return
    }
    if (fixModeIndex === 2 && (state.phase === 'fin-sent' || state.phase === 'fin-ack')) {
      dispatch({ type: 'close-step' })
      return
    }
    dispatch({ type: 'step', fixMode: fixModeIndex })
  }

  function handleReset() {
    isRunning.current = false
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    dispatch({ type: 'reset' })
  }

  function getTraceSteps(): LearningTraceStep[] {
    const synDetail = state.clientState === 'CLOSED'
      ? 'Client has not opened a socket yet.'
      : `Client sent SYN with seq=${state.clientSeq - 1}.`
    const serverDetail = state.phase === 'syn-timeout'
      ? `No SYN-ACK arrived; retry count is ${state.retryCount}/3.`
      : state.phase === 'rst-received'
        ? 'Server actively rejected the SYN with RST.'
        : state.serverState === 'SYN_RECEIVED' || state.established
          ? `Server answered with SYN-ACK; server seq=${state.serverSeq}.`
          : 'Server has not accepted the connection yet.'
    const ackDetail = state.established
      ? 'Client ACK completed the 3-way handshake. Data may flow.'
      : 'Client ACK is still pending.'
    const resultDetail = state.phase === 'time-wait'
      ? 'Connection is closed; initiator waits in TIME-WAIT for delayed packets.'
      : state.phase === 'rst-received'
        ? 'The connection failed fast. Application sees connection refused.'
        : state.established
          ? 'Socket is established and can send application data.'
          : 'Socket is not established yet.'

    return [
      { title: '1. SYN', detail: synDetail, meta: `client=${state.clientState}`, color: '#3b82f6' },
      { title: '2. SYN-ACK / RST', detail: serverDetail, meta: `server=${state.serverState}`, color: state.phase === 'rst-received' ? '#ef4444' : '#3b82f6' },
      { title: '3. ACK', detail: ackDetail, meta: `phase=${state.phase}`, color: state.established ? '#22c55e' : '#f59e0b' },
      { title: '4. Consequence', detail: resultDetail, meta: state.lastOp, color: state.established ? '#22c55e' : state.phase === 'rst-received' ? '#ef4444' : '#f59e0b' },
    ]
  }

  const controls = (
    <>
      <button
        onClick={handleStep}
        disabled={state.phase === 'time-wait' || state.phase === 'rst-received'}
        className="retro-btn text-xs px-3 py-1 disabled:opacity-50"
      >
        STEP
      </button>
      <button
        onClick={handleConnect}
        disabled={state.clientState !== 'CLOSED'}
        className="retro-btn text-xs px-3 py-1 disabled:opacity-50"
      >
        AUTO
      </button>

      {fixModeIndex === 2 || fixModeIndex === -1 ? (
        <>
          <button
            onClick={() => dispatch({ type: 'send-data' })}
            disabled={!state.established}
            className="retro-btn text-xs px-3 py-1 disabled:opacity-50"
          >
            SEND DATA
          </button>
          <button
            onClick={runCloseSequence}
            disabled={!state.established}
            className="retro-btn retro-btn--accent text-xs px-3 py-1 disabled:opacity-50"
          >
            CLOSE
          </button>
        </>
      ) : null}

      <button onClick={handleReset} className="retro-btn text-xs px-3 py-1">
        RESET
      </button>
    </>
  )

  const stateBody = (
    <div className="space-y-1">
      <div>Client state: <span style={{ color: stateColor(state.clientState) }}>{state.clientState}</span></div>
      <div>Server state: <span style={{ color: stateColor(state.serverState) }}>{state.serverState}</span></div>
      <div>Client seq: {state.clientSeq}; server seq: {state.serverSeq}</div>
      <div>Retries: {state.retryCount}; data packets: {state.dataPacketsSent}</div>
    </div>
  )

  return (
    <LearningModuleShell
      visual={(
        <div className="flex h-full items-center justify-center overflow-hidden px-4">
        <svg viewBox="0 0 1100 580" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
          <rect width="1100" height="580" fill="#F0F0E8" />

          {/* Title */}
          <text x="550" y="30" fill="#2A2A28" fontSize="14" fontWeight="bold" fontFamily="'Press Start 2P', monospace" textAnchor="middle" letterSpacing="0.05em">
            TCP 3-WAY HANDSHAKE
          </text>
          <text x="550" y="50" fill="#7A7A6E" fontSize="10" fontFamily="'Space Mono', monospace" textAnchor="middle">
            {fixModeIndex === 0 ? 'SYN Timeout & Retry' : fixModeIndex === 1 ? 'Connection Reset (RST)' : fixModeIndex === 2 ? 'Connection Close & TIME-WAIT' : 'Connection Establishment'}
          </text>

          {/* CLIENT BOX */}
          <rect x={CLIENT_X - BOX_W / 2} y={BOX_Y} width={BOX_W} height={BOX_H} rx="4"
            fill="#F0F0E8" stroke={stateColor(state.clientState)} strokeWidth="2" />
          <rect x={CLIENT_X - BOX_W / 2} y={BOX_Y} width={BOX_W} height="20" rx="4"
            fill={stateColor(state.clientState)} opacity="0.15" />
          <text x={CLIENT_X} y={BOX_Y + 14} fill={stateColor(state.clientState)} fontSize="8" fontFamily="'Press Start 2P', monospace" textAnchor="middle">CLIENT</text>
          <text x={CLIENT_X} y={BOX_Y + 45} fill="#2A2A28" fontSize="12" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">{state.clientState}</text>
          <text x={CLIENT_X} y={BOX_Y + 65} fill="#7A7A6E" fontSize="10" fontFamily="'Space Mono', monospace" textAnchor="middle">seq={state.clientSeq}</text>
          <text x={CLIENT_X} y={BOX_Y + 85} fill="#B0B09A" fontSize="9" fontFamily="'Space Mono', monospace" textAnchor="middle">:49152 (ephemeral)</text>

          {/* SERVER BOX */}
          <rect x={SERVER_X - BOX_W / 2} y={BOX_Y} width={BOX_W} height={BOX_H} rx="4"
            fill="#F0F0E8" stroke={stateColor(state.serverState)} strokeWidth="2" />
          <rect x={SERVER_X - BOX_W / 2} y={BOX_Y} width={BOX_W} height="20" rx="4"
            fill={stateColor(state.serverState)} opacity="0.15" />
          <text x={SERVER_X} y={BOX_Y + 14} fill={stateColor(state.serverState)} fontSize="8" fontFamily="'Press Start 2P', monospace" textAnchor="middle">SERVER</text>
          <text x={SERVER_X} y={BOX_Y + 45} fill="#2A2A28" fontSize="12" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">{state.serverState}</text>
          <text x={SERVER_X} y={BOX_Y + 65} fill="#7A7A6E" fontSize="10" fontFamily="'Space Mono', monospace" textAnchor="middle">seq={state.serverSeq}</text>
          <text x={SERVER_X} y={BOX_Y + 85} fill="#B0B09A" fontSize="9" fontFamily="'Space Mono', monospace" textAnchor="middle">:443 (HTTPS)</text>

          {/* TIMELINE LANES */}
          <line x1={CLIENT_X} y1={BOX_Y + BOX_H} x2={CLIENT_X} y2={LANE_BOT + 30} stroke="#B0B09A" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={SERVER_X} y1={BOX_Y + BOX_H} x2={SERVER_X} y2={LANE_BOT + 30} stroke="#B0B09A" strokeWidth="1" strokeDasharray="4 4" />

          <text x="550" y={LANE_TOP - 10} fill="#B0B09A" fontSize="8" fontFamily="'Press Start 2P', monospace" textAnchor="middle">PACKET TIMELINE</text>

          {/* PACKETS */}
          {state.packets.map((pkt, i) => {
            const fromX = pkt.from === 'client' ? CLIENT_X : SERVER_X
            const toX = pkt.from === 'client' ? SERVER_X : CLIENT_X
            const y = LANE_TOP + i * 38
            const x = fromX + (toX - fromX) * Math.min(pkt.progress, 1)
            const opacity = pkt.progress > 1 ? Math.max(0, 1.2 - pkt.progress) : 1
            const arrived = pkt.progress >= 1

            return (
              <g key={pkt.id} opacity={opacity}>
                <line x1={fromX} y1={y} x2={arrived ? toX : x} y2={y}
                  stroke={pkt.color} strokeWidth="1.5" opacity={0.4}
                  strokeDasharray={arrived ? 'none' : '4 3'} />
                {arrived && (
                  <polygon
                    points={pkt.from === 'client'
                      ? `${toX},${y} ${toX - 8},${y - 4} ${toX - 8},${y + 4}`
                      : `${toX},${y} ${toX + 8},${y - 4} ${toX + 8},${y + 4}`}
                    fill={pkt.color}
                  />
                )}
                <circle cx={x} cy={y} r={6} fill={pkt.color} />
                <rect x={(fromX + toX) / 2 - 70} y={y - 18} width="140" height="16" rx="3"
                  fill="#D0CEBA" stroke={pkt.color} strokeWidth="1" opacity={0.9} />
                <text x={(fromX + toX) / 2} y={y - 7} fill={pkt.color} fontSize="8"
                  fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">
                  {pkt.label}
                </text>
              </g>
            )
          })}

          {/* Status indicators */}
          {state.established && (
            <g>
              <rect x="380" y={LANE_BOT + 10} width="240" height="30" rx="4" fill="#22c55e" opacity="0.15" stroke="#22c55e" strokeWidth="1" />
              <text x="500" y={LANE_BOT + 30} fill="#22c55e" fontSize="10" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">CONNECTION ESTABLISHED</text>
            </g>
          )}
          {state.phase === 'rst-received' && (
            <g>
              <rect x="380" y={LANE_BOT + 10} width="240" height="30" rx="4" fill="#ef4444" opacity="0.15" stroke="#ef4444" strokeWidth="1" />
              <text x="500" y={LANE_BOT + 30} fill="#ef4444" fontSize="10" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">CONNECTION REFUSED (RST)</text>
            </g>
          )}
          {state.phase === 'time-wait' && (
            <g>
              <rect x="350" y={LANE_BOT + 10} width="300" height="30" rx="4" fill="#f59e0b" opacity="0.15" stroke="#f59e0b" strokeWidth="1" />
              <text x="500" y={LANE_BOT + 30} fill="#f59e0b" fontSize="10" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">TIME_WAIT — 2×MSL (60s typical)</text>
            </g>
          )}
          {state.phase === 'syn-timeout' && (
            <g>
              <rect x="350" y={LANE_BOT + 10} width="300" height="30" rx="4" fill="#f59e0b" opacity="0.15" stroke="#f59e0b" strokeWidth="1" />
              <text x="500" y={LANE_BOT + 30} fill="#f59e0b" fontSize="10" fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="bold">SYN TIMEOUT — retries: {state.retryCount}/3</text>
            </g>
          )}

          {/* Status text */}
          <text x="16" y="570" fill="#D4654A" fontSize="10" fontFamily="'Space Mono', monospace" fontWeight="bold">
            {state.lastOp}
          </text>
        </svg>
        </div>
      )}
      traceTitle="PACKET STATE TRACE"
      traceMeta={state.lastOp}
      traceSteps={getTraceSteps()}
      stateTitle="WHAT TCP RECORDS"
      stateBody={stateBody}
      eventsTitle="PACKET LOG"
      events={state.packets.slice(-6).map(pkt => ({
        id: pkt.id,
        text: `${pkt.from.toUpperCase()} -> ${(pkt.from === 'client' ? 'server' : 'client').toUpperCase()} ${pkt.label}`,
        color: pkt.color,
      }))}
      emptyEventText="Step once to send SYN and watch the connection state begin."
      latestKey={`${state.clientState} -> ${state.serverState}`}
      controls={controls}
      minVisualHeight={260}
    />
  )
}
