import { useState, useEffect } from 'react'
import { stages } from './simulation/stages'
import { useSimulation } from './simulation/engine'
import { SystemDiagram } from './components/diagram/SystemDiagram'
import { LandingPage } from './components/LandingPage'
import { InfoCard } from './components/InfoCard'

function App() {
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showSelector, setShowSelector] = useState(true)
  const [inFixMode, setInFixMode] = useState(false)
  const [fromSimulation, setFromSimulation] = useState(false)

  const currentStage = stages[currentStageIndex]

  // Reset fix mode when stage changes
  useEffect(() => {
    setInFixMode(false)
  }, [currentStageIndex])

  // Compute effective stage for diagram and simulation
  const diagramStage = (inFixMode && currentStage.fixMode)
    ? {
        ...currentStage,
        id: currentStage.fixMode.engineId,
        nodes: currentStage.fixMode.nodes,
        edges: currentStage.fixMode.edges,
        viewBox: currentStage.fixMode.viewBox,
      }
    : currentStage

  const { particles, metrics, tick } = useSimulation(diagramStage, isPlaying)

  function handleLaunch(idx: number) {
    setCurrentStageIndex(idx)
    setShowSelector(false)
    setIsPlaying(true)
    setFromSimulation(false)
  }

  // Simulation view: sidebar + diagram split layout
  if (!showSelector) {
    return (
      <div className="flex w-full h-screen bg-gray-950 text-white overflow-hidden">
        {/* LEFT: InfoCard sidebar */}
        <div
          className="flex-shrink-0 w-80 h-full overflow-y-auto bg-gray-950"
          style={{
            borderRight: '1px solid rgba(255,176,0,0.3)',
            boxShadow: 'inset -2px 0 0 rgba(255,176,0,0.05), inset -1px 0 0 rgba(255,176,0,0.15)',
          }}
        >
          {/* ESC button at top of sidebar */}
          <div className="p-3" style={{ borderBottom: '1px solid rgba(255,176,0,0.2)' }}>
            <button
              className="esc-btn show"
              style={{ position: 'static', opacity: 1, transform: 'none' }}
              onClick={() => {
                setShowSelector(true)
                setFromSimulation(true)
              }}
              aria-label="Back to selector"
            >
              <span className="esc-arrow">▶</span> ESC
            </button>
          </div>

          {/* Stage title */}
          <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid rgba(255,176,0,0.25)' }}>
            <div className="font-pixel text-xs text-gray-600 mb-1">SIMULATION</div>
            <div className="font-terminal text-xl text-amber-500">{currentStage.displayTitle}</div>
            {inFixMode && currentStage.fixMode && (
              <div className="font-terminal text-xs text-green-400 mt-1">{currentStage.fixMode.description}</div>
            )}
          </div>

          {/* Info Card content */}
          <InfoCard
            infoCard={currentStage.infoCard}
            inFixMode={inFixMode}
            onApplyFix={() => setInFixMode(true)}
            canFix={!!currentStage.fixMode}
          />
        </div>

        {/* RIGHT: Simulation area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Metrics HUD — top-right of simulation area */}
          <div className="metrics-hud show" style={{ position: 'absolute' }}>
            <div className="metrics-header">SYSTEM METRICS</div>
            <div className="metrics-row ok"><span>RPS</span><span className="val">{metrics.rps >= 1000 ? (metrics.rps / 1000).toFixed(1) + 'k' : metrics.rps}</span></div>
            <div className="metrics-row ok"><span>LATENCY</span><span className="val">{Number.isFinite(metrics.latencyMs) ? metrics.latencyMs + 'ms' : '∞'}</span></div>
            <div className={`metrics-row ${metrics.errorPct > 0 ? 'err' : 'ok'}`}><span>ERROR RATE</span><span className="val">{metrics.errorPct.toFixed(1)}%</span></div>
            <div className="metrics-row ok"><span>CPU (avg)</span><span className="val">{(metrics.cpuPct.reduce((a, b) => a + b, 0) / metrics.cpuPct.length).toFixed(0)}%</span></div>
            {metrics.cacheHitPct !== undefined && metrics.cacheHitPct > 0 && (
              <div className="metrics-row ok"><span>CACHE HIT</span><span className="val">{metrics.cacheHitPct.toFixed(0)}%</span></div>
            )}
            {metrics.connectionPoolPct !== undefined && (
              <div className={`metrics-row ${metrics.connectionPoolPct > 80 ? 'err' : 'warn'}`}><span>DB POOL</span><span className="val">{metrics.connectionPoolPct.toFixed(0)}%</span></div>
            )}
            <button
              className="pause-btn"
              onClick={() => setIsPlaying(p => !p)}
            >
              {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
            </button>
          </div>

          {/* Simulation diagram */}
          <SystemDiagram
            stage={diagramStage}
            particles={particles}
            metrics={metrics}
            tick={tick}
            showStatefulBubble={currentStage.id === 'stage-2' && !inFixMode}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-gray-950 text-white overflow-hidden">
      {/* SELECTOR OVERLAY — hero + stage grid */}
      <LandingPage
        stages={stages}
        currentStageIndex={currentStageIndex}
        onLaunch={handleLaunch}
        skipHero={fromSimulation}
      />
    </div>
  )
}

export default App
