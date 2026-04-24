import { motion } from 'framer-motion'
import type { SimNode, NodeHealth } from '../../simulation/types'

interface ComponentBoxProps {
  node: SimNode & { health?: NodeHealth; queueDepth?: number }
  metrics?: any
  stageId?: string
}

const typeConfig: Record<string, { color: string; name: string }> = {
  client: { color: '#3b82f6', name: 'CLIENT' },
  server: { color: '#22c55e', name: 'SERVER' },
  database: { color: '#0ea5e9', name: 'DATABASE' },
  'db-replica': { color: '#86efac', name: 'DB REPLICA' },
  'load-balancer': { color: '#a855f7', name: 'LOAD BALANCER' },
  cache: { color: '#f59e0b', name: 'CACHE' },
  'api-gateway': { color: '#6366f1', name: 'API GATEWAY' },
  'session-store': { color: '#06b6d4', name: 'SESSION' },
  'cache-cluster': { color: '#f59e0b', name: 'CACHE CLUSTER' },
}

function getStatusText(node: SimNode, metrics?: any, stageId?: string): string {
  if (!metrics) return ''
  switch (node.type) {
    case 'client':
      return `${metrics.rps >= 1000 ? (metrics.rps / 1000).toFixed(1) + 'k' : metrics.rps} RPS`
    case 'server': {
      // Per-server CPU display
      const idx = node.id === 'server-1' ? 0 : node.id === 'server-2' ? 1 : node.id === 'server-3' ? 2 : 0
      const cpu = metrics.cpuPct?.[idx] ?? 0
      // Stage 2: show auth method instead of CPU
      if (stageId === 'stage-2') {
        return 'Auth: in-memory'
      }
      return `${Math.round(cpu)}% CPU`
    }
    case 'database': {
      // Show pool usage if available
      if (metrics.connectionPoolPct !== undefined && metrics.connectionPoolPct > 0) {
        return `Pool: ${Math.round(metrics.connectionPoolPct)}%`
      }
      return metrics.rps ? `${Math.round(metrics.rps / 3)} q/s` : ''
    }
    case 'db-replica': {
      // Read replica status
      return 'Read Replica'
    }
    case 'load-balancer':
      return metrics.rps ? `${Math.round(metrics.rps / 3)} RPS/srv` : ''
    case 'cache':
      return metrics.cacheHitPct ? `${Math.round(metrics.cacheHitPct)}% hit` : ''
    case 'cache-cluster':
      return metrics.cacheHitPct ? `${Math.round(metrics.cacheHitPct)}% hit` : ''
    case 'api-gateway':
      return metrics.rejectedRPS ? `${Math.round(metrics.rejectedRPS)} rej` : ''
    case 'session-store':
      return 'Sessions'
    default:
      return ''
  }
}

function renderIcon(type: string) {
  const iconSize = 20
  const iconProps = { width: iconSize, height: iconSize, viewBox: '0 0 24 24' }

  switch (type) {
    case 'client':
      return (
        <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* Two user heads */}
          <circle cx="8" cy="6" r="2" />
          <circle cx="16" cy="6" r="2" />
          {/* Bodies */}
          <path d="M 6 8 Q 6 10 8 10 Q 10 10 10 8" />
          <path d="M 14 8 Q 14 10 16 10 Q 18 10 18 8" />
        </svg>
      )

    case 'server':
      return (
        <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* Server stack */}
          <rect x="4" y="4" width="16" height="3" rx="1" />
          <rect x="4" y="9" width="16" height="3" rx="1" />
          <rect x="4" y="14" width="16" height="3" rx="1" />
          <circle cx="20" cy="5.5" r="1" fill="currentColor" />
        </svg>
      )

    case 'database':
      return (
        <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* Cylinder */}
          <ellipse cx="12" cy="5" rx="6" ry="2" />
          <line x1="6" y1="5" x2="6" y2="15" />
          <line x1="18" y1="5" x2="18" y2="15" />
          <ellipse cx="12" cy="15" rx="6" ry="2" />
        </svg>
      )

    case 'db-replica':
      return (
        <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* Cylinder with replication arrows */}
          <ellipse cx="12" cy="5" rx="6" ry="2" />
          <line x1="6" y1="5" x2="6" y2="15" />
          <line x1="18" y1="5" x2="18" y2="15" />
          <ellipse cx="12" cy="15" rx="6" ry="2" />
          {/* Small double arrow indicating replica */}
          <path d="M 8 10 L 7 9 L 8 8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 16 10 L 17 11 L 16 12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    case 'load-balancer':
      return (
        <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* Funnel */}
          <path d="M 5 4 L 19 4 L 12 12 M 10 12 L 14 12 M 9 14 L 15 14" />
        </svg>
      )

    case 'api-gateway':
      return (
        <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* Shield */}
          <path d="M 12 2 L 19 6 L 19 13 C 19 18 12 21 12 21 C 12 21 5 18 5 13 L 5 6 Z" />
          {/* API text (simplified as dots) */}
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      )

    case 'cache':
      return (
        <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* Stacked layers */}
          <rect x="5" y="5" width="14" height="4" rx="1" />
          <rect x="5" y="10" width="14" height="4" rx="1" />
          <rect x="5" y="15" width="14" height="4" rx="1" />
        </svg>
      )

    case 'session-store':
      return (
        <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* Cylinder with clock overlay */}
          <ellipse cx="12" cy="6" rx="5" ry="2" />
          <line x1="7" y1="6" x2="7" y2="14" />
          <line x1="17" y1="6" x2="17" y2="14" />
          <ellipse cx="12" cy="14" rx="5" ry="2" />
          {/* Clock hands */}
          <circle cx="12" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth={1} />
          <line x1="12" y1="9" x2="12" y2="7" strokeWidth={1} />
        </svg>
      )

    case 'cache-cluster':
      return (
        <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* 3 overlapping cylinders */}
          <ellipse cx="7" cy="6" rx="3" ry="2" />
          <line x1="4" y1="6" x2="4" y2="12" />
          <line x1="10" y1="6" x2="10" y2="12" />
          <ellipse cx="7" cy="12" rx="3" ry="2" />
          {/* Right cylinder */}
          <ellipse cx="15" cy="8" rx="3" ry="2" />
          <line x1="12" y1="8" x2="12" y2="14" />
          <line x1="18" y1="8" x2="18" y2="14" />
          <ellipse cx="15" cy="14" rx="3" ry="2" />
        </svg>
      )

    default:
      return <svg {...iconProps} />
  }
}

export function ComponentBox({ node, metrics, stageId }: ComponentBoxProps) {
  const config = typeConfig[node.type] || { color: '#9ca3af', name: 'UNKNOWN' }
  const health = node.health || 'healthy'
  const queueDepth = node.queueDepth || 0
  const statusText = getStatusText(node, metrics, stageId)

  // Health state colors
  let borderColor = config.color
  let opacity = 1
  if (health === 'stressed') borderColor = '#f59e0b'
  if (health === 'overloaded') borderColor = '#ef4444'
  if (health === 'dead' || health === 'not-ready') {
    borderColor = '#7f1d1d'
    opacity = 0.4
  }
  if (health === 'degraded') borderColor = '#f97316'

  return (
    <motion.g
      transform={`translate(${node.x}, ${node.y})`}
      animate={{ opacity }}
      transition={{ duration: 0.3 }}
    >
      {/* Pulse ring for stressed/overloaded */}
      {(health === 'stressed' || health === 'overloaded') && (
        <motion.circle
          cx={0}
          cy={0}
          r={55}
          fill="none"
          stroke={borderColor}
          strokeWidth={2}
          animate={{ opacity: [0.2, 0.5, 0.2], r: [52, 58, 52] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      {/* Main box */}
      <motion.rect
        x={-52}
        y={-30}
        width={104}
        height={60}
        rx={8}
        fill="#1f2937"
        stroke={borderColor}
        strokeWidth={health === 'overloaded' || health === 'dead' ? 3 : 2}
      />

      {/* Color header strip */}
      <rect
        x={-52}
        y={-30}
        width={104}
        height={6}
        rx={8}
        fill={config.color}
        opacity={0.4}
      />

      {/* Icon */}
      <g transform={`translate(-10, -17)`} color={config.color}>
        {renderIcon(node.type)}
      </g>

      {/* Type label */}
      <text
        x={0}
        y={4}
        textAnchor="middle"
        fontSize={11}
        fontWeight="bold"
        fill={borderColor}
        fontFamily="monospace"
      >
        {config.name}
      </text>

      {/* Status text */}
      {statusText && (
        <text
          x={0}
          y={15}
          textAnchor="middle"
          fontSize={10}
          fill="#9ca3af"
          fontFamily="monospace"
        >
          {statusText}
        </text>
      )}

      {/* Queue depth badge */}
      {queueDepth > 0 && (
        <g>
          <rect x={22} y={-44} width={32} height={14} rx={4} fill="#ef4444" opacity={0.85} />
          <text
            x={38}
            y={-33}
            textAnchor="middle"
            fontSize={8}
            fontWeight="bold"
            fill="white"
            fontFamily="monospace"
          >
            Q:{Math.min(queueDepth, 99)}
          </text>
        </g>
      )}

      {/* Dead state X */}
      {(health === 'dead' || health === 'not-ready') && (
        <>
          <line x1={-20} y1={-14} x2={20} y2={14} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
          <line x1={20} y1={-14} x2={-20} y2={14} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
        </>
      )}

      {/* Node label below */}
      <text
        x={0}
        y={40}
        textAnchor="middle"
        fontSize={12}
        fill="#d1d5db"
        fontFamily="system-ui, sans-serif"
      >
        {node.label}
      </text>
    </motion.g>
  )
}
