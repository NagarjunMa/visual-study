import { useState } from 'react'
import { stages } from './simulation/stages'
import { useSimulation } from './simulation/engine'
import { ControlPanel } from './components/ControlPanel'
import { SystemDiagram } from './components/diagram/SystemDiagram'

function App() {
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const currentStage = stages[currentStageIndex]
  const { particles, metrics, tick } = useSimulation(currentStage, isPlaying)

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <ControlPanel
        stages={stages}
        currentStageIndex={currentStageIndex}
        onSelect={setCurrentStageIndex}
        metrics={metrics}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(p => !p)}
      />
      <div className="flex-1 overflow-hidden">
        <SystemDiagram stage={currentStage} particles={particles} metrics={metrics} tick={tick} />
      </div>
    </div>
  )
}

export default App
