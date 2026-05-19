import { useState, useEffect } from 'react'
import { stages } from './simulation/stages'
import { useSimulation } from './simulation/engine'
import { SystemDiagram } from './components/diagram/SystemDiagram'
import { LandingPage } from './components/LandingPage'
import { InfoCard } from './components/InfoCard'
import { RedisSimulation } from './modules/redis/RedisSimulation'
import { LSMSimulation } from './modules/lsm/LSMSimulation'
import { BTreeSimulation } from './modules/btree/BTreeSimulation'
import { TransformerSimulation } from './modules/transformer/TransformerSimulation'
import { TCPSimulation } from './modules/tcp/TCPSimulation'
import { KafkaSimulation } from './modules/kafka/KafkaSimulation'
import { RateLimiterSimulation } from './modules/rate-limiter/RateLimiterSimulation'
import { ShazamSimulation } from './modules/shazam/ShazamSimulation'
import { ShardingSimulation } from './modules/sharding/ShardingSimulation'

function App() {
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showSelector, setShowSelector] = useState(true)
  const [fixModeIndex, setFixModeIndex] = useState(-1)  // -1 = problem, 0+ = fix index
  const [fromSimulation, setFromSimulation] = useState(false)

  const currentStage = stages[currentStageIndex]

  // Reset fix mode when stage changes
  useEffect(() => {
    setFixModeIndex(-1)
  }, [currentStageIndex])

  // Compute effective stage for diagram and simulation
  const activeFix = (fixModeIndex >= 0 && currentStage.fixModes)
    ? currentStage.fixModes[fixModeIndex]
    : null

  const diagramStage = activeFix
    ? {
        ...currentStage,
        id: activeFix.engineId,
        nodes: activeFix.nodes,
        edges: activeFix.edges,
        viewBox: activeFix.viewBox,
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
      <div className="flex w-full h-screen overflow-hidden" style={{ background: 'var(--retro-surface)' }}>
        {/* LEFT: InfoCard sidebar */}
        <div
          className="flex-shrink-0 w-72 h-full overflow-y-auto"
          style={{
            background: 'var(--retro-surface)',
            borderRight: '2px solid var(--retro-border)',
          }}
        >
          {/* ESC button at top of sidebar */}
          <div className="p-3" style={{ borderBottom: '1px solid var(--retro-border)' }}>
            <button
              className="esc-btn show"
              style={{ position: 'static', opacity: 1, transform: 'none' }}
              onClick={() => {
                setShowSelector(true)
                setFromSimulation(true)
              }}
              aria-label="Back to selector"
            >
              <span className="esc-arrow">◀</span> ESC
            </button>
          </div>

          {/* Stage title */}
          <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid var(--retro-border)' }}>
            <div className="font-pixel mb-1" style={{ color: 'var(--retro-muted)', fontSize: '7px', letterSpacing: '0.1em' }}>SIMULATION</div>
            <div className="font-mono-clean text-base font-bold" style={{ color: 'var(--retro-accent)' }}>{currentStage.displayTitle}</div>
            {activeFix && (
              <div className="font-mono-clean text-xs mt-1" style={{ color: '#4CAF50' }}>{activeFix.description}</div>
            )}
          </div>

          {/* Info Card content */}
          <InfoCard
            infoCard={currentStage.infoCard}
            fixModes={currentStage.fixModes}
            fixModeIndex={fixModeIndex}
            onAdvanceFix={() => setFixModeIndex(idx => idx + 1)}
            onSetFixMode={currentStage.moduleType === 'transformer' || currentStage.moduleType === 'tcp' || currentStage.moduleType === 'kafka' || currentStage.moduleType === 'rate-limiter' || currentStage.moduleType === 'shazam' || currentStage.moduleType === 'sharding' ? setFixModeIndex : undefined}
          />
        </div>

        {/* RIGHT: Simulation area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Metrics HUD — only for system design stages */}
          {!currentStage.moduleType && (
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
          )}

          {/* Conditional renderer: module vs system design */}
          {currentStage.moduleType === 'redis-kv' ? (
            <RedisSimulation stage={currentStage} fixModeIndex={fixModeIndex} />
          ) : currentStage.moduleType === 'lsm' ? (
            <LSMSimulation stage={currentStage} fixModeIndex={fixModeIndex} />
          ) : currentStage.moduleType === 'btree' ? (
            <BTreeSimulation stage={currentStage} fixModeIndex={fixModeIndex} />
          ) : currentStage.moduleType === 'transformer' ? (
            <TransformerSimulation stage={currentStage} fixModeIndex={fixModeIndex} />
          ) : currentStage.moduleType === 'tcp' ? (
            <TCPSimulation stage={currentStage} fixModeIndex={fixModeIndex} />
          ) : currentStage.moduleType === 'kafka' ? (
            <KafkaSimulation stage={currentStage} fixModeIndex={fixModeIndex} />
          ) : currentStage.moduleType === 'rate-limiter' ? (
            <RateLimiterSimulation stage={currentStage} fixModeIndex={fixModeIndex} />
          ) : currentStage.moduleType === 'shazam' ? (
            <ShazamSimulation stage={currentStage} fixModeIndex={fixModeIndex} />
          ) : currentStage.moduleType === 'sharding' ? (
            <ShardingSimulation stage={currentStage} fixModeIndex={fixModeIndex} />
          ) : (
            <SystemDiagram
              stage={diagramStage}
              particles={particles}
              metrics={metrics}
              tick={tick}
              showStatefulBubble={currentStage.id === 'stage-2' && fixModeIndex < 0}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: 'var(--retro-bg)', color: 'var(--retro-text)' }}>
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
