import { useState, useReducer, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LearningModuleShell, type LearningTraceStep } from '../../components/LearningModuleShell'
import type { Stage } from '../../simulation/types'
import type { TransformerState, TransformerPhase } from './transformer.types'
import {
  initWeights, createInitialTransformerState, tokenize, forwardPass,
  VOCABULARY, VOCAB_SIZE, DIM, FFN_DIM, NUM_HEADS,
} from './TransformerEngine'

interface TransformerSimulationProps {
  stage?: Stage
  fixModeIndex?: number
}

const FIXED_INPUT = 'The cat sat on'

type TransformerAction =
  | { type: 'run-forward'; weights: ReturnType<typeof initWeights> }
  | { type: 'set-temperature'; value: number }
  | { type: 'set-phase'; phase: TransformerPhase }
  | { type: 'reset' }

// Deterministic weights — module-level, never re-computed
const WEIGHTS = initWeights()

const PHASES: TransformerPhase[] = [
  'tokenizing', 'embedding', 'mhsa-L1', 'ffn-L1', 'mhsa-L2', 'ffn-L2',
  'unembedding', 'softmax', 'predicted',
]

const PHASE_LABELS: Record<TransformerPhase, string> = {
  idle: 'Idle',
  tokenizing: 'Tokenizing input',
  embedding: 'Token + Position Embedding',
  'mhsa-L1': 'Layer 1 · Multi-Head Self-Attention',
  'ffn-L1': 'Layer 1 · Feed-Forward Network',
  'mhsa-L2': 'Layer 2 · Multi-Head Self-Attention',
  'ffn-L2': 'Layer 2 · Feed-Forward Network',
  unembedding: 'Unembedding — projecting to vocab',
  softmax: 'Softmax — computing probabilities',
  predicted: 'Prediction complete',
}

function reducer(state: TransformerState, action: TransformerAction): TransformerState {
  switch (action.type) {
    case 'run-forward': {
      const tokens = tokenize(state.inputText)
      if (tokens.length === 0) return { ...state, lastOp: 'No valid tokens' }
      const result = forwardPass(tokens, action.weights, state.temperature)
      return { ...state, tokens, ...result, phase: 'predicted', lastOp: `Predicted: "${result.topPredictions[0]?.token}" (p=${(result.topPredictions[0]?.probability * 100).toFixed(1)}%)` }
    }
    case 'set-temperature': {
      if (state.tokens.length === 0) return { ...state, temperature: action.value }
      const result = forwardPass(state.tokens, WEIGHTS, action.value)
      return { ...state, temperature: action.value, ...result }
    }
    case 'set-phase':
      return { ...state, phase: action.phase }
    case 'reset':
      return { ...createInitialTransformerState(), inputText: FIXED_INPUT }
    default:
      return state
  }
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
function valueColor(v: number): string {
  if (v > 0.05) return '#047857'
  if (v < -0.05) return '#ef4444'
  return '#64748b'
}

function heatColor(w: number): string {
  // 0 → dark, 0.5 → purple, 1 → gold
  const r = Math.round(w * 251)
  const g = Math.round(w * 191)
  const b = Math.round((1 - w) * 36 + w * 36)
  return `rgb(${r},${g},${b})`
}

function barHeight(v: number, maxH: number): number {
  return Math.min(Math.abs(v) / 0.3 * maxH, maxH)
}

// ─── Zone highlight logic ─────────────────────────────────────────────────────
const ZONE_PHASES: Record<string, TransformerPhase[]> = {
  tokenize:  ['tokenizing'],
  embed:     ['embedding'],
  layer1:    ['mhsa-L1', 'ffn-L1'],
  layer2:    ['mhsa-L2', 'ffn-L2'],
  unembed:   ['unembedding'],
  softmax:   ['softmax'],
  predict:   ['predicted'],
}

function zoneActive(zone: string, phase: TransformerPhase): boolean {
  return ZONE_PHASES[zone]?.includes(phase) ?? false
}

function zoneStroke(zone: string, phase: TransformerPhase): string {
  return zoneActive(zone, phase) ? '#fbbf24' : '#B0B09A'
}

function zoneFill(zone: string, phase: TransformerPhase): string {
  return zoneActive(zone, phase) ? 'rgba(251,191,36,0.08)' : 'rgba(232,230,216,0.6)'
}

// ─── Base mode SVG (7-zone pipeline) ─────────────────────────────────────────
function BasePipeline({
  state,
}: {
  state: TransformerState
}) {
  const phase = state.phase

  const zoneProps = (zone: string) => ({
    stroke: zoneStroke(zone, phase),
    fill: zoneFill(zone, phase),
    strokeWidth: zoneActive(zone, phase) ? 2 : 1,
  })

  // Embedding mini bars
  const embeddingBars = (vals: number[], x0: number, y0: number, barW = 5, maxH = 20) =>
    vals.map((v, i) => {
      const h = barHeight(v, maxH)
      return (
        <rect
          key={i}
          x={x0 + i * (barW + 1)}
          y={y0 + maxH - h}
          width={barW}
          height={h}
          fill={valueColor(v)}
          opacity={0.9}
        />
      )
    })

  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arroww" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L8,3 z" fill="#9A9A8E" />
        </marker>
        <marker id="arrowgold" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L8,3 z" fill="#fbbf24" />
        </marker>
      </defs>

      <rect width="1200" height="600" fill="#F0F0E8" />

      {/* Title */}
      <text x="16" y="22" fill="#047857" fontSize="13" fontWeight="bold" fontFamily="monospace">
        GPT Decoder — {PHASE_LABELS[phase]}
      </text>

      {/* ── Zone: INPUT ─────────────────────────────────────── */}
      <rect x="10" y="35" width="110" height="510" rx="6" {...zoneProps('tokenize')} />
      <text x="65" y="55" fill="#7c3aed" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">INPUT</text>
      {state.inputText ? (
        state.inputText.split(/\s+/).slice(0, 8).map((w, i) => (
          <text key={i} x="65" y={75 + i * 20} fill="#2A2A28" fontSize="9" fontFamily="monospace" textAnchor="middle">{w}</text>
        ))
      ) : (
        <text x="65" y="75" fill="#9A9A8E" fontSize="8" fontFamily="monospace" textAnchor="middle">type text…</text>
      )}

      {/* Arrow */}
      <line x1="121" y1="290" x2="137" y2="290" stroke="#9A9A8E" strokeWidth="1.5" markerEnd="url(#arroww)" />

      {/* ── Zone: TOKENIZE + EMBED ───────────────────────────── */}
      <rect x="140" y="35" width="170" height="510" rx="6" {...zoneProps('embed')} />
      <text x="225" y="55" fill="#06b6d4" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">EMBED + POS</text>
      {state.embeddings.map((emb, i) => (
        <g key={i}>
          {/* Token chip */}
          <rect x="148" y={68 + i * 60} width="44" height="16" rx="3" fill="#3A3A6E" stroke="#7c3aed" strokeWidth="1" />
          <text x="170" y={79 + i * 60} fill="#8b5cf6" fontSize="7" fontFamily="monospace" textAnchor="middle">
            [{emb.tokenId}]{state.tokens[i]?.text.slice(0, 4)}
          </text>
          {/* Embedding bars */}
          {embeddingBars(emb.withPos, 196, 68 + i * 60, 5, 16)}
        </g>
      ))}
      {state.embeddings.length === 0 && (
        <text x="225" y="85" fill="#9A9A8E" fontSize="8" fontFamily="monospace" textAnchor="middle">run forward…</text>
      )}

      {/* Arrow */}
      <line x1="311" y1="290" x2="327" y2="290" stroke="#9A9A8E" strokeWidth="1.5" markerEnd="url(#arroww)" />

      {/* ── Zone: TRANSFORMER LAYERS ─────────────────────────── */}
      {/* Layer 1 */}
      <rect x="330" y="35" width="200" height="240" rx="6" {...zoneProps('layer1')} />
      <text x="430" y="55" fill="#f59e0b" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">LAYER 1</text>

      {/* MHSA block */}
      <rect x="342" y="62" width="176" height="70" rx="4" fill="#D0CEBA" stroke={phase === 'mhsa-L1' ? '#fbbf24' : '#B0B09A'} strokeWidth={phase === 'mhsa-L1' ? 2 : 1} />
      <text x="430" y="80" fill="#d97706" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Multi-Head Self-Attention</text>
      <text x="430" y="94" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">Q×Kᵀ/√d → softmax → ×V</text>
      <text x="430" y="108" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">{NUM_HEADS} heads · head_dim={DIM / NUM_HEADS}</text>
      <text x="430" y="122" fill="#7A7A6E" fontSize="7" fontFamily="monospace" textAnchor="middle">causal mask + residual</text>

      {/* FFN block */}
      <rect x="342" y="140" width="176" height="70" rx="4" fill="#D0CEBA" stroke={phase === 'ffn-L1' ? '#fbbf24' : '#B0B09A'} strokeWidth={phase === 'ffn-L1' ? 2 : 1} />
      <text x="430" y="158" fill="#d97706" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Feed-Forward Network</text>
      <text x="430" y="172" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">GELU(W₁·x+b₁) → W₂·h+b₂</text>
      <text x="430" y="186" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">{DIM}→{FFN_DIM}→{DIM} (4× expansion)</text>
      <text x="430" y="200" fill="#7A7A6E" fontSize="7" fontFamily="monospace" textAnchor="middle">+ residual connection</text>

      {/* Layer 1 output bars */}
      {state.layerOutputs[0] && state.layerOutputs[0].output.slice(0, 4).map((row, i) => (
        <g key={i}>{embeddingBars(row, 342 + i * 46, 218, 5, 14)}</g>
      ))}

      {/* Layer 2 */}
      <rect x="330" y="285" width="200" height="260" rx="6" {...zoneProps('layer2')} />
      <text x="430" y="305" fill="#f59e0b" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">LAYER 2</text>

      <rect x="342" y="312" width="176" height="70" rx="4" fill="#D0CEBA" stroke={phase === 'mhsa-L2' ? '#fbbf24' : '#B0B09A'} strokeWidth={phase === 'mhsa-L2' ? 2 : 1} />
      <text x="430" y="330" fill="#d97706" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Multi-Head Self-Attention</text>
      <text x="430" y="344" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">Q×Kᵀ/√d → softmax → ×V</text>
      <text x="430" y="358" fill="#7A7A6E" fontSize="7" fontFamily="monospace" textAnchor="middle">causal mask + residual</text>

      <rect x="342" y="390" width="176" height="70" rx="4" fill="#D0CEBA" stroke={phase === 'ffn-L2' ? '#fbbf24' : '#B0B09A'} strokeWidth={phase === 'ffn-L2' ? 2 : 1} />
      <text x="430" y="408" fill="#d97706" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Feed-Forward Network</text>
      <text x="430" y="422" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">GELU(W₁·x+b₁) → W₂·h+b₂</text>
      <text x="430" y="436" fill="#7A7A6E" fontSize="7" fontFamily="monospace" textAnchor="middle">+ residual connection</text>

      {state.layerOutputs[1] && state.layerOutputs[1].output.slice(0, 4).map((row, i) => (
        <g key={i}>{embeddingBars(row, 342 + i * 46, 468, 5, 14)}</g>
      ))}

      {/* Final hidden */}
      {state.finalHidden.length > 0 && (
        <g>
          <text x="430" y="510" fill="#2563eb" fontSize="8" fontFamily="monospace" textAnchor="middle">last token h[{DIM}]:</text>
          {embeddingBars(state.finalHidden, 340, 516, 8, 20)}
        </g>
      )}

      {/* Arrow */}
      <line x1="531" y1="290" x2="547" y2="290" stroke="#9A9A8E" strokeWidth="1.5" markerEnd="url(#arroww)" />

      {/* ── Zone: UNEMBED ────────────────────────────────────── */}
      <rect x="550" y="35" width="130" height="510" rx="6" {...zoneProps('unembed')} />
      <text x="615" y="55" fill="#ec4899" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">UNEMBED</text>
      <text x="615" y="72" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">h[{DIM}] × W[{DIM}×{VOCAB_SIZE}]</text>
      <text x="615" y="85" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">→ {VOCAB_SIZE} logits</text>
      {state.logits.slice(0, 20).map((l, i) => {
        const barW = Math.min(Math.abs(l) / 0.5 * 50, 50)
        return (
          <g key={i}>
            <text x="558" y={105 + i * 19} fill="#7A7A6E" fontSize="6.5" fontFamily="monospace">{VOCABULARY[i].slice(0, 6)}</text>
            <rect x="597" y={96 + i * 19} width={barW} height="10" rx="1"
              fill={l > 0 ? '#6366f1' : '#ef4444'} opacity={0.75} />
            <text x="650" y={105 + i * 19} fill="#7A7A6E" fontSize="6" fontFamily="monospace">
              {l.toFixed(2)}
            </text>
          </g>
        )
      })}

      {/* Arrow */}
      <line x1="681" y1="290" x2="697" y2="290" stroke="#9A9A8E" strokeWidth="1.5" markerEnd="url(#arroww)" />

      {/* ── Zone: SOFTMAX ────────────────────────────────────── */}
      <rect x="700" y="35" width="130" height="510" rx="6" {...zoneProps('softmax')} />
      <text x="765" y="55" fill="#047857" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">SOFTMAX</text>
      <text x="765" y="70" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">exp(l/τ)/Σexp · τ={state.temperature.toFixed(1)}</text>
      {state.probabilities.slice(0, 20).map((p, i) => {
        const barW = Math.min(p * 400, 90)
        return (
          <g key={i}>
            <text x="708" y={90 + i * 19} fill="#7A7A6E" fontSize="6.5" fontFamily="monospace">{VOCABULARY[i].slice(0, 5)}</text>
            <rect x="737" y={81 + i * 19} width={barW} height="10" rx="1" fill="#047857" opacity={0.7} />
            <text x="833" y={90 + i * 19} fill="#7A7A6E" fontSize="6" fontFamily="monospace">
              {(p * 100).toFixed(1)}%
            </text>
          </g>
        )
      })}

      {/* Arrow */}
      <line x1="831" y1="290" x2="847" y2="290" stroke={phase === 'predicted' ? '#fbbf24' : '#9A9A8E'} strokeWidth="1.5" markerEnd={phase === 'predicted' ? 'url(#arrowgold)' : 'url(#arroww)'} />

      {/* ── Zone: PREDICTION ────────────────────────────────── */}
      <rect x="850" y="35" width="340" height="510" rx="6" {...zoneProps('predict')} filter={phase === 'predicted' ? 'url(#glow)' : undefined} />
      <text x="1020" y="55" fill="#f59e0b" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">TOP-5 PREDICTIONS</text>

      {state.topPredictions.map((pred, rank) => (
        <g key={rank}>
          <rect
            x="862" y={72 + rank * 82}
            width="316" height="72" rx="6"
            fill="#D0CEBA"
            stroke={rank === 0 ? '#f59e0b' : '#B0B09A'}
            strokeWidth={rank === 0 ? 2 : 1}
          />
          {/* Rank badge */}
          <circle cx="886" cy={108 + rank * 82} r="14" fill={rank === 0 ? '#f59e0b' : '#B0B09A'} />
          <text x="886" y={113 + rank * 82} fill={rank === 0 ? '#E8E6D8' : '#7A7A6E'} fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
            {rank + 1}
          </text>
          {/* Token */}
          <text x="910" y={96 + rank * 82} fill={rank === 0 ? '#fbbf24' : '#2A2A28'} fontSize="14" fontWeight="bold" fontFamily="monospace">
            "{pred.token}"
          </text>
          {/* Logit */}
          <text x="910" y={112 + rank * 82} fill="#7A7A6E" fontSize="8" fontFamily="monospace">
            logit={pred.logit.toFixed(3)}
          </text>
          {/* Prob bar */}
          <rect x="910" y={120 + rank * 82} width={Math.min(pred.probability * 280, 230)} height="8" rx="2" fill={rank === 0 ? '#f59e0b' : '#3b82f6'} opacity={0.8} />
          {/* Prob % */}
          <text x="1148" y={128 + rank * 82} fill={rank === 0 ? '#fbbf24' : '#7A7A6E'} fontSize="9" fontFamily="monospace" textAnchor="end">
            {(pred.probability * 100).toFixed(1)}%
          </text>
        </g>
      ))}

      {state.topPredictions.length === 0 && (
        <text x="1020" y="200" fill="#9A9A8E" fontSize="11" fontFamily="monospace" textAnchor="middle">run forward pass…</text>
      )}

      {/* Status */}
      <text x="16" y="585" fill="#f97316" fontSize="10" fontFamily="monospace" fontWeight="bold">
        {state.lastOp}
      </text>
    </svg>
  )
}

// ─── Fix Mode 0: Attention Deep Dive ─────────────────────────────────────────
function AttentionDeepdive({ state }: { state: TransformerState }) {
  const [headIdx, setHeadIdx] = useState(0)

  const layer = state.layerOutputs[0]
  const head = layer?.mhsaHeads[headIdx]
  const seqLen = state.tokens.length

  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
      <rect width="1200" height="600" fill="#F0F0E8" />
      <text x="16" y="22" fill="#7c3aed" fontSize="13" fontWeight="bold" fontFamily="monospace">
        Attention Deep Dive — Layer 1
      </text>

      {/* Head toggle */}
      {Array.from({ length: NUM_HEADS }, (_, h) => (
        <g key={h} style={{ cursor: 'pointer' }} onClick={() => setHeadIdx(h)}>
          <rect x={16 + h * 80} y="32" width="70" height="22" rx="4"
            fill={headIdx === h ? '#7c3aed' : '#E8E6D8'}
            stroke={headIdx === h ? '#7c3aed' : '#B0B09A'} strokeWidth="1" />
          <text x={51 + h * 80} y="47" fill={headIdx === h ? '#e9d5ff' : '#7A7A6E'}
            fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            HEAD {h}
          </text>
        </g>
      ))}

      {/* ── Attention heatmap ───────────────────────────────────── */}
      <text x="16" y="80" fill="#7A7A6E" fontSize="10" fontFamily="monospace">Attention Weights (causal masked)</text>
      {seqLen > 0 && head ? (
        <>
          {/* Column headers */}
          {state.tokens.map((t, j) => (
            <text key={j} x={60 + j * 52} y="98" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">
              {t.text.slice(0, 4)}
            </text>
          ))}
          {head.attentionWeights.map((row, i) =>
            row.map((w, j) => {
              const isMasked = j > i
              return (
                <g key={`${i}-${j}`}>
                  <rect
                    x={36 + j * 52} y={100 + i * 52}
                    width="48" height="48" rx="3"
                    fill={isMasked ? '#E8E6D8' : heatColor(w)}
                    stroke={isMasked ? '#E8E6D8' : '#B0B09A'}
                    strokeWidth="1"
                    strokeDasharray={isMasked ? '3 2' : undefined}
                  />
                  {!isMasked && (
                    <text x={60 + j * 52} y={128 + i * 52}
                      fill={w > 0.4 ? '#1a0a00' : '#2A2A28'}
                      fontSize="9" fontFamily="monospace" textAnchor="middle">
                      {w.toFixed(2)}
                    </text>
                  )}
                  {isMasked && (
                    <text x={60 + j * 52} y={128 + i * 52}
                      fill="#B0B09A" fontSize="9" fontFamily="monospace" textAnchor="middle">mask</text>
                  )}
                </g>
              )
            })
          )}
          {/* Row labels */}
          {state.tokens.map((t, i) => (
            <text key={i} x="32" y={130 + i * 52} fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="end">
              {t.text.slice(0, 4)}
            </text>
          ))}
        </>
      ) : (
        <text x="200" y="160" fill="#9A9A8E" fontSize="12" fontFamily="monospace">Run forward pass first</text>
      )}

      {/* ── Q/K/V bars ──────────────────────────────────────────── */}
      {head && (
        <g>
          <text x="500" y="80" fill="#7A7A6E" fontSize="10" fontFamily="monospace">Q / K / V vectors (head {headIdx})</text>
          {state.tokens.map((t, i) => (
            <g key={i}>
              <text x="500" y={100 + i * 65} fill="#2A2A28" fontSize="8" fontFamily="monospace">{t.text.slice(0, 6)}</text>
              {/* Q */}
              <text x="500" y={114 + i * 65} fill="#7c3aed" fontSize="7" fontFamily="monospace">Q</text>
              {head.Q[i]?.map((v, d) => {
                const h = barHeight(v, 12)
                return <rect key={d} x={516 + d * 9} y={114 + i * 65 - h} width="7" height={h} fill="#7c3aed" opacity={0.8} />
              })}
              {/* K */}
              <text x="500" y={130 + i * 65} fill="#0284c7" fontSize="7" fontFamily="monospace">K</text>
              {head.K[i]?.map((v, d) => {
                const h = barHeight(v, 12)
                return <rect key={d} x={516 + d * 9} y={130 + i * 65 - h} width="7" height={h} fill="#0284c7" opacity={0.8} />
              })}
              {/* V */}
              <text x="500" y={146 + i * 65} fill="#16a34a" fontSize="7" fontFamily="monospace">V</text>
              {head.V[i]?.map((v, d) => {
                const h = barHeight(v, 12)
                return <rect key={d} x={516 + d * 9} y={146 + i * 65 - h} width="7" height={h} fill="#16a34a" opacity={0.8} />
              })}
            </g>
          ))}
        </g>
      )}

      {/* ── Formula steps ────────────────────────────────────────── */}
      <g>
        <text x="820" y="80" fill="#7A7A6E" fontSize="10" fontFamily="monospace">How MHSA works</text>
        {[
          { label: '1. Scores', formula: 'S = Q × Kᵀ / √d_k', color: '#d97706' },
          { label: '2. Mask', formula: 'S[i,j]=−∞ if j>i', color: '#f87171' },
          { label: '3. Softmax', formula: 'A = softmax(S)', color: '#34d399' },
          { label: '4. Context', formula: 'C = A × V', color: '#2563eb' },
        ].map((step, idx) => (
          <g key={idx}>
            <rect x="820" y={100 + idx * 100} width="360" height="80" rx="6"
              fill="#D0CEBA" stroke="#B0B09A" strokeWidth="1" />
            <text x="840" y={125 + idx * 100} fill={step.color} fontSize="11" fontWeight="bold" fontFamily="monospace">{step.label}</text>
            <text x="840" y={150 + idx * 100} fill="#7A7A6E" fontSize="10" fontFamily="monospace">{step.formula}</text>
          </g>
        ))}
        <text x="820" y="520" fill="#7A7A6E" fontSize="9" fontFamily="monospace">
          Concat {NUM_HEADS} heads → Wₒ projection → residual
        </text>
      </g>
    </svg>
  )
}

// ─── Fix Mode 1: FFN Deep Dive ───────────────────────────────────────────────
function FFNDeepdive({ state }: { state: TransformerState }) {
  const layer = state.layerOutputs[0]

  // GELU curve path
  const geluPath = (() => {
    const pts: string[] = []
    for (let xi = -30; xi <= 30; xi++) {
      const x = xi / 10
      const y = 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)))
      const px = 620 + xi * 6
      const py = 340 - y * 60
      pts.push(`${px},${py}`)
    }
    return `M ${pts.join(' L ')}`
  })()

  const neurons = Math.min(DIM, 8)
  const hiddenNeurons = Math.min(FFN_DIM, 12)

  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
      <rect width="1200" height="600" fill="#F0F0E8" />
      <text x="16" y="22" fill="#16a34a" fontSize="13" fontWeight="bold" fontFamily="monospace">
        FFN Deep Dive — Layer 1 · {DIM}→{FFN_DIM}→{DIM} (GELU)
      </text>

      {/* ── Input neurons ──────────────────────────────────────── */}
      <text x="40" y="55" fill="#7A7A6E" fontSize="10" fontFamily="monospace" textAnchor="middle">Input</text>
      <text x="40" y="68" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">{DIM}-dim</text>
      {Array.from({ length: neurons }, (_, i) => {
        const v = layer?.output[0]?.[i] ?? 0
        return (
          <g key={i}>
            <circle cx="40" cy={90 + i * 55} r="18"
              fill="#D0CEBA" stroke={valueColor(v)} strokeWidth="2" />
            <text x="40" y={95 + i * 55} fill={valueColor(v)} fontSize="7" fontFamily="monospace" textAnchor="middle">
              {v.toFixed(2)}
            </text>
            {/* Fan-out line to W1 zone */}
            <line x1="58" y1={90 + i * 55} x2="160" y2="90" stroke="#B0B09A" strokeWidth="0.5" opacity="0.3" />
            <line x1="58" y1={90 + i * 55} x2="160" y2={90 + (hiddenNeurons - 1) * 38} stroke="#B0B09A" strokeWidth="0.5" opacity="0.3" />
          </g>
        )
      })}

      {/* ── W1 label ────────────────────────────────────────────── */}
      <text x="110" y="55" fill="#7A7A6E" fontSize="9" fontFamily="monospace" textAnchor="middle">W₁ ({DIM}×{FFN_DIM})</text>
      <rect x="80" y="65" width="60" height={hiddenNeurons * 38} rx="4" fill="#D0CEBA" stroke="#B0B09A" strokeWidth="1" />

      {/* ── Hidden neurons (GELU activated) ─────────────────────── */}
      <text x="240" y="55" fill="#059669" fontSize="10" fontFamily="monospace" textAnchor="middle">Hidden (GELU)</text>
      <text x="240" y="68" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">{FFN_DIM} neurons</text>
      {Array.from({ length: hiddenNeurons }, (_, i) => {
        const raw = layer?.ffnHidden[0]?.[i] ?? 0
        return (
          <g key={i}>
            <circle cx="240" cy={90 + i * 38} r="14"
              fill="#D0CEBA" stroke={valueColor(raw)} strokeWidth="2" />
            <text x="240" y={95 + i * 38} fill={valueColor(raw)} fontSize="7" fontFamily="monospace" textAnchor="middle">
              {raw.toFixed(1)}
            </text>
            <line x1="254" y1={90 + i * 38} x2="350" y2={90 + Math.floor(i / hiddenNeurons * neurons) * 55} stroke="#B0B09A" strokeWidth="0.5" opacity="0.3" />
          </g>
        )
      })}

      {/* ── W2 label ────────────────────────────────────────────── */}
      <text x="308" y="55" fill="#7A7A6E" fontSize="9" fontFamily="monospace" textAnchor="middle">W₂ ({FFN_DIM}×{DIM})</text>
      <rect x="278" y="65" width="60" height={hiddenNeurons * 38} rx="4" fill="#D0CEBA" stroke="#B0B09A" strokeWidth="1" />

      {/* ── Output neurons ──────────────────────────────────────── */}
      <text x="420" y="55" fill="#7A7A6E" fontSize="10" fontFamily="monospace" textAnchor="middle">Output</text>
      <text x="420" y="68" fill="#7A7A6E" fontSize="8" fontFamily="monospace" textAnchor="middle">{DIM}-dim</text>
      {Array.from({ length: neurons }, (_, i) => {
        const v = layer?.ffnOutput[0]?.[i] ?? 0
        return (
          <g key={i}>
            <circle cx="420" cy={90 + i * 55} r="18"
              fill="#D0CEBA" stroke={valueColor(v)} strokeWidth="2" />
            <text x="420" y={95 + i * 55} fill={valueColor(v)} fontSize="7" fontFamily="monospace" textAnchor="middle">
              {v.toFixed(2)}
            </text>
          </g>
        )
      })}

      {/* ── GELU curve ──────────────────────────────────────────── */}
      <text x="800" y="255" fill="#059669" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">GELU Activation</text>
      <rect x="608" y="270" width="380" height="150" rx="6" fill="#D0CEBA" stroke="#1e3a2a" strokeWidth="1" />
      {/* Axes */}
      <line x1="620" y1="340" x2="980" y2="340" stroke="#B0B09A" strokeWidth="1" />
      <line x1="800" y1="280" x2="800" y2="415" stroke="#B0B09A" strokeWidth="1" />
      <text x="982" y="344" fill="#7A7A6E" fontSize="8" fontFamily="monospace">x</text>
      <text x="803" y="278" fill="#7A7A6E" fontSize="8" fontFamily="monospace">y</text>
      {/* Curve */}
      <path d={geluPath} fill="none" stroke="#059669" strokeWidth="2" />
      {/* Annotation */}
      <text x="620" y="435" fill="#16a34a" fontSize="8" fontFamily="monospace">GELU(x) = 0.5x·(1+tanh(√(2/π)·(x+0.044715x³)))</text>
      <text x="620" y="450" fill="#7A7A6E" fontSize="8" fontFamily="monospace">Smoother than ReLU — allows small negative outputs</text>

      {/* ── Formula boxes ────────────────────────────────────────── */}
      <g>
        <text x="620" y="480" fill="#7A7A6E" fontSize="9" fontFamily="monospace">
          Steps: 1) Expand {DIM}→{FFN_DIM}  2) GELU  3) Project {FFN_DIM}→{DIM}  4) Add residual
        </text>
        <text x="620" y="496" fill="#7A7A6E" fontSize="9" fontFamily="monospace">
          4× expansion = compressed pattern memory per token position
        </text>
        <text x="620" y="512" fill="#7A7A6E" fontSize="9" fontFamily="monospace">
          FFN runs independently per token — no cross-token mixing (attention handles that)
        </text>
      </g>
    </svg>
  )
}

// ─── Fix Mode 2: Prediction & Sampling ────────────────────────────────────────
function PredictionDeepdive({
  state,
  onTemperatureChange,
}: {
  state: TransformerState
  onTemperatureChange: (v: number) => void
}) {
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid meet" className="max-w-full max-h-full">
      <rect width="1200" height="600" fill="#F0F0E8" />
      <text x="16" y="22" fill="#f59e0b" fontSize="13" fontWeight="bold" fontFamily="monospace">
        Prediction & Sampling — τ={state.temperature.toFixed(1)}
      </text>

      {/* ── Logit bar chart (all 20 words) ────────────────────── */}
      <text x="16" y="50" fill="#7A7A6E" fontSize="10" fontFamily="monospace">Raw Logits (unembedding output)</text>
      {state.logits.map((l, i) => {
        const barW = Math.min(Math.abs(l) / 0.5 * 100, 100)
        return (
          <g key={i}>
            <text x="16" y={68 + i * 24} fill="#7A7A6E" fontSize="8" fontFamily="monospace">{VOCABULARY[i].padEnd(8)}</text>
            <rect
              x="80" y={56 + i * 24}
              width={barW} height="14" rx="2"
              fill={l > 0 ? '#6366f1' : '#ef4444'} opacity={0.8}
            />
            <text x="185" y={68 + i * 24} fill="#7A7A6E" fontSize="7" fontFamily="monospace">
              {l > 0 ? '+' : ''}{l.toFixed(3)}
            </text>
          </g>
        )
      })}

      {/* ── Temperature effect ──────────────────────────────────── */}
      <text x="280" y="50" fill="#7A7A6E" fontSize="10" fontFamily="monospace">Temperature (τ) Effect</text>

      <rect x="280" y="60" width="340" height="50" rx="6" fill="#D0CEBA" stroke="#B0B09A" strokeWidth="1" />
      <text x="290" y="82" fill="#d97706" fontSize="10" fontFamily="monospace">τ = {state.temperature.toFixed(1)}</text>
      <text x="290" y="100" fill="#7A7A6E" fontSize="9" fontFamily="monospace">
        {state.temperature < 0.7 ? 'Sharp / deterministic — top token dominates' :
         state.temperature > 1.3 ? 'Flat / random — uniform-ish distribution' :
         'Balanced — natural sampling'}
      </text>

      {/* Temperature slider placeholder (HTML input overlaid via foreignObject) */}
      <foreignObject x="280" y="118" width="340" height="36">
        <input
          type="range" min="0.1" max="2.0" step="0.1"
          value={state.temperature}
          onChange={e => onTemperatureChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
        />
      </foreignObject>

      <text x="280" y="170" fill="#9A9A8E" fontSize="8" fontFamily="monospace">τ=0.1 (greedy) ←────────────────→ τ=2.0 (random)</text>

      {/* Softmax formula */}
      <rect x="280" y="185" width="340" height="60" rx="6" fill="#D0CEBA" stroke="#B0B09A" strokeWidth="1" />
      <text x="290" y="206" fill="#047857" fontSize="10" fontWeight="bold" fontFamily="monospace">Softmax with temperature</text>
      <text x="290" y="226" fill="#7A7A6E" fontSize="10" fontFamily="monospace">P(token) = exp(logit / τ) / Σ exp(logit / τ)</text>
      <text x="290" y="242" fill="#7A7A6E" fontSize="9" fontFamily="monospace">τ→0: argmax.  τ=1: standard.  τ→∞: uniform</text>

      {/* Before/after prob comparison */}
      <text x="280" y="270" fill="#7A7A6E" fontSize="10" fontFamily="monospace">Probability distribution (top 10):</text>
      {state.probabilities
        .map((p, i) => ({ p, i }))
        .sort((a, b) => b.p - a.p)
        .slice(0, 10)
        .map(({ p, i }, rank) => {
          const barW = Math.min(p * 320, 280)
          return (
            <g key={rank}>
              <text x="280" y={290 + rank * 22} fill="#7A7A6E" fontSize="8" fontFamily="monospace">
                {VOCABULARY[i].padEnd(8)}
              </text>
              <rect x="355" y={278 + rank * 22} width={barW} height="14" rx="2"
                fill={rank === 0 ? '#f59e0b' : '#3b82f6'} opacity={rank === 0 ? 0.9 : 0.6} />
              <text x="640" y={290 + rank * 22} fill="#7A7A6E" fontSize="7" fontFamily="monospace">
                {(p * 100).toFixed(1)}%
              </text>
            </g>
          )
        })}

      {/* ── Top-5 prediction cards ──────────────────────────────── */}
      <text x="660" y="50" fill="#7A7A6E" fontSize="10" fontFamily="monospace">Top-5 Predictions</text>
      {state.topPredictions.map((pred, rank) => (
        <g key={rank}>
          <rect x="660" y={60 + rank * 104} width="520" height="94" rx="8"
            fill="#D0CEBA"
            stroke={rank === 0 ? '#f59e0b' : '#B0B09A'}
            strokeWidth={rank === 0 ? 2.5 : 1} />
          <circle cx="692" cy={107 + rank * 104} r="18"
            fill={rank === 0 ? '#f59e0b' : '#B0B09A'} />
          <text x="692" y={113 + rank * 104} fill={rank === 0 ? '#E8E6D8' : '#7A7A6E'}
            fontSize="13" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
            {rank + 1}
          </text>
          <text x="722" y={92 + rank * 104} fill={rank === 0 ? '#fbbf24' : '#2A2A28'}
            fontSize="18" fontWeight="bold" fontFamily="monospace">
            "{pred.token}"
          </text>
          <text x="722" y={110 + rank * 104} fill="#7A7A6E" fontSize="9" fontFamily="monospace">
            logit={pred.logit.toFixed(3)}  p={( pred.probability * 100).toFixed(2)}%
          </text>
          <rect x="722" y={120 + rank * 104} width={Math.min(pred.probability * 460, 440)} height="12" rx="3"
            fill={rank === 0 ? '#f59e0b' : '#3b82f6'} opacity={0.8} />
        </g>
      ))}

      {state.topPredictions.length === 0 && (
        <text x="840" y="200" fill="#9A9A8E" fontSize="12" fontFamily="monospace" textAnchor="middle">
          Run forward pass first
        </text>
      )}

      {/* Status */}
      <text x="16" y="585" fill="#f97316" fontSize="10" fontFamily="monospace" fontWeight="bold">
        {state.lastOp}
      </text>
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TransformerSimulation({ fixModeIndex = -1 }: TransformerSimulationProps) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    ...createInitialTransformerState(),
    inputText: FIXED_INPUT,
  }))
  const isRunning = useRef(false)

  // Animate phase sequence
  function runAnimatedForward() {
    if (isRunning.current) return

    // First compute the full result
    dispatch({ type: 'run-forward', weights: WEIGHTS })

    // Then animate through phases
    isRunning.current = true
    PHASES.forEach((phase, i) => {
      setTimeout(() => {
        dispatch({ type: 'set-phase', phase })
        if (i === PHASES.length - 1) { isRunning.current = false }
      }, i * 600)
    })
  }

  // Recompute when temperature changes during predict mode
  function handleTemperatureChange(v: number) {
    dispatch({ type: 'set-temperature', value: v })
  }

  const renderVisualization = () => {
    if (fixModeIndex === 0) return <AttentionDeepdive state={state} />
    if (fixModeIndex === 1) return <FFNDeepdive state={state} />
    if (fixModeIndex === 2) return <PredictionDeepdive state={state} onTemperatureChange={handleTemperatureChange} />
    return <BasePipeline state={state} />
  }

  const phaseLabel = PHASE_LABELS[state.phase] ?? state.phase
  const topPrediction = state.topPredictions[0]
  const traceSteps: LearningTraceStep[] = [
    { title: '1. Tokenize', detail: `"${FIXED_INPUT}" becomes ${state.tokens.length || tokenize(FIXED_INPUT).length} token ids.`, meta: state.tokens.join(', ') || 'run forward to populate tokens', color: '#3b82f6' },
    { title: '2. Embed', detail: `Each token maps into a ${DIM}-dimensional vector plus position signal.`, meta: `${state.embeddings.length} embedding vector(s)`, color: '#22c55e' },
    { title: '3. Layers', detail: `${NUM_HEADS} attention heads mix context, then FFN expands to ${FFN_DIM} dims and projects back.`, meta: phaseLabel, color: '#f59e0b' },
    { title: '4. Predict', detail: topPrediction ? `Top token is "${topPrediction.token}" at ${(topPrediction.probability * 100).toFixed(1)}%.` : 'Unembedding + softmax will produce next-token probabilities.', meta: `temperature=${state.temperature.toFixed(1)}`, color: '#8b5cf6' },
  ]

  const stateBody = (
    <div className="space-y-1">
      <div>Phase: {phaseLabel}</div>
      <div>Model dims: vocab={VOCAB_SIZE}, d_model={DIM}, heads={NUM_HEADS}</div>
      <div>Temperature: {state.temperature.toFixed(1)}</div>
      <div>Top prediction: {topPrediction ? `"${topPrediction.token}"` : 'not computed yet'}</div>
    </div>
  )

  return (
    <LearningModuleShell
      visual={(
      <div className="h-full flex items-center justify-center overflow-hidden px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={fixModeIndex}
            className="w-full h-full flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderVisualization()}
          </motion.div>
        </AnimatePresence>
      </div>
      )}
      traceTitle="FORWARD PASS TRACE"
      traceMeta={state.lastOp}
      traceSteps={traceSteps}
      stateTitle="WHAT THE MODEL COMPUTES"
      stateBody={stateBody}
      eventsTitle="PREDICTION LOG"
      events={[
        { id: 'last-op', text: state.lastOp, color: '#f97316' },
        ...state.topPredictions.slice(0, 4).map((pred, i) => ({ id: `${pred.token}-${i}`, text: `${i + 1}. ${pred.token} ${(pred.probability * 100).toFixed(2)}%`, color: i === 0 ? '#f59e0b' : '#93c5fd' })),
      ]}
      emptyEventText="Run the forward pass to produce logits and probabilities."
      latestKey={topPrediction?.token}
      controls={(
        <>
        {/* Phase indicator */}
        {state.phase !== 'idle' && (
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono text-amber-400">[{state.phase.toUpperCase()}]</div>
            <div className="text-xs text-[#7A7A6E]">{phaseLabel}</div>
            {isRunning.current && (
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
        )}

        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="block text-xs text-[#7A7A6E] mb-1">Input Sentence (fixed)</label>
            <div className="px-2 py-1 border text-amber-300 text-xs font-mono rounded" style={{ background: '#F0F0E8', borderColor: '#B0B09A', color: '#2A2A28' }}>
              {FIXED_INPUT}
            </div>
          </div>

          <button
            onClick={runAnimatedForward}
            className="retro-btn text-xs px-3 py-1"
          >
            RUN FORWARD
          </button>

          <button
            onClick={() => dispatch({ type: 'reset' })}
            className="retro-btn text-xs px-3 py-1"
          >
            RESET
          </button>
        </div>

        {/* Temperature control (always visible for quick access) */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#7A7A6E] font-mono">Temperature (τ):</span>
          <input
            type="range" min="0.1" max="2.0" step="0.1"
            value={state.temperature}
            onChange={e => handleTemperatureChange(parseFloat(e.target.value))}
            className="w-40 accent-amber-400"
          />
          <span className="text-xs text-amber-400 font-mono">{state.temperature.toFixed(1)}</span>
          <span className="text-xs text-[#7A7A6E] font-mono">
            {state.temperature < 0.7 ? '→ deterministic' : state.temperature > 1.3 ? '→ random' : '→ balanced'}
          </span>
        </div>
        </>
      )}
      minVisualHeight={260}
    />
  )
}
