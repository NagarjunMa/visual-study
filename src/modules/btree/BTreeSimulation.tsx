import { useState, useReducer } from 'react'
import { motion } from 'framer-motion'
import { LearningModuleShell, type LearningTraceStep } from '../../components/LearningModuleShell'
import type { Stage } from '../../simulation/types'
import type { BTreeState } from './btree.types'
import { createInitialBTreeState, btreeInsert, btreeSearch, btreeRangeScan } from './BTreeEngine'

interface BTreeSimulationProps {
  stage?: Stage
  fixModeIndex?: number
}

type BTreeAction =
  | { type: 'insert'; key: number }
  | { type: 'search'; key: number }
  | { type: 'clear' }

const initialState = createInitialBTreeState()

function btreeReducer(state: BTreeState, action: BTreeAction): BTreeState {
  switch (action.type) {
    case 'insert': {
      return btreeInsert(state, action.key)
    }
    case 'search': {
      return state
    }
    case 'clear': {
      return createInitialBTreeState()
    }
    default:
      return state
  }
}

const NODE_WIDTH = 150
const KEY_SLOT = 45
const LEVEL_HEIGHT = 130
const TOP_MARGIN = 60
const SVG_WIDTH = 1100
const LEAF_MARGIN = 80

function computeLayout(state: BTreeState): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {}

  // Step 1: collect leaves in sorted order (leftmost path → rightLink chain)
  const leaves: string[] = []
  let cur: string | null = state.rootId
  while (cur && !state.pages[cur].isLeaf) {
    cur = state.pages[cur].children[0]
  }
  while (cur) {
    leaves.push(cur)
    cur = state.pages[cur].rightLink
  }

  // Step 2: position leaves evenly across SVG width
  const leafY = TOP_MARGIN + (state.height - 1) * LEVEL_HEIGHT
  leaves.forEach((id, i) => {
    const x =
      leaves.length === 1
        ? SVG_WIDTH / 2
        : LEAF_MARGIN + (i * (SVG_WIDTH - 2 * LEAF_MARGIN)) / (leaves.length - 1)
    pos[id] = { x, y: leafY }
  })

  // Step 3: BFS to get pages by level
  const levels: string[][] = [[state.rootId]]
  while (true) {
    const last = levels[levels.length - 1]
    const next: string[] = []
    for (const id of last) {
      if (!state.pages[id].isLeaf) {
        next.push(...state.pages[id].children)
      }
    }
    if (next.length === 0) break
    levels.push(next)
  }

  // Step 4: position internal nodes bottom-up
  for (let lvl = levels.length - 2; lvl >= 0; lvl--) {
    const y = TOP_MARGIN + lvl * LEVEL_HEIGHT
    for (const id of levels[lvl]) {
      const children = state.pages[id].children
      const childXs = children.map(c => pos[c]?.x ?? 0)
      const x = (childXs[0] + childXs[childXs.length - 1]) / 2
      pos[id] = { x, y }
    }
  }

  return pos
}

export function BTreeSimulation(_props: BTreeSimulationProps) {
  void _props
  const [state, dispatch] = useReducer(btreeReducer, initialState)
  const [inputKey, setInputKey] = useState('')
  const [rangeLoInput, setRangeLoInput] = useState('')
  const [rangeHiInput, setRangeHiInput] = useState('')
  const [message, setMessage] = useState('')

  const handleInsert = () => {
    const key = parseInt(inputKey, 10)
    if (isNaN(key)) return
    dispatch({ type: 'insert', key })
    setMessage(`Inserted ${key}`)
    setInputKey('')
  }

  const handleSearch = () => {
    const key = parseInt(inputKey, 10)
    if (isNaN(key)) return
    const result = btreeSearch(state, key)
    setMessage(result.found ? `Found ${key} at ${result.location}` : `Key ${key} not found`)
  }

  const handleRangeScan = () => {
    const lo = parseInt(rangeLoInput, 10)
    const hi = parseInt(rangeHiInput, 10)
    if (isNaN(lo) || isNaN(hi)) return
    const result = btreeRangeScan(state, lo, hi)
    setMessage(`Range [${lo}, ${hi}]: ${result.keys.join(', ') || 'empty'}`)
  }

  const renderPage = (pageId: string, positions: Record<string, { x: number; y: number }>) => {
    const page = state.pages[pageId]
    const pos = positions[pageId]
    if (!pos) return null

    const boxWidth = Math.max(NODE_WIDTH, page.keys.length * KEY_SLOT)

    return (
      <g key={pageId}>
        <motion.rect
          x={pos.x - boxWidth / 2}
          y={pos.y}
          width={boxWidth}
          height="50"
          rx="3"
          fill={page.isLeaf ? '#D0CEBA' : '#D0CEBA'}
          stroke={page.isLeaf ? '#0284c7' : '#d97706'}
          strokeWidth="2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        />

        {page.keys.map((key, i) => (
          <motion.text
            key={`key-${i}`}
            x={pos.x - boxWidth / 2 + i * KEY_SLOT + KEY_SLOT / 2}
            y={pos.y + 32}
            fill={page.isLeaf ? '#38bdf8' : '#d97706'}
            fontSize="14"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 * i }}
          >
            {key}
          </motion.text>
        ))}

        {page.isLeaf &&
          page.ctids.map((ctid, i) => (
            <text
              key={`ctid-${i}`}
              x={pos.x - boxWidth / 2 + i * KEY_SLOT + KEY_SLOT / 2}
              y={pos.y + 68}
              fill="#7A7A6E"
              fontSize="8"
              fontFamily="monospace"
              textAnchor="middle"
            >
              ({ctid})
            </text>
          ))}

        {!page.isLeaf &&
          page.children.map((childId, i) => {
            const childPos = positions[childId]
            if (!childPos) return null
            const slotX = pos.x - boxWidth / 2 + (i + 0.5) * (boxWidth / page.children.length)
            return (
              <line
                key={`edge-${i}`}
                x1={slotX}
                y1={pos.y + 50}
                x2={childPos.x}
                y2={childPos.y}
                stroke="#B0B09A"
                strokeWidth="1"
              />
            )
          })}

        {page.rightLink && positions[page.rightLink] && (
          <line
            x1={pos.x + boxWidth / 2}
            y1={pos.y + 25}
            x2={positions[page.rightLink].x - boxWidth / 2}
            y2={positions[page.rightLink].y + 25}
            stroke="#16a34a"
            strokeWidth="2"
            markerEnd="url(#arrowgreen)"
          />
        )}
      </g>
    )
  }

  const positions = computeLayout(state)
  const allPageIds = Object.keys(state.pages)
  const leafCount = allPageIds.filter(id => state.pages[id].isLeaf).length
  const traceSteps: LearningTraceStep[] = [
    { title: '1. Traverse', detail: 'Start at root and compare separator keys to choose a child pointer.', meta: `height=${state.height}`, color: '#3b82f6' },
    { title: '2. Leaf Page', detail: 'Search or insert lands in a sorted leaf page with CTID pointers.', meta: `${leafCount} leaf page(s)`, color: '#22c55e' },
    { title: '3. Split If Full', detail: 'When a page exceeds order 3, split and promote the separator key upward.', meta: state.lastOp, color: '#f59e0b' },
    { title: '4. Range Scan', detail: message || 'Leaf right-links let ranges move horizontally without returning to the root.', meta: `${state.insertedKeys.length} inserted key(s)`, color: '#06b6d4' },
  ]

  const stateBody = (
    <div className="space-y-1">
      <div>Root page: {state.rootId}</div>
      <div>Height: {state.height}</div>
      <div>Pages: {allPageIds.length}; leaves: {leafCount}</div>
      <div>Inserted keys: {state.insertedKeys.join(', ') || 'none'}</div>
    </div>
  )

  const events = [
    { id: 'last-op', text: state.lastOp, color: '#f97316' },
    ...(message ? [{ id: 'message', text: message, color: '#3b82f6' }] : []),
  ]

  return (
    <LearningModuleShell
      visual={(
      <div className="h-full flex items-center justify-center overflow-hidden px-4">
        <svg viewBox="0 0 1100 560" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
          <defs>
            <marker id="arrowgreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#16a34a" />
            </marker>
          </defs>
          <rect width="1100" height="560" fill="#F0F0E8" />

          {/* Tree title */}
          <text x="50" y="30" fill="#16a34a" fontSize="14" fontWeight="bold" fontFamily="monospace">
            B+ Tree (Order 3, Height {state.height})
          </text>

          {/* Tree structure */}
          <g>{allPageIds.map(pageId => renderPage(pageId, positions))}</g>

          {/* Status */}
          <g>
            <text x="50" y="520" fill="#f97316" fontSize="11" fontFamily="monospace" fontWeight="bold">
              {state.lastOp}
            </text>
            {message && (
              <text x="50" y="540" fill="#2563eb" fontSize="11" fontFamily="monospace">
                {message}
              </text>
            )}
          </g>
        </svg>
      </div>
      )}
      traceTitle="INDEX OPERATION TRACE"
      traceMeta={state.lastOp}
      traceSteps={traceSteps}
      stateTitle="WHAT THE B+ TREE STORES"
      stateBody={stateBody}
      eventsTitle="TREE EVENT LOG"
      events={events}
      emptyEventText="Insert, search, or range scan to see page-level decisions."
      latestKey={inputKey.trim() || undefined}
      controls={(
        <>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#7A7A6E] mb-1">Key to Insert</label>
            <input
              type="number"
              value={inputKey}
              onChange={e => setInputKey(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleInsert()
              }}
              placeholder="10"
              className="w-full px-2 py-1 border text-xs font-monospace rounded" style={{ background: '#F0F0E8', borderColor: '#B0B09A', color: '#2A2A28' }}
            />
          </div>
          <button
            onClick={handleInsert}
            disabled={!inputKey.trim()}
            className="retro-btn text-xs px-3 py-1 disabled:opacity-50"
          >
            INSERT
          </button>
          <button
            onClick={handleSearch}
            disabled={!inputKey.trim()}
            className="retro-btn text-xs px-3 py-1 disabled:opacity-50"
          >
            SEARCH
          </button>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#7A7A6E] mb-1">Range: Lo</label>
            <input
              type="number"
              value={rangeLoInput}
              onChange={e => setRangeLoInput(e.target.value)}
              placeholder="10"
              className="w-full px-2 py-1 border text-xs font-monospace rounded" style={{ background: '#F0F0E8', borderColor: '#B0B09A', color: '#2A2A28' }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[#7A7A6E] mb-1">Range: Hi</label>
            <input
              type="number"
              value={rangeHiInput}
              onChange={e => setRangeHiInput(e.target.value)}
              placeholder="50"
              className="w-full px-2 py-1 border text-xs font-monospace rounded" style={{ background: '#F0F0E8', borderColor: '#B0B09A', color: '#2A2A28' }}
            />
          </div>
          <button
            onClick={handleRangeScan}
            disabled={!rangeLoInput.trim() || !rangeHiInput.trim()}
            className="retro-btn text-xs px-3 py-1 disabled:opacity-50"
          >
            RANGE SCAN
          </button>
          <button
            onClick={() => {
              dispatch({ type: 'clear' })
              setMessage('Cleared tree')
            }}
            className="retro-btn text-xs px-3 py-1"
          >
            Clear
          </button>
        </div>
        </>
      )}
      minVisualHeight={240}
    />
  )
}
