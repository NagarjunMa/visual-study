import type { SimNode, SimEdge } from '../../simulation/types'

interface FlowConnectionProps {
  edge: SimEdge
  nodes: SimNode[]
}

function findNode(nodes: SimNode[], id: string): SimNode | undefined {
  return nodes.find(n => n.id === id)
}

const BOX_HALF_W = 42  // matches ComponentBox width ±42
const BOX_HALF_H = 25  // matches ComponentBox height ±25

export function FlowConnection({ edge, nodes }: FlowConnectionProps) {
  const from = findNode(nodes, edge.from)
  const to = findNode(nodes, edge.to)

  if (!from || !to) return null

  const dx = to.x - from.x
  const dy = to.y - from.y
  let d: string

  if (Math.abs(dy) > Math.abs(dx)) {
    // Vertical edge (replication / session-store downward flows)
    const x1 = from.x
    const y1 = dy > 0 ? from.y + BOX_HALF_H : from.y - BOX_HALF_H
    const x2 = to.x
    const y2 = dy > 0 ? to.y - BOX_HALF_H : to.y + BOX_HALF_H
    const mid = y1 + (y2 - y1) * 0.5
    d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`
  } else {
    // Horizontal edge (left-to-right data flow)
    const x1 = from.x + BOX_HALF_W
    const y1 = from.y
    const x2 = to.x - BOX_HALF_W
    const y2 = to.y
    const cx = x1 + (x2 - x1) * 0.5
    d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
  }

  return (
    <>
      {/* Background layer for depth */}
      <path
        d={d}
        stroke="#B0B09A"
        strokeWidth={3}
        fill="none"
        opacity={0.3}
      />
      {/* Animated flow layer */}
      <path
        d={d}
        stroke="#8A8A76"
        strokeWidth={1.5}
        strokeDasharray="8 6"
        fill="none"
        markerEnd="url(#arrowhead)"
        opacity={0.8}
        className="flow-line"
      />
    </>
  )
}
