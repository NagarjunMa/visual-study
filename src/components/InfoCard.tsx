import type { StageInfoCard, FixModeConfig } from '../simulation/types'

interface InfoCardProps {
  infoCard: StageInfoCard
  fixModes?: FixModeConfig[]
  fixModeIndex: number
  onAdvanceFix: () => void
  onSetFixMode?: (idx: number) => void
  learningObjective?: string
  misconception?: string
  interviewTakeaway?: string
}

export function InfoCard({
  infoCard,
  fixModes,
  fixModeIndex,
  onAdvanceFix,
  onSetFixMode,
  learningObjective: stageLearningObjective,
  misconception: stageMisconception,
  interviewTakeaway: stageInterviewTakeaway,
}: InfoCardProps) {
  const inFixMode = fixModeIndex >= 0 && fixModes
  const activeFix = inFixMode ? fixModes[fixModeIndex] : null
  const hasNextFix = inFixMode && fixModeIndex < fixModes.length - 1

  const technicalTerm = activeFix?.technicalTerm ?? infoCard.technicalTerm
  const whenHappens = activeFix?.whenHappens ?? infoCard.whenHappens
  const whatCondition = activeFix?.whatCondition ?? infoCard.whatCondition
  const howToResolve = activeFix?.howToResolve ?? infoCard.howToResolve
  const learningObjective = activeFix?.learningObjective ?? stageLearningObjective
  const misconception = activeFix?.misconception ?? stageMisconception
  const interviewTakeaway = activeFix?.interviewTakeaway ?? stageInterviewTakeaway

  return (
    <div className="info-card space-y-3 p-4">
      {/* Technical Term */}
      <div className="pt-4" style={{ borderTop: '1px solid var(--retro-border)' }}>
        <div className="font-pixel text-xs tracking-widest mb-2" style={{ color: 'var(--retro-blue)', fontSize: '7px' }}>TECHNICAL TERM</div>
        <div className="font-mono-clean text-sm font-bold" style={{ color: 'var(--retro-blue)' }}>{technicalTerm}</div>
      </div>

      {/* When Happens */}
      <div className="pt-3" style={{ borderTop: '1px solid var(--retro-border)' }}>
        <div className="font-pixel text-xs tracking-widest mb-2" style={{ color: 'var(--retro-accent)', fontSize: '7px' }}>WHEN DOES THIS HAPPEN</div>
        <p className="font-mono-clean text-xs leading-relaxed" style={{ color: 'var(--retro-muted)' }}>{whenHappens}</p>
      </div>

      {/* What Condition */}
      <div className="pt-3" style={{ borderTop: '1px solid var(--retro-border)' }}>
        <div className="font-pixel text-xs tracking-widest mb-2" style={{ color: 'var(--retro-accent)', fontSize: '7px' }}>WHAT IS THIS CONDITION</div>
        <p className="font-mono-clean text-xs leading-relaxed" style={{ color: 'var(--retro-muted)' }}>{whatCondition}</p>
      </div>

      {/* How to Resolve */}
      <div className="pt-3" style={{ borderTop: '1px solid var(--retro-border)' }}>
        <div className="font-pixel text-xs tracking-widest mb-2" style={{ color: '#4CAF50', fontSize: '7px' }}>HOW TO RESOLVE</div>
        <p className="font-mono-clean text-xs leading-relaxed" style={{ color: 'var(--retro-muted)' }}>{howToResolve}</p>
      </div>

      {learningObjective && (
        <div className="pt-3" style={{ borderTop: '1px solid var(--retro-border)' }}>
          <div className="font-pixel text-xs tracking-widest mb-2" style={{ color: 'var(--retro-blue)', fontSize: '7px' }}>LEARNING GOAL</div>
          <p className="font-mono-clean text-xs leading-relaxed" style={{ color: 'var(--retro-text)' }}>{learningObjective}</p>
        </div>
      )}

      {misconception && (
        <div className="pt-3" style={{ borderTop: '1px solid var(--retro-border)' }}>
          <div className="font-pixel text-xs tracking-widest mb-2" style={{ color: '#f59e0b', fontSize: '7px' }}>COMMON MISCONCEPTION</div>
          <p className="font-mono-clean text-xs leading-relaxed" style={{ color: 'var(--retro-muted)' }}>{misconception}</p>
        </div>
      )}

      {interviewTakeaway && (
        <div className="pt-3" style={{ borderTop: '1px solid var(--retro-border)' }}>
          <div className="font-pixel text-xs tracking-widest mb-2" style={{ color: '#4CAF50', fontSize: '7px' }}>INTERVIEW TAKEAWAY</div>
          <p className="font-mono-clean text-xs leading-relaxed" style={{ color: 'var(--retro-text)' }}>{interviewTakeaway}</p>
        </div>
      )}

      {/* Fix Buttons */}
      <div className="pt-4" style={{ borderTop: '1px solid var(--retro-border)' }}>
        {onSetFixMode && fixModes && fixModes.length > 0 ? (
          <div className="space-y-2">
            <button
              onClick={() => onSetFixMode(-1)}
              className="retro-btn retro-btn--sm w-full"
              style={fixModeIndex === -1 ? {
                background: 'var(--retro-accent)',
                color: 'var(--retro-surface)',
                borderColor: '#B5503A',
                boxShadow: '0 0 0 2px var(--retro-surface), 0 0 0 4px #B5503A',
              } : {}}
            >
              {fixModeIndex === -1 ? '◉' : '▶'} Pipeline Overview
            </button>
            {fixModes.map((fix, idx) => {
              const isActive = fixModeIndex === idx
              return (
                <button
                  key={idx}
                  onClick={() => onSetFixMode(isActive ? -1 : idx)}
                  className="retro-btn retro-btn--sm w-full"
                  style={isActive ? {
                    background: 'var(--retro-accent)',
                    color: 'var(--retro-surface)',
                    borderColor: '#B5503A',
                    boxShadow: '0 0 0 2px var(--retro-surface), 0 0 0 4px #B5503A',
                  } : {}}
                >
                  {isActive ? '◉' : '▶'} {fix.enterLabel}
                </button>
              )
            })}
          </div>
        ) : !inFixMode && fixModes && fixModes.length > 0 ? (
          <button onClick={onAdvanceFix} className="retro-btn retro-btn--sm w-full">
            ▶ {fixModes[0].enterLabel}
          </button>
        ) : hasNextFix ? (
          <button onClick={onAdvanceFix} className="retro-btn retro-btn--sm w-full">
            ▶ {fixModes[fixModeIndex + 1].enterLabel}
          </button>
        ) : inFixMode ? (
          <div className="retro-btn retro-btn--sm w-full" style={{ background: '#4CAF50', color: 'white', borderColor: '#388E3C', cursor: 'default' }}>
            ✓ OPTIMIZED
          </div>
        ) : null}
      </div>
    </div>
  )
}
