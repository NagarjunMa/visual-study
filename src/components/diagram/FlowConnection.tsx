import type { SimNode, SimEdge } from '../../simulation/types'

interface FlowConnectionProps {
  edge: SimEdge
  nodes: SimNode[]
}

function findNode(nodes: SimNode[], id: string): SimNode | undefined {
  return nodes.find(n => n.id === id)
}

export function FlowConnection({ edge, nodes }: FlowConnectionProps) {
  const from = findNode(nodes, edge.from)
  const to = findNode(nodes, edge.to)

  if (!from || !to) return null

  // Source: right edge of from node
  const x1 = from.x + 90
  const y1 = from.y
  // Target: left edge of to node
  const x2 = to.x - 90
  const y2 = to.y

  // Quadratic curve control points
  const cx = x1 + (x2 - x1) * 0.5
  const cy1 = y1
  const cy2 = y2

  const d = `M ${x1} ${y1} C ${cx} ${cy1}, ${cx} ${cy2}, ${x2} ${y2}`

  return (
    <>
      {/* Background layer for depth */}
      <path
        d={d}
        stroke="#111827"
        strokeWidth={4}
        fill="none"
        opacity={0.5}
      />
      {/* Animated flow layer */}
      <path
        d={d}
        stroke="#374151"
        strokeWidth={2}
        strokeDasharray="12 8"
        fill="none"
        markerEnd="url(#arrowhead)"
        opacity={0.8}
        className="flow-line"
      />
    </>
  )
}
