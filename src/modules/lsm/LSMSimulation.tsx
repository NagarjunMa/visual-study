import { useState, useReducer } from 'react'
import { motion } from 'framer-motion'
import type { Stage } from '../../simulation/types'
import type { LSMState } from './lsm.types'
import { createInitialLSMState, lsmWrite, lsmDelete, lsmGet, lsmFlush, lsmCompact } from './LSMEngine'

interface LSMSimulationProps {
  stage?: Stage
  fixModeIndex?: number
}

type LSMAction =
  | { type: 'set'; key: string; value: string }
  | { type: 'get'; key: string }
  | { type: 'delete'; key: string }
  | { type: 'flush' }
  | { type: 'compact'; level: number }
  | { type: 'clear' }

const initialState = createInitialLSMState(5)

function lsmReducer(state: LSMState, action: LSMAction): LSMState {
  switch (action.type) {
    case 'set': {
      return lsmWrite(state, action.key, action.value)
    }
    case 'get': {
      return state
    }
    case 'delete': {
      return lsmDelete(state, action.key)
    }
    case 'flush': {
      return lsmFlush(state)
    }
    case 'compact': {
      return lsmCompact(state, action.level)
    }
    case 'clear': {
      return createInitialLSMState(state.memtableCapacity)
    }
    default:
      return state
  }
}

export function LSMSimulation({}: LSMSimulationProps) {
  const [state, dispatch] = useReducer(lsmReducer, initialState)
  const [inputKey, setInputKey] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [message, setMessage] = useState('')

  const handleSet = () => {
    if (!inputKey.trim() || !inputValue.trim()) return
    dispatch({ type: 'set', key: inputKey, value: inputValue })
    setMessage(`SET ${inputKey}="${inputValue}" → Memtable`)
    setInputKey('')
    setInputValue('')
  }

  const handleGet = () => {
    if (!inputKey.trim()) return
    const result = lsmGet(state, inputKey)
    if (result.found) {
      setMessage(`GET ${inputKey} → "${result.value}" (from ${result.source})`)
    } else {
      setMessage(`GET ${inputKey} → not found (${result.source})`)
    }
  }

  const handleDelete = () => {
    if (!inputKey.trim()) return
    dispatch({ type: 'delete', key: inputKey })
    setMessage(`DEL ${inputKey} → Tombstone written`)
    setInputKey('')
  }

  const memtableUsed = state.memtable.length
  const memtablePct = (memtableUsed / state.memtableCapacity) * 100

  return (
    <div className="w-full h-full bg-gray-950 flex flex-col overflow-hidden">
      {/* SVG Visualization */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4">
        <svg viewBox="0 0 1200 580" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
          <rect width="1200" height="580" fill="#030712" />

          {/* WAL Panel (left) */}
          <g>
            <text x="20" y="25" fill="#22c55e" fontSize="13" fontWeight="bold" fontFamily="monospace">
              WAL
            </text>
            <rect x="12" y="35" width="140" height="520" rx="4" fill="#1f2937" stroke="#4b5563" strokeWidth="1" />
            {state.wal.slice(-10).map((entry, i) => (
              <text
                key={i}
                x="20"
                y={55 + i * 45}
                fill="#94a3b8"
                fontSize="9"
                fontFamily="monospace"
              >
                &gt; {entry.slice(0, 18)}
              </text>
            ))}
          </g>

          {/* Memtable Panel (center) */}
          <g>
            <text x="170" y="25" fill="#22c55e" fontSize="13" fontWeight="bold" fontFamily="monospace">
              MEMTABLE
            </text>
            {/* Capacity bar */}
            <rect x="170" y="35" width="200" height="20" rx="3" fill="#1f2937" stroke="#4b5563" strokeWidth="1" />
            <motion.rect
              x="173"
              y="38"
              height="14"
              rx="2"
              fill={memtablePct > 80 ? '#ef4444' : memtablePct > 50 ? '#f59e0b' : '#22c55e'}
              animate={{ width: Math.min((memtableUsed / state.memtableCapacity) * 194, 194) }}
              transition={{ duration: 0.3 }}
            />
            <text x="378" y="47" fill="#9ca3af" fontSize="9" fontFamily="monospace">
              {memtableUsed}/{state.memtableCapacity}
            </text>

            {/* Entries */}
            {state.memtable.map((entry, i) => (
              <motion.g key={`mem-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <rect
                  x="170"
                  y={60 + i * 28}
                  width="200"
                  height="24"
                  rx="2"
                  fill="#1f2937"
                  stroke={entry.tombstone ? '#dc2626' : '#0ea5e9'}
                  strokeWidth="1"
                />
                <text
                  x="178"
                  y={76 + i * 28}
                  fill={entry.tombstone ? '#fca5a5' : '#38bdf8'}
                  fontSize="9"
                  fontFamily="monospace"
                  textDecoration={entry.tombstone ? 'line-through' : 'none'}
                >
                  {entry.key}={entry.value || 'DELETED'}
                </text>
              </motion.g>
            ))}
          </g>

          {/* L0 SSTables */}
          <g>
            <text x="170" y="280" fill="#22c55e" fontSize="12" fontWeight="bold" fontFamily="monospace">
              Level 0 ({state.sstables[0].length})
            </text>
            {state.sstables[0].map((sstable, idx) => (
              <g key={`l0-${idx}`}>
                <rect x={170 + idx * 140} y="300" width="130" height="100" rx="3" fill="#1f2937" stroke="#0ea5e9" strokeWidth="1" />
                <text x={180 + idx * 140} y="320" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  {sstable.id}
                </text>
                <text x={180 + idx * 140} y="338" fill="#9ca3af" fontSize="8" fontFamily="monospace">
                  {sstable.entries.length} keys
                </text>
                {/* Bloom filter */}
                <text x={180 + idx * 140} y="355" fill="#9ca3af" fontSize="8" fontFamily="monospace">
                  Bloom:
                </text>
                {sstable.bloomFilter.bits.map((bit, b) => (
                  <rect
                    key={b}
                    x={180 + idx * 140 + b * 8}
                    y="360"
                    width="6"
                    height="6"
                    rx="1"
                    fill={bit ? '#22c55e' : '#4b5563'}
                  />
                ))}
              </g>
            ))}
          </g>

          {/* L1 SSTables */}
          <g>
            <text x="170" y="435" fill="#22c55e" fontSize="12" fontWeight="bold" fontFamily="monospace">
              Level 1 ({state.sstables[1]?.length || 0})
            </text>
            {state.sstables[1]?.map((sstable, idx) => (
              <g key={`l1-${idx}`}>
                <rect x={170 + idx * 160} y="455" width="150" height="80" rx="3" fill="#1f2937" stroke="#f59e0b" strokeWidth="1" />
                <text x={180 + idx * 160} y="475" fill="#fcd34d" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  {sstable.id}
                </text>
                <text x={180 + idx * 160} y="492" fill="#9ca3af" fontSize="8" fontFamily="monospace">
                  {sstable.entries.length} keys
                </text>
                {sstable.bloomFilter.bits.map((bit, b) => (
                  <rect
                    key={b}
                    x={180 + idx * 160 + b * 8}
                    y="500"
                    width="6"
                    height="6"
                    rx="1"
                    fill={bit ? '#22c55e' : '#4b5563'}
                  />
                ))}
              </g>
            ))}
          </g>

          {/* Status */}
          {message && (
            <text x="170" y="570" fill="#f97316" fontSize="11" fontFamily="monospace" fontWeight="bold">
              {message}
            </text>
          )}
        </svg>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-700 p-4 space-y-3">
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
            disabled={!inputKey.trim() || !inputValue.trim()}
            className="px-3 py-1 bg-green-600 text-white text-xs font-pixel rounded disabled:opacity-50"
          >
            SET
          </button>
          <button
            onClick={handleDelete}
            disabled={!inputKey.trim()}
            className="px-3 py-1 bg-red-600 text-white text-xs font-pixel rounded disabled:opacity-50"
          >
            DEL
          </button>
          <button
            onClick={handleGet}
            disabled={!inputKey.trim()}
            className="px-3 py-1 bg-blue-600 text-white text-xs font-pixel rounded disabled:opacity-50"
          >
            GET
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              dispatch({ type: 'flush' })
              setMessage('Flushed Memtable to L0')
            }}
            disabled={state.memtable.length === 0}
            className="px-3 py-1 bg-yellow-600 text-white text-xs font-pixel rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            FLUSH MEMTABLE
          </button>
          <button
            onClick={() => {
              dispatch({ type: 'compact', level: 0 })
              setMessage('Compacted L0 → L1')
            }}
            disabled={state.sstables[0].length < 2}
            className="px-3 py-1 bg-purple-600 text-white text-xs font-pixel rounded hover:bg-purple-700 disabled:opacity-50"
          >
            COMPACT L0
          </button>
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
