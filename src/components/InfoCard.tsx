import type { StageInfoCard } from '../simulation/types'

interface InfoCardProps {
  infoCard: StageInfoCard
  inFixMode: boolean
  onApplyFix: () => void
  canFix: boolean
}

export function InfoCard({ infoCard, inFixMode, onApplyFix, canFix }: InfoCardProps) {
  return (
    <div className="info-card space-y-4 p-4">
      {/* Technical Term */}
      <div className="border-t border-gray-800 pt-4">
        <div className="font-pixel text-xs text-cyan-500 tracking-widest mb-2">TECHNICAL TERM</div>
        <div className="font-terminal text-sm text-cyan-300">{infoCard.technicalTerm}</div>
      </div>

      {/* When Happens */}
      <div className="border-t border-gray-800 pt-3">
        <div className="font-pixel text-xs text-amber-500 tracking-widest mb-2">WHEN DOES THIS HAPPEN</div>
        <p className="font-terminal text-xs text-gray-400 leading-relaxed">{infoCard.whenHappens}</p>
      </div>

      {/* What Condition */}
      <div className="border-t border-gray-800 pt-3">
        <div className="font-pixel text-xs text-amber-500 tracking-widest mb-2">WHAT IS THIS CONDITION</div>
        <p className="font-terminal text-xs text-gray-400 leading-relaxed">{infoCard.whatCondition}</p>
      </div>

      {/* How to Resolve */}
      <div className="border-t border-gray-800 pt-3">
        <div className="font-pixel text-xs text-green-500 tracking-widest mb-2">HOW TO RESOLVE</div>
        <p className="font-terminal text-xs text-gray-400 leading-relaxed">{infoCard.howToResolve}</p>
      </div>

      {/* Fix Button or Applied State */}
      <div className="border-t border-gray-800 pt-4">
        {canFix && infoCard.fixLabel && !inFixMode && (
          <button
            onClick={onApplyFix}
            className="w-full px-3 py-2 bg-black text-green-400 font-pixel text-xs uppercase tracking-widest border border-green-600 hover:border-green-400 hover:text-green-300 transition-colors"
            style={{
              boxShadow: '0 0 0 1px rgba(34,197,94,0.2), inset 0 0 0 1px rgba(34,197,94,0.1)',
            }}
          >
            ▶ {infoCard.fixLabel}
          </button>
        )}
        {inFixMode && (
          <div className="w-full px-3 py-2 text-center bg-green-950/30 text-green-400 font-pixel text-xs border border-green-700">
            ✓ FIX APPLIED
          </div>
        )}
      </div>
    </div>
  )
}
