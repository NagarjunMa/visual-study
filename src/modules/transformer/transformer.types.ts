export type TransformerPhase =
  | 'idle'
  | 'tokenizing'
  | 'embedding'
  | 'mhsa-L1'
  | 'ffn-L1'
  | 'mhsa-L2'
  | 'ffn-L2'
  | 'unembedding'
  | 'softmax'
  | 'predicted'

export interface Token {
  text: string
  id: number
  position: number
}

export interface EmbeddingVector {
  tokenId: number
  values: number[]   // dim=8
  withPos: number[]  // + positional encoding
}

export interface AttentionHead {
  headIdx: number
  Q: number[][]  // seqLen × 4 (head_dim)
  K: number[][]
  V: number[][]
  rawScores: number[][]       // seqLen × seqLen
  attentionWeights: number[][] // after softmax + causal mask
  contextVectors: number[][]
}

export interface LayerOutput {
  layerIdx: number
  mhsaHeads: AttentionHead[]
  mhsaProjected: number[][]  // seqLen × 8
  ffnHidden: number[][]      // seqLen × 32
  ffnOutput: number[][]      // seqLen × 8
  output: number[][]         // seqLen × 8 (after residuals)
}

export interface PredictionResult {
  token: string
  id: number
  logit: number
  probability: number
}

export interface TransformerState {
  inputText: string
  tokens: Token[]
  embeddings: EmbeddingVector[]
  layerOutputs: LayerOutput[]
  finalHidden: number[]
  logits: number[]
  probabilities: number[]
  topPredictions: PredictionResult[]
  phase: TransformerPhase
  temperature: number
  lastOp: string
}

export interface TransformerWeights {
  embeddingTable: number[][]  // 20 × 8
  layers: Array<{
    Wq: number[][]  // 8×8
    Wk: number[][]
    Wv: number[][]
    Wo: number[][]
    W1: number[][]  // 8×32
    b1: number[]    // 32
    W2: number[][]  // 32×8
    b2: number[]    // 8
    gamma1: number[]; beta1: number[]  // layernorm L1
    gamma2: number[]; beta2: number[]  // layernorm L2
  }>
  Wunembed: number[][]  // 8 × 20
}
