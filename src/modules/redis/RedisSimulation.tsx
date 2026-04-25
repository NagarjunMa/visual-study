import { useState, useReducer } from 'react'
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

const initialState = createInitialRedisState(10, 'none')

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
      const { newState } = redisCrash(state)
      return { ...newState, crashed: false }
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

export function RedisSimulation({}: RedisSimulationProps) {
  const [state, dispatch] = useReducer(redisReducer, initialState)
  const [inputKey, setInputKey] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [message, setMessage] = useState('')

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
    <div className="w-full h-full bg-gray-950 flex flex-col overflow-hidden">
      {/* SVG Visualization */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4">
        <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
          {/* Background */}
          <rect width="1200" height="600" fill="#030712" />

          {/* Memory Bar */}
          <g>
            <rect x="50" y="20" width="400" height="30" rx="4" fill="#1f2937" stroke="#4b5563" strokeWidth="2" />
            <motion.rect
              x="54"
              y="24"
              height="22"
              rx="2"
              fill={memoryPct > 80 ? '#ef4444' : memoryPct > 50 ? '#f59e0b' : '#22c55e'}
              animate={{ width: Math.min((memoryUsed / state.capacity) * 392, 392) }}
              transition={{ duration: 0.3 }}
            />
            <text x="500" y="40" fill="#9ca3af" fontSize="12" fontFamily="monospace">
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
                  fill="#94a3b8"
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
                      fill="#1f2937"
                      stroke="#0ea5e9"
                      strokeWidth="1"
                    />
                    {/* Entry content */}
                    <text
                      x={90 + entryIdx * 130}
                      y={118}
                      fill="#38bdf8"
                      fontSize="10"
                      fontFamily="monospace"
                    >{`${entry.key}=${entry.value}`}</text>

                    {/* TTL badge */}
                    {entry.ttl !== null && (
                      <text
                        x={200 + entryIdx * 130}
                        y={118}
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
                lruOrder={state.lruOrder}
                head={state.lruHead}
                startX={50}
                y={555}
              />
            )}

            {!state.lruHead && (
              <text x="50" y="555" fill="#666" fontSize="12" fontFamily="monospace">
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
      <div className="bg-gray-900 border-t border-gray-700 p-4 space-y-3">
        {/* Persistence Mode */}
        <div className="flex gap-4 items-center">
          <label className="text-xs font-pixel text-amber-500 uppercase">Persistence:</label>
          <button
            onClick={() => dispatch({ type: 'set-persistence', mode: 'none' })}
            className={`px-2 py-1 text-xs font-pixel ${
              state.persistence === 'none' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            None (RAM only)
          </button>
          <button
            onClick={() => dispatch({ type: 'set-persistence', mode: 'rdb' })}
            className={`px-2 py-1 text-xs font-pixel ${
              state.persistence === 'rdb' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            RDB (snapshots)
          </button>
          <button
            onClick={() => dispatch({ type: 'set-persistence', mode: 'aof' })}
            className={`px-2 py-1 text-xs font-pixel ${
              state.persistence === 'aof' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            AOF (full log)
          </button>
        </div>

        {/* Input Fields */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Key</label>
            <input
              type="text"
              value={inputKey}
              onChange={e => setInputKey(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && inputValue) handleSet()
              }}
              placeholder="user:1"
              className="w-full px-2 py-1 bg-gray-800 border border-gray-600 text-gray-100 text-xs font-monospace rounded"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Value</label>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSet()
              }}
              placeholder="Alice"
              className="w-full px-2 py-1 bg-gray-800 border border-gray-600 text-gray-100 text-xs font-monospace rounded"
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
              dispatch({ type: 'crash' })
              setMessage('SERVER CRASHED! Data lost (depends on persistence mode)')
            }}
            className="px-3 py-1 bg-red-600 text-white text-xs font-pixel rounded hover:bg-red-700"
          >
            🔴 CRASH
          </button>
          {state.crashed && (
            <button
              onClick={() => {
                dispatch({ type: 'restart' })
                setMessage('Server restarted. Recovery depends on persistence mode.')
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
            className="px-3 py-1 bg-gray-600 text-white text-xs font-pixel rounded hover:bg-gray-700"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}

function LRUChainRenderer({
  lruOrder,
  head,
  startX,
  y,
}: {
  lruOrder: Map<string, any>
  head: string | null
  startX: number
  y: number
}) {
  const nodes: string[] = []
  let current = head
  while (current) {
    nodes.push(current)
    const node = lruOrder.get(current)
    current = node?.next || null
  }

  return (
    <g>
      {nodes.map((key, idx) => (
        <g key={`lru-${key}`}>
          {/* Box */}
          <rect x={startX + idx * 100} y={y} width="85" height="25" rx="3" fill="#1f2937" stroke="#fbbf24" strokeWidth="1" />
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
                stroke="#666"
                strokeWidth="1"
              />
              <polygon
                points={`${startX + (idx + 1) * 100},${y + 12} ${startX + (idx + 1) * 100 - 4},${y + 10} ${startX + (idx + 1) * 100 - 4},${
                  y + 14
                }`}
                fill="#666"
              />
            </>
          )}
        </g>
      ))}

      {/* MRU/LRU labels */}
      <text x={startX} y={y - 8} fill="#888" fontSize="9" fontFamily="monospace">
        MRU
      </text>
      <text x={startX + nodes.length * 100 - 30} y={y - 8} fill="#888" fontSize="9" fontFamily="monospace">
        LRU
      </text>
    </g>
  )
}
