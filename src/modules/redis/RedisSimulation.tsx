import { useState, useReducer, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Stage } from '../../simulation/types'
import type { RedisState } from './redis.types'
import { createInitialRedisState, redisSet, redisGet, redisCrash } from './RedisEngine'

interface RedisSimulationProps {
  stage?: Stage
  fixModeIndex?: number
}

type RedisAction =
  | { type: 'set', key: string, value: string }
  | { type: 'get', key: string }
  | { type: 'crash' }
  | { type: 'restart' }
  | { type: 'set-persistence', mode: 'none' | 'rdb' | 'aof' }
  | { type: 'advance-time' }
  | { type: 'clear' }

function getInitialPersistenceMode(fixModeIndex?: number): 'none' | 'rdb' | 'aof' {
  if (fixModeIndex === 0) return 'rdb'       // Fix 1: RDB snapshots
  if (fixModeIndex === 1) return 'aof'       // Fix 2: AOF recovery
  return 'none'                               // Problem: volatile, no persistence
}

function createInitialState(fixModeIndex?: number) {
  return createInitialRedisState(10, getInitialPersistenceMode(fixModeIndex))
}

function redisReducer(state: RedisState, action: RedisAction): RedisState {
  switch (action.type) {
    case 'set': {
      const { newState } = redisSet(state, action.key, action.value)
      return newState
    }
    case 'get': {
      // GET is read-only, doesn't change state
      return state
    }
    case 'crash': {
      const { newState } = redisCrash(state)
      return newState
    }
    case 'restart': {
      // Just mark as restarted - data recovery already happened in crash
      return { ...state, crashed: false }
    }
    case 'set-persistence': {
      return { ...state, persistence: action.mode, rdbSnapshot: [], aofLog: [] }
    }
    case 'advance-time': {
      // Advance time by 1 unit
      return { ...state, currentTime: state.currentTime + 1 }
    }
    case 'clear': {
      return createInitialRedisState(state.capacity, state.persistence)
    }
    default:
      return state
  }
}

export function RedisSimulation({ fixModeIndex }: RedisSimulationProps) {
  const [state, dispatch] = useReducer(redisReducer, createInitialState(fixModeIndex))
  const [inputKey, setInputKey] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [message, setMessage] = useState('')

  // Sync fixModeIndex changes to persistence mode
  useEffect(() => {
    dispatch({ type: 'set-persistence', mode: getInitialPersistenceMode(fixModeIndex) })
  }, [fixModeIndex])

  const handleSet = () => {
    if (!inputKey.trim() || !inputValue.trim()) return
    dispatch({ type: 'set', key: inputKey, value: inputValue })
    setMessage(`SET ${inputKey} = "${inputValue}"`)
    setInputKey('')
    setInputValue('')
  }

  const handleGet = () => {
    if (!inputKey.trim()) return
    const { found, value: retrievedValue } = redisGet(state, inputKey)
    if (found) {
      setMessage(`GET ${inputKey} → "${retrievedValue}"`)
    } else {
      setMessage(`GET ${inputKey} → nil (not found or expired)`)
    }
  }

  const memoryUsed = state.buckets.reduce((sum, b) => sum + b.entries.length, 0)
  const memoryPct = (memoryUsed / state.capacity) * 100

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative" style={{ background: '#F0F0E8' }}>
      {/* SVG Visualization */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4 relative">
        {/* Crash overlay */}
        {state.crashed && (
          <div className="absolute inset-0 bg-red-900 opacity-20 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-red-400 text-2xl font-pixel">⚠ CRASHED</div>
          </div>
        )}
        <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
          {/* Background */}
          <rect width="1200" height="600" fill="#F0F0E8" />

          {/* Memory Bar */}
          <g>
            <rect x="50" y="20" width="400" height="30" rx="4" fill="#E8E6D8" stroke="#B0B09A" strokeWidth="2" />
            <motion.rect
              x="54"
              y="24"
              height="22"
              rx="2"
              fill={memoryPct > 80 ? '#ef4444' : memoryPct > 50 ? '#f59e0b' : '#22c55e'}
              animate={{ width: Math.min((memoryUsed / state.capacity) * 392, 392) }}
              transition={{ duration: 0.3 }}
            />
            <text x="500" y="40" fill="#7A7A6E" fontSize="12" fontFamily="monospace">
              Memory: {memoryUsed}/{state.capacity} ({memoryPct.toFixed(0)}%)
            </text>
          </g>

          {/* Hash Table (8 buckets) */}
          <g>
            <text x="50" y="80" fill="#22c55e" fontSize="14" fontWeight="bold" fontFamily="monospace">
              Hash Table (8 buckets)
            </text>

            {state.buckets.map((bucket, bucketIdx) => (
              <g key={`bucket-${bucketIdx}`}>
                {/* Bucket label */}
                <text
                  x="50"
                  y={110 + bucketIdx * 50}
                  fill="#7A7A6E"
                  fontSize="11"
                  fontFamily="monospace"
                >{`B${bucketIdx}:`}</text>

                {/* Entries in bucket */}
                {bucket.entries.map((entry, entryIdx) => (
                  <motion.g
                    key={`entry-${bucketIdx}-${entryIdx}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Entry box */}
                    <rect
                      x={80 + entryIdx * 130}
                      y={100 + bucketIdx * 50}
                      width="120"
                      height="28"
                      rx="3"
                      fill="#E8E6D8"
                      stroke="#0ea5e9"
                      strokeWidth="1"
                    />
                    {/* Entry content */}
                    <text
                      x={90 + entryIdx * 130}
                      y={100 + bucketIdx * 50 + 18}
                      fill="#38bdf8"
                      fontSize="10"
                      fontFamily="monospace"
                    >{`${entry.key}=${entry.value}`}</text>

                    {/* TTL badge */}
                    {entry.ttl !== null && (
                      <text
                        x={200 + entryIdx * 130}
                        y={100 + bucketIdx * 50 + 18}
                        fill="#fca5a5"
                        fontSize="8"
                        fontFamily="monospace"
                      >{`TTL:${Math.max(0, Math.floor((entry.ttl - state.currentTime) / 1000))}s`}</text>
                    )}
                  </motion.g>
                ))}
              </g>
            ))}
          </g>

          {/* LRU List */}
          <g>
            <text x="50" y="520" fill="#22c55e" fontSize="14" fontWeight="bold" fontFamily="monospace">
              LRU Chain (MRU → LRU)
            </text>

            {/* Draw linked list */}
            {state.lruHead && (
              <LRUChainRenderer
                lruMap={state.lruMap}
                head={state.lruHead}
                startX={50}
                y={555}
              />
            )}

            {!state.lruHead && (
              <text x="50" y="555" fill="#7A7A6E" fontSize="12" fontFamily="monospace">
                (empty)
              </text>
            )}
          </g>

          {/* Status message */}
          {message && (
            <text
              x="50"
              y="590"
              fill="#f97316"
              fontSize="12"
              fontFamily="monospace"
              fontWeight="bold"
            >{message}</text>
          )}
        </svg>
      </div>

      {/* Controls Panel */}
      <div className="border-t p-4 space-y-3" style={{ background: '#E8E6D8', borderColor: '#B0B09A' }}>
        {/* Persistence Mode */}
        <div className="flex gap-4 items-center">
          <label className="text-xs font-pixel text-amber-500 uppercase">Persistence:</label>
          <button
            onClick={() => dispatch({ type: 'set-persistence', mode: 'none' })}
            className={`px-2 py-1 text-xs font-pixel ${
              state.persistence === 'none' ? 'bg-red-600 text-white' : 'bg-gray-300 text-gray-700'
            }`}
          >
            None (RAM only)
          </button>
          <button
            onClick={() => dispatch({ type: 'set-persistence', mode: 'rdb' })}
            className={`px-2 py-1 text-xs font-pixel ${
              state.persistence === 'rdb' ? 'bg-yellow-600 text-white' : 'bg-gray-300 text-gray-700'
            }`}
          >
            RDB (snapshots)
          </button>
          <button
            onClick={() => dispatch({ type: 'set-persistence', mode: 'aof' })}
            className={`px-2 py-1 text-xs font-pixel ${
              state.persistence === 'aof' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'
            }`}
          >
            AOF (full log)
          </button>
        </div>

        {/* Input Fields */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: '#7A7A6E' }}>Key</label>
            <input
              type="text"
              value={inputKey}
              onChange={e => setInputKey(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && inputValue) handleSet()
              }}
              disabled={state.crashed}
              placeholder="user:1"
              className="w-full px-2 py-1 border text-xs font-monospace rounded disabled:opacity-50"
              style={{ background: '#F0F0E8', borderColor: '#B0B09A', color: '#2A2A28' }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: '#7A7A6E' }}>Value</label>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSet()
              }}
              disabled={state.crashed}
              placeholder="Alice"
              className="w-full px-2 py-1 border text-xs font-monospace rounded disabled:opacity-50"
              style={{ background: '#F0F0E8', borderColor: '#B0B09A', color: '#2A2A28' }}
            />
          </div>
          <button
            onClick={handleSet}
            disabled={!inputKey.trim() || !inputValue.trim() || state.crashed}
            className="px-3 py-1 bg-green-600 text-white text-xs font-pixel rounded disabled:opacity-50"
          >
            SET
          </button>
          <button
            onClick={handleGet}
            disabled={!inputKey.trim() || state.crashed}
            className="px-3 py-1 bg-blue-600 text-white text-xs font-pixel rounded disabled:opacity-50"
          >
            GET
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              const result = redisCrash(state)
              dispatch({ type: 'crash' })
              setMessage(`SERVER CRASHED! ${result.recovered.mode}: ${result.recovered.count} keys recovered`)
            }}
            className="px-3 py-1 bg-red-600 text-white text-xs font-pixel rounded hover:bg-red-700"
          >
            🔴 CRASH
          </button>
          {state.crashed && (
            <button
              onClick={() => {
                dispatch({ type: 'restart' })
                setMessage('Server restarted. All systems online.')
              }}
              className="px-3 py-1 bg-green-600 text-white text-xs font-pixel rounded hover:bg-green-700"
            >
              ▶ Restart
            </button>
          )}
          <button
            onClick={() => {
              dispatch({ type: 'clear' })
              setMessage('Cleared all data')
            }}
            className="px-3 py-1 bg-gray-400 text-xs font-pixel rounded hover:bg-gray-500" style={{ color: '#2A2A28' }}
          >
            Clear
          </button>
        </div>

        {/* Persistence State Panel */}
        <div className="rounded p-2 text-xs font-monospace space-y-1 max-h-32 overflow-auto" style={{ background: '#F0F0E8', color: '#2A2A28' }}>
          {state.persistence === 'none' && (
            <div className="text-red-400">
              💾 Persistence: NONE (RAM only)
            </div>
          )}
          {state.persistence === 'rdb' && (
            <div className="space-y-1">
              <div className="text-yellow-400">💾 RDB Snapshots: {state.rdbSnapshot.length} keys</div>
              {state.rdbSnapshot.length > 0 && (
                <div className="ml-2" style={{ color: '#7A7A6E' }}>Last: {state.rdbSnapshot.slice(0, 2).map(e => e.key).join(', ')}{state.rdbSnapshot.length > 2 ? '...' : ''}</div>
              )}
            </div>
          )}
          {state.persistence === 'aof' && (
            <div className="space-y-1">
              <div className="text-green-400">📝 AOF Log: {state.aofLog.length} commands</div>
              {state.aofLog.length > 0 && (
                <div className="ml-2 max-h-16 overflow-y-auto" style={{ color: '#7A7A6E' }}>
                  {state.aofLog.slice(-3).map((cmd, i) => (
                    <div key={i}>&gt; {cmd}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LRUChainRenderer({
  lruMap,
  head,
  startX,
  y,
}: {
  lruMap: Map<string, { prev: string | null; next: string | null }>
  head: string | null
  startX: number
  y: number
}) {
  const nodes: string[] = []
  let current = head
  while (current) {
    nodes.push(current)
    const node = lruMap.get(current)
    current = node?.next || null
  }

  return (
    <g>
      {nodes.map((key, idx) => (
        <g key={`lru-${key}`}>
          {/* Box */}
          <rect x={startX + idx * 100} y={y} width="85" height="25" rx="3" fill="#E8E6D8" stroke="#fbbf24" strokeWidth="1" />
          {/* Label */}
          <text
            x={startX + idx * 100 + 43}
            y={y + 16}
            fill="#fcd34d"
            fontSize="9"
            fontFamily="monospace"
            textAnchor="middle"
          >{key}</text>

          {/* Arrow to next */}
          {idx < nodes.length - 1 && (
            <>
              <line
                x1={startX + idx * 100 + 85}
                y1={y + 12}
                x2={startX + (idx + 1) * 100}
                y2={y + 12}
                stroke="#7A7A6E"
                strokeWidth="1"
              />
              <polygon
                points={`${startX + (idx + 1) * 100},${y + 12} ${startX + (idx + 1) * 100 - 4},${y + 10} ${startX + (idx + 1) * 100 - 4},${
                  y + 14
                }`}
                fill="#7A7A6E"
              />
            </>
          )}
        </g>
      ))}

      {/* MRU/LRU labels */}
      <text x={startX} y={y - 8} fill="#7A7A6E" fontSize="9" fontFamily="monospace">
        MRU
      </text>
      <text x={startX + nodes.length * 100 - 30} y={y - 8} fill="#7A7A6E" fontSize="9" fontFamily="monospace">
        LRU
      </text>
    </g>
  )
}
