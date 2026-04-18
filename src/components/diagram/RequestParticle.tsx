import type { Particle } from '../../simulation/types'

interface RequestParticleProps {
  particle: Particle
  tick: number
}

export function RequestParticle({ particle, tick }: RequestParticleProps) {
  const age = tick - particle.spawnedAt
  const progress = age / (particle.duration / 16)

  // If particle is expired, don't render
  if (progress > 1) return null

  // Calculate current position along waypoints
  if (particle.waypoints.length < 2) return null

  const waypoints = particle.waypoints
  const segmentLength = 1 / (waypoints.length - 1)
  const currentSegment = Math.floor(progress / segmentLength)
  const segmentProgress = (progress % segmentLength) / segmentLength

  if (currentSegment >= waypoints.length - 1) {
    // At or past final waypoint
    const [x, y] = waypoints[waypoints.length - 1]
    return (
      <circle
        cx={x}
        cy={y}
        r={6}
        fill={particle.color}
        opacity={Math.max(0, 1 - progress)}
        filter="url(#particle-glow)"
      />
    )
  }

  const [x1, y1] = waypoints[currentSegment]
  const [x2, y2] = waypoints[currentSegment + 1]
  const x = x1 + (x2 - x1) * segmentProgress
  const y = y1 + (y2 - y1) * segmentProgress

  // Health-check particles are smaller and no glow
  const radius = particle.type === 'health-check' ? 3 : 6
  const hasGlow = particle.type !== 'health-check'

  return (
    <circle
      cx={x}
      cy={y}
      r={radius}
      fill={particle.color}
      opacity={Math.max(0, 1 - progress)}
      filter={hasGlow ? 'url(#particle-glow)' : undefined}
    />
  )
}
