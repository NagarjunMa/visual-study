import type { StageInfoCard, FixModeConfig } from '../simulation/types'

interface InfoCardProps {
  infoCard: StageInfoCard
  fixModes?: FixModeConfig[]
  fixModeIndex: number
  onAdvanceFix: () => void
}

export function InfoCard({ infoCard, fixModes, fixModeIndex, onAdvanceFix }: InfoCardProps) {
  // Determine if we're in a fix mode and which one
  const inFixMode = fixModeIndex >= 0 && fixModes
  const activeFix = inFixMode ? fixModes[fixModeIndex] : null
  const hasNextFix = inFixMode && fixModeIndex < fixModes.length - 1

  // Merge infoCard with active fix mode overrides
  const technicalTerm = activeFix?.technicalTerm ?? infoCard.technicalTerm
  const whenHappens = activeFix?.whenHappens ?? infoCard.whenHappens
  const whatCondition = activeFix?.whatCondition ?? infoCard.whatCondition
  const howToResolve = activeFix?.howToResolve ?? infoCard.howToResolve

  return (
    <div className="info-card space-y-3 p-4">
      {/* Technical Term */}
      <div className="border-t border-gray-800 pt-4">
        <div className="font-pixel text-xs text-cyan-500 tracking-widest mb-2">TECHNICAL TERM</div>
        <div className="font-terminal text-base text-cyan-300">{technicalTerm}</div>
      </div>

      {/* When Happens */}
      <div className="border-t border-gray-800 pt-3">
        <div className="font-pixel text-xs text-amber-500 tracking-widest mb-2">WHEN DOES THIS HAPPEN</div>
        <p className="font-terminal text-base text-gray-400 leading-snug">{whenHappens}</p>
      </div>

      {/* What Condition */}
      <div className="border-t border-gray-800 pt-3">
        <div className="font-pixel text-xs text-amber-500 tracking-widest mb-2">WHAT IS THIS CONDITION</div>
        <p className="font-terminal text-base text-gray-400 leading-snug">{whatCondition}</p>
      </div>

      {/* How to Resolve */}
      <div className="border-t border-gray-800 pt-3">
        <div className="font-pixel text-xs text-green-500 tracking-widest mb-2">HOW TO RESOLVE</div>
        <p className="font-terminal text-base text-gray-400 leading-snug">{howToResolve}</p>
      </div>

      {/* Fix Buttons or Optimized State */}
      <div className="border-t border-gray-800 pt-4">
        {!inFixMode && fixModes && fixModes.length > 0 ? (
          // Problem state: show first fix button
          <button
            onClick={onAdvanceFix}
            className="w-full px-3 py-2 bg-black text-green-400 font-pixel text-sm uppercase tracking-widest border border-green-600 hover:border-green-400 hover:text-green-300 transition-colors"
            style={{
              boxShadow: '0 0 0 1px rgba(34,197,94,0.2), inset 0 0 0 1px rgba(34,197,94,0.1)',
            }}
          >
            ▶ {fixModes[0].enterLabel}
          </button>
        ) : hasNextFix ? (
          // Fix mode with more fixes available
          <button
            onClick={onAdvanceFix}
            className="w-full px-3 py-2 bg-black text-cyan-400 font-pixel text-sm uppercase tracking-widest border border-cyan-600 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
            style={{
              boxShadow: '0 0 0 1px rgba(0,229,255,0.2), inset 0 0 0 1px rgba(0,229,255,0.1)',
            }}
          >
            ▶ {fixModes[fixModeIndex + 1].enterLabel}
          </button>
        ) : inFixMode ? (
          // Final fix state
          <div className="w-full px-3 py-2 text-center bg-green-950/30 text-green-400 font-pixel text-sm border border-green-700">
            ✓ OPTIMIZED
          </div>
        ) : null}
      </div>
    </div>
  )
}
