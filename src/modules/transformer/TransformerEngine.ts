import type {
  TransformerState,
  TransformerWeights,
  Token,
  EmbeddingVector,
  AttentionHead,
  LayerOutput,
  PredictionResult,
} from './transformer.types'

// ─── Model constants ──────────────────────────────────────────────────────────
export const DIM = 8
export const NUM_HEADS = 2
export const HEAD_DIM = DIM / NUM_HEADS  // 4
export const NUM_LAYERS = 2
export const FFN_DIM = 32
export const VOCAB_SIZE = 20
export const MAX_SEQ = 8

export const VOCABULARY: string[] = [
  'The', 'cat', 'sat', 'on', 'mat', 'dog', 'ran', 'in', 'garden', 'a',
  'the', 'is', 'was', 'jumped', 'over', 'fence', 'and', 'then', 'quickly', 'slowly',
]

// ─── LCG random generator ────────────────────────────────────────────────────
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = Math.imul(1664525, s) + 1013904223
    s = s >>> 0
    return (s / 0x100000000) * 2 - 1  // [-1, 1]
  }
}

function makeMatrix(rows: number, cols: number, rand: () => number): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => rand() * 0.1)
  )
}

// ─── Weight initialisation ───────────────────────────────────────────────────
export function initWeights(): TransformerWeights {
  const rand = lcg(42)
  const embeddingTable = makeMatrix(VOCAB_SIZE, DIM, rand)
  const layers = Array.from({ length: NUM_LAYERS }, () => ({
    Wq: makeMatrix(DIM, DIM, rand),
    Wk: makeMatrix(DIM, DIM, rand),
    Wv: makeMatrix(DIM, DIM, rand),
    Wo: makeMatrix(DIM, DIM, rand),
    W1: makeMatrix(DIM, FFN_DIM, rand),
    b1: Array.from({ length: FFN_DIM }, () => rand() * 0.01),
    W2: makeMatrix(FFN_DIM, DIM, rand),
    b2: Array.from({ length: DIM }, () => rand() * 0.01),
    gamma1: Array.from({ length: DIM }, () => 1),
    beta1:  Array.from({ length: DIM }, () => 0),
    gamma2: Array.from({ length: DIM }, () => 1),
    beta2:  Array.from({ length: DIM }, () => 0),
  }))
  const Wunembed = makeMatrix(DIM, VOCAB_SIZE, rand)
  return { embeddingTable, layers, Wunembed }
}

// ─── Math helpers ─────────────────────────────────────────────────────────────
// Matrix × vector (MxN matrix, N-length vector → M-length vector)
function matVec(M: number[][], v: number[]): number[] {
  return M.map(row => row.reduce((s, w, i) => s + w * v[i], 0))
}

function layerNorm(x: number[], gamma: number[], beta: number[]): number[] {
  const mean = x.reduce((a, b) => a + b, 0) / x.length
  const variance = x.reduce((a, b) => a + (b - mean) ** 2, 0) / x.length
  const std = Math.sqrt(variance + 1e-5)
  return x.map((v, i) => gamma[i] * ((v - mean) / std) + beta[i])
}

function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)))
}

function softmaxVec(logits: number[], temp = 1): number[] {
  const scaled = logits.map(l => l / temp)
  const max = Math.max(...scaled)
  const exps = scaled.map(v => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / sum)
}

function addVec(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i])
}

// ─── Positional encoding ─────────────────────────────────────────────────────
export function positionalEncoding(pos: number): number[] {
  return Array.from({ length: DIM }, (_, i) => {
    const denom = Math.pow(10000, (2 * Math.floor(i / 2)) / DIM)
    return i % 2 === 0 ? Math.sin(pos / denom) : Math.cos(pos / denom)
  })
}

// ─── Tokeniser ───────────────────────────────────────────────────────────────
export function tokenize(text: string): Token[] {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, MAX_SEQ)
  return words.map((word, position) => {
    let id = VOCABULARY.indexOf(word)
    if (id === -1) id = VOCABULARY.findIndex(v => v.toLowerCase() === word.toLowerCase())
    if (id === -1) id = 0
    return { text: word, id, position }
  })
}

// ─── Single-layer attention ───────────────────────────────────────────────────
function computeAttention(
  X: number[][],  // seqLen × DIM
  Wq: number[][], Wk: number[][], Wv: number[][], Wo: number[][],
  layerIdx: number,
): { heads: AttentionHead[]; projected: number[][] } {
  const seqLen = X.length
  const heads: AttentionHead[] = []

  // Collect per-head context vectors (seqLen × HEAD_DIM each)
  const allContexts: number[][][] = []  // heads × seqLen × HEAD_DIM

  for (let h = 0; h < NUM_HEADS; h++) {
    const offset = h * HEAD_DIM
    // Slice head columns from Wq/Wk/Wv  (DIM × DIM → DIM × HEAD_DIM)
    const sliceW = (W: number[][]) => W.map(row => row.slice(offset, offset + HEAD_DIM))
    const Wqh = sliceW(Wq), Wkh = sliceW(Wk), Wvh = sliceW(Wv)

    // Q, K, V: seqLen × HEAD_DIM
    const Q = X.map(x => matVec(Wqh, x))  // matVec: DIM×HEAD_DIM × DIM → HEAD_DIM
    const K = X.map(x => matVec(Wkh, x))
    const V = X.map(x => matVec(Wvh, x))

    // Scores: seqLen × seqLen
    const rawScores: number[][] = Array.from({ length: seqLen }, (_, i) =>
      Array.from({ length: seqLen }, (_, j) => {
        const dot = Q[i].reduce((s, v, k) => s + v * K[j][k], 0)
        return dot / Math.sqrt(HEAD_DIM)
      })
    )

    // Causal mask + softmax
    const attentionWeights: number[][] = rawScores.map((row, i) =>
      softmaxVec(row.map((s, j) => (j > i ? -1e9 : s)))
    )

    // Context vectors: seqLen × HEAD_DIM
    const contextVectors: number[][] = attentionWeights.map(attnRow =>
      Array.from({ length: HEAD_DIM }, (_, d) =>
        attnRow.reduce((s, w, j) => s + w * V[j][d], 0)
      )
    )

    heads.push({ headIdx: h, Q, K, V, rawScores, attentionWeights, contextVectors })
    allContexts.push(contextVectors)
  }

  // Concatenate heads: seqLen × DIM
  const concatenated: number[][] = Array.from({ length: seqLen }, (_, i) =>
    allContexts.flatMap(hCtx => hCtx[i])
  )

  // Project: seqLen × DIM
  const projected: number[][] = concatenated.map(x => matVec(Wo, x))
  return { heads, projected }

  // suppress unused warning
  void layerIdx
}

// ─── Single-layer FFN ─────────────────────────────────────────────────────────
function computeFFN(
  X: number[][],  // seqLen × DIM
  W1: number[][], b1: number[],
  W2: number[][], b2: number[],
): { hidden: number[][]; output: number[][] } {
  const hidden = X.map(x => {
    // x: DIM, W1: DIM×FFN_DIM → FFN_DIM (we do x @ W1 + b1)
    const h = Array.from({ length: FFN_DIM }, (_, j) =>
      x.reduce((s, v, i) => s + v * W1[i][j], 0) + b1[j]
    )
    return h.map(gelu)
  })
  const output = hidden.map(h => {
    // h: FFN_DIM, W2: FFN_DIM×DIM → DIM
    return Array.from({ length: DIM }, (_, j) =>
      h.reduce((s, v, i) => s + v * W2[i][j], 0) + b2[j]
    )
  })
  return { hidden, output }
}

// ─── Forward pass ─────────────────────────────────────────────────────────────
export function forwardPass(
  tokens: Token[],
  weights: TransformerWeights,
  temperature = 1,
): {
  embeddings: EmbeddingVector[]
  layerOutputs: LayerOutput[]
  finalHidden: number[]
  logits: number[]
  probabilities: number[]
  topPredictions: PredictionResult[]
} {
  if (tokens.length === 0) {
    return {
      embeddings: [], layerOutputs: [], finalHidden: [],
      logits: Array(VOCAB_SIZE).fill(0),
      probabilities: Array(VOCAB_SIZE).fill(1 / VOCAB_SIZE),
      topPredictions: [],
    }
  }

  // Embeddings + positional encoding
  const embeddings: EmbeddingVector[] = tokens.map(t => {
    const values = [...weights.embeddingTable[t.id]]
    const pe = positionalEncoding(t.position)
    const withPos = addVec(values, pe)
    return { tokenId: t.id, values, withPos }
  })

  // X: seqLen × DIM
  let X: number[][] = embeddings.map(e => e.withPos)

  const layerOutputs: LayerOutput[] = []

  for (let layerIdx = 0; layerIdx < NUM_LAYERS; layerIdx++) {
    const lw = weights.layers[layerIdx]

    // Pre-MHSA LayerNorm
    const X_ln1 = X.map(x => layerNorm(x, lw.gamma1, lw.beta1))

    // MHSA
    const { heads: mhsaHeads, projected } = computeAttention(X_ln1, lw.Wq, lw.Wk, lw.Wv, lw.Wo, layerIdx)

    // Residual 1
    const X_res1 = X.map((x, i) => addVec(x, projected[i]))

    // Pre-FFN LayerNorm
    const X_ln2 = X_res1.map(x => layerNorm(x, lw.gamma2, lw.beta2))

    // FFN
    const { hidden: ffnHidden, output: ffnOutput } = computeFFN(X_ln2, lw.W1, lw.b1, lw.W2, lw.b2)

    // Residual 2
    const output = X_res1.map((x, i) => addVec(x, ffnOutput[i]))

    layerOutputs.push({ layerIdx, mhsaHeads, mhsaProjected: projected, ffnHidden, ffnOutput, output })
    X = output
  }

  // Last token hidden state
  const finalHidden = X[X.length - 1]

  // Unembed: DIM → VOCAB_SIZE
  const logits = Array.from({ length: VOCAB_SIZE }, (_, j) =>
    finalHidden.reduce((s, v, i) => s + v * weights.Wunembed[i][j], 0)
  )

  const probabilities = softmaxVec(logits, temperature)

  const topPredictions: PredictionResult[] = probabilities
    .map((prob, id) => ({ token: VOCABULARY[id], id, logit: logits[id], probability: prob }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5)

  return { embeddings, layerOutputs, finalHidden, logits, probabilities, topPredictions }
}

// ─── State factory ────────────────────────────────────────────────────────────
export function createInitialTransformerState(): TransformerState {
  return {
    inputText: '',
    tokens: [],
    embeddings: [],
    layerOutputs: [],
    finalHidden: [],
    logits: Array(VOCAB_SIZE).fill(0),
    probabilities: Array(VOCAB_SIZE).fill(1 / VOCAB_SIZE),
    topPredictions: [],
    phase: 'idle',
    temperature: 1,
    lastOp: 'Type a sentence and click TOKENIZE',
  }
}

export function runTransformer(
  state: TransformerState,
  text: string,
  weights: TransformerWeights,
): TransformerState {
  const tokens = tokenize(text)
  if (tokens.length === 0) return { ...state, lastOp: 'No valid tokens' }
  const result = forwardPass(tokens, weights, state.temperature)
  return {
    ...state,
    inputText: text,
    tokens,
    ...result,
    phase: 'predicted',
    lastOp: `Predicted: "${result.topPredictions[0]?.token ?? '?'}" (p=${(result.topPredictions[0]?.probability * 100).toFixed(1)}%)`,
  }
}
