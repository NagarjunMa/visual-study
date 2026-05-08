import type { Stage, Metrics, Particle, SimNode, NodeHealth } from '../../simulation/types'
import { FlowConnection } from './FlowConnection'
import { ComponentBox } from './ComponentBox'
import { RequestParticle } from './RequestParticle'

interface SystemDiagramProps {
  stage: Stage
  particles: Particle[]
  metrics: Metrics
  tick: number
  showStatefulBubble?: boolean
}

// Compute node health based on metrics
function getNodeHealth(nodeId: string, stageId: string, metrics: Metrics): NodeHealth {
  // DB health from connection pool (both primary DB and replicas in replication mode)
  if ((nodeId === 'database' || nodeId === 'db-primary') && metrics.connectionPoolPct !== undefined) {
    if (metrics.connectionPoolPct >= 90) return 'overloaded'
    if (metrics.connectionPoolPct >= 70) return 'stressed'
  }

  const cpuIndex = getServerIndex(nodeId)
  if (cpuIndex === -1) return 'healthy' // not a server

  const cpu = metrics.cpuPct[cpuIndex] || 0

  // Stage 4: server-2 is dead
  if (stageId === 'stage-4' && nodeId === 'server-2') {
    return 'dead'
  }

  // Stage 9: cache-2 is dead (node failure)
  if (stageId === 'stage-9' && (nodeId.startsWith('cache-') || nodeId === 'cache')) {
    if (nodeId === 'cache-2') return 'dead'
  }

  if (cpu >= 85) return 'overloaded'
  if (cpu >= 60) return 'stressed'
  if (cpu === 0) return 'dead'

  return 'healthy'
}

function getServerIndex(nodeId: string): number {
  if (nodeId === 'server-1') return 0
  if (nodeId === 'server-2') return 1
  if (nodeId === 'server-3') return 2
  if (nodeId === 'server') return 0
  return -1
}

export function SystemDiagram({ stage, particles, metrics, tick, showStatefulBubble }: SystemDiagramProps) {
  // Enhance nodes with health and queue depth
  const enhancedNodes: (SimNode & { health?: NodeHealth; queueDepth?: number })[] = stage.nodes.map(
    node => ({
      ...node,
      health: getNodeHealth(node.id, stage.id, metrics),
      queueDepth: Math.random() < 0.1 && metrics.cpuPct[getServerIndex(node.id)] > 80 ? Math.floor(Math.random() * 15) : 0,
    })
  )

  return (
    <div className="w-full h-full overflow-hidden flex items-center justify-center" style={{ background: '#F0F0E8' }}>
      <svg
        viewBox={stage.viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="max-w-full max-h-full"
        style={{ backgroundColor: '#F0F0E8' }}
      >
        <defs>
          <pattern id="dots" width={40} height={40} patternUnits="userSpaceOnUse">
            <circle cx={20} cy={20} r={1} fill="#9A9A86" opacity={0.4} />
          </pattern>

          <marker id="arrowhead" markerWidth={10} markerHeight={10} refX={8} refY={3} orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#6B6B5A" />
          </marker>

          <filter id="particle-glow">
            <feGaussianBlur stdDeviation={2} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="node-glow-stressed">
            <feGaussianBlur stdDeviation={3} result="coloredBlur" />
            <feFlood floodColor="#f59e0b" floodOpacity={0.3} result="coloredBlur" />
          </filter>

          <filter id="node-glow-overloaded">
            <feGaussianBlur stdDeviation={4} result="coloredBlur" />
            <feFlood floodColor="#ef4444" floodOpacity={0.4} result="coloredBlur" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#dots)" />

        {/* Edges (connections) */}
        <g opacity={0.6}>
          {stage.edges.map(edge => (
            <FlowConnection key={edge.id} edge={edge} nodes={enhancedNodes} />
          ))}
        </g>

        {/* Nodes (components) */}
        <g>
          {enhancedNodes.map(node => (
            <ComponentBox key={node.id} node={node} metrics={metrics} stageId={stage.id} />
          ))}
        </g>

        {/* Particles (requests flowing through) */}
        <g opacity={0.9}>
          {particles.map(particle => (
            <RequestParticle key={particle.id} particle={particle} tick={tick} />
          ))}
        </g>

        {/* Stateful Auth Question Bubble — shows during stateful mode */}
        {showStatefulBubble && (
          <g className="animate-pulse">
            {/* Bubble background */}
            <rect x="330" y="40" width="240" height="80" rx="10" fill="#E8E6D8" stroke="#D4654A" strokeWidth="1.5" />
            {/* Tail pointing to server */}
            <polygon points="435,120 465,120 450,145" fill="#E8E6D8" stroke="#D4654A" strokeWidth="1" />
            {/* Question mark */}
            <text x="365" y="100" fill="#D4654A" fontFamily="monospace" fontSize="40" fontWeight="bold" textAnchor="middle">
              ?
            </text>
            {/* Labels */}
            <text x="410" y="68" fill="#7A7A6E" fontFamily="monospace" fontSize="11" letterSpacing="1">
              SESSION
            </text>
            <text x="410" y="84" fill="#7A7A6E" fontFamily="monospace" fontSize="11" letterSpacing="1">
              LOOKUP
            </text>
            <text x="410" y="102" fill="#D4654A" fontFamily="monospace" fontSize="10">
              in-memory...
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
