import type { Stage, Metrics } from '../simulation/types'

interface ControlPanelProps {
  stages: Stage[]
  currentStageIndex: number
  onSelect: (index: number) => void
  metrics: Metrics
  isPlaying: boolean
  onPlayPause: () => void
}

export function ControlPanel({
  stages,
  currentStageIndex,
  onSelect,
  metrics,
  isPlaying,
  onPlayPause,
}: ControlPanelProps) {
  const currentStage = stages[currentStageIndex]

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col p-6 overflow-y-auto">
      {/* Branding */}
      <div className="mb-8">
        <h1 className="text-xs font-mono font-bold tracking-widest text-gray-400">
          SYSTEM DESIGN
        </h1>
        <h2 className="text-xs font-mono font-bold tracking-widest text-gray-400">
          SIMULATOR
        </h2>
      </div>

      {/* Stage List */}
      <div className="mb-8">
        <h3 className="text-xs font-mono font-bold text-gray-500 mb-3 uppercase">Stages</h3>
        <div className="space-y-2">
          {stages.map((stage, idx) => (
            <button
              key={stage.id}
              onClick={() => onSelect(idx)}
              className={`w-full text-left px-3 py-2 rounded text-sm font-mono transition-colors ${
                idx === currentStageIndex
                  ? 'bg-blue-900 text-blue-100 border border-blue-700'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span className="font-bold">{idx + 1}.</span> {stage.title.split(' — ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Live Metrics */}
      <div className="mb-8">
        <h3 className="text-xs font-mono font-bold text-gray-500 mb-3 uppercase">Metrics</h3>
        <div className="space-y-2 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-gray-400">RPS</span>
            <span className="text-gray-100 font-bold">
              {metrics.rps >= 1000 ? (metrics.rps / 1000).toFixed(1) + 'k' : metrics.rps}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-400">Latency</span>
            <span className="text-gray-100 font-bold">
              {Number.isFinite(metrics.latencyMs) ? metrics.latencyMs + 'ms' : '∞'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-400">Error Rate</span>
            <span className={`font-bold ${metrics.errorPct > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {metrics.errorPct.toFixed(1)}%
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-400">CPU</span>
            <span className="text-gray-100 font-bold">
              {metrics.cpuPct.length === 1
                ? metrics.cpuPct[0].toFixed(0) + '%'
                : metrics.cpuPct.map((c) => c.toFixed(0)).join(', ') + '%'}
            </span>
          </div>

          {metrics.cacheHitPct !== undefined && metrics.cacheHitPct > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Cache Hit</span>
              <span className="text-amber-400 font-bold">{metrics.cacheHitPct.toFixed(0)}%</span>
            </div>
          )}

          {metrics.rejectedRPS !== undefined && metrics.rejectedRPS > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Rejected</span>
              <span className="text-red-400 font-bold">
                {metrics.rejectedRPS >= 1000 ? (metrics.rejectedRPS / 1000).toFixed(1) + 'k' : metrics.rejectedRPS}
              </span>
            </div>
          )}

          {metrics.connectionPoolPct !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-400">DB Pool</span>
              <span
                className={`font-bold ${metrics.connectionPoolPct > 80 ? 'text-red-400' : 'text-gray-100'}`}
              >
                {metrics.connectionPoolPct.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Play/Pause Button */}
      <div className="mb-8">
        <button
          onClick={onPlayPause}
          className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white font-mono font-bold rounded transition-colors"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>

      {/* Insight Text */}
      <div className="flex-1">
        <h3 className="text-xs font-mono font-bold text-gray-500 mb-3 uppercase">Insight</h3>
        <p className="text-sm text-gray-300 leading-relaxed">{currentStage.insight}</p>
      </div>
    </div>
  )
}
