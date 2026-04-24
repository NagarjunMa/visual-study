import { useState, useEffect, useRef } from 'react'
import type { Stage } from '../simulation/types'

interface LandingPageProps {
  stages: Stage[]
  currentStageIndex: number
  onLaunch: (stageIndex: number) => void
}

export function LandingPage({ stages, currentStageIndex, onLaunch }: LandingPageProps) {
  const [selectedIndex, setSelectedIndex] = useState(currentStageIndex)
  const [selectorVisible, setSelectorVisible] = useState(false)
  const [cardsAnimated, setCardsAnimated] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !selectorVisible) {
            setSelectorVisible(true)
            setTimeout(() => setCardsAnimated(true), 350)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.2 }
    )

    if (selectorRef.current) {
      observer.observe(selectorRef.current)
    }

    return () => observer.disconnect()
  }, [selectorVisible])

  return (
    <div className="landing-overlay fixed inset-0 z-50 overflow-y-auto">
      {/* Semi-transparent backdrop so simulation shows through */}
      <div className="absolute inset-0 bg-gray-950/90 pointer-events-none" />

      {/* Content — hero + selector */}
      <main className="relative z-10 w-full overflow-x-hidden">
      {/* HERO SECTION */}
      <section className="section hero relative w-full min-h-screen flex flex-col items-center justify-center bg-gray-950 overflow-hidden">
        <div className="hero-after absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-transparent via-white to-transparent opacity-6 animate-scanline-sweep pointer-events-none z-20"></div>

        <div className="hero-vignette absolute inset-0 bg-radial-vignette pointer-events-none z-10"></div>

        <div className="hero-content relative z-30 text-center max-w-4xl px-8">
          <div className="boot-sequence mb-16 font-terminal text-2xl text-green-500 text-left inline-block">
            <div className="boot-line animate-boot-appear">&gt; INITIALIZING SYSTEM DESIGN SIMULATOR v1.0...</div>
            <div className="boot-line animate-boot-appear" style={{ animationDelay: '0.4s' }}>&gt; LOADING ARCHITECTURE MODULES........... [OK]</div>
            <div className="boot-line animate-boot-appear" style={{ animationDelay: '0.8s' }}>&gt; SPAWNING PARTICLE ENGINE............... [OK]</div>
            <div className="boot-line animate-boot-appear" style={{ animationDelay: '1.2s' }}>&gt; READY.</div>
          </div>

          <h1 className="hero-title font-pixel text-5xl text-cyan-400 mb-8 leading-tight opacity-0 animate-title-appear" style={{ animationDelay: '1.6s' }}>
            SYSTEM DESIGN<br />SIMULATOR
          </h1>

          <p className="hero-subtitle font-terminal text-3xl text-amber-500 mb-16 opacity-0 animate-subtitle-appear" style={{ animationDelay: '2s' }}>
            MASTER DISTRIBUTED SYSTEMS ARCHITECTURE
          </p>

          <p className="hero-prompt font-terminal text-2xl text-green-500 opacity-0 animate-blink" style={{ animationDelay: '2.4s' }}>
            ▼ SELECT SIMULATION ▼
          </p>
        </div>

        <div className="scroll-cue absolute bottom-9 left-1/2 -translate-x-1/2 font-pixel text-xs text-gray-700 text-center z-30 opacity-0 animate-blink" style={{ animationDelay: '2.8s' }}>
          SCROLL<br /><span className="text-lg text-gray-700">▼</span>
        </div>
      </section>

      {/* SELECTOR SECTION */}
      <section ref={selectorRef} className="section selector relative w-full py-20 bg-gradient-to-b from-gray-950 to-gray-900 flex flex-col items-center justify-center">
        <div className={`section-label font-pixel text-xs text-green-500 tracking-widest mb-8 ${selectorVisible ? 'visible' : ''}`}>
          // SELECT YOUR SIMULATION
        </div>

        <div className={`retro-window relative w-full max-w-5xl bg-gray-950 border-2 border-cyan-400 ${selectorVisible ? 'visible' : ''}`} style={{ boxShadow: '0 0 0 1px #000, inset 0 0 0 1px rgba(0,229,255,0.15), 0 0 16px rgba(0,229,255,0.2)' }}>
          <div className="window-titlebar flex items-center justify-between px-3 py-1.5 bg-blue-900 border-b border-blue-700">
            <span className="font-pixel text-xs text-white tracking-widest">[ SIMULATION SELECT ]</span>
            <div className="window-controls flex gap-1">
              <span className="window-control w-2.5 h-2.5 bg-black border border-cyan-400"></span>
              <span className="window-control w-2.5 h-2.5 bg-black border border-cyan-400"></span>
              <span className="window-control w-2.5 h-2.5 bg-black border border-cyan-400"></span>
            </div>
          </div>

          <div className="window-body p-6">
            <div className="stage-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
              {stages.map((stage, idx) => (
                <button
                  key={stage.id}
                  onClick={() => {
                    setSelectedIndex(idx)
                  }}
                  className={`stage-card p-5 text-left transition-all duration-150 min-h-56 flex flex-col justify-between ${
                    cardsAnimated ? 'animate-card-fade' : ''
                  } ${
                    idx === selectedIndex
                      ? 'active border-cyan-400 bg-gradient-to-br from-blue-900 to-blue-950'
                      : 'border-gray-700 bg-black hover:border-cyan-400 hover:bg-gray-900 hover:-translate-y-1'
                  }`}
                  style={{
                    border: '2px solid',
                    animationDelay: cardsAnimated ? `${idx * 50}ms` : '0ms',
                    boxShadow: idx === selectedIndex ? '0 0 20px rgba(0,229,255,0.4), inset 0 0 0 1px rgba(0,229,255,0.3)' : '0 0 8px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,229,255,0.05)',
                  }}
                >
                  {/* Stage number and selection indicator */}
                  <div className="stage-header flex justify-between items-start mb-3">
                    <span className="font-pixel text-xs text-gray-700 tracking-widest">STAGE {idx + 1}</span>
                    <span className={`font-pixel text-sm transition-opacity ${idx === selectedIndex ? 'opacity-100 text-green-400' : 'opacity-0'}`}>▶</span>
                  </div>

                  {/* Display title and description */}
                  <div className="stage-info flex-1">
                    <span className={`block font-terminal text-2xl leading-tight mb-2 transition-colors ${idx === selectedIndex ? 'text-amber-500' : 'text-amber-500'}`}>
                      {stage.displayTitle}
                    </span>
                    <span className="block font-terminal text-base text-gray-400 mb-3 leading-relaxed">
                      {stage.description}
                    </span>

                    {/* Components list */}
                    <div className="flex flex-wrap gap-1.5">
                      {stage.components.map(comp => (
                        <span
                          key={comp}
                          className="font-terminal text-sm text-cyan-600 border border-cyan-900 px-2 py-1 bg-black/50 rounded"
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => onLaunch(selectedIndex)}
              className={`launch-btn w-full px-4 py-3 bg-black text-cyan-400 font-pixel text-xs uppercase tracking-widest transition-all duration-150 hover:text-green-400 ${cardsAnimated ? 'animate-card-fade' : ''}`}
              style={{
                border: 'none',
                animationDelay: cardsAnimated ? `${stages.length * 50 + 120}ms` : '0ms',
                boxShadow: '0 0 0 2px #00e5ff, 0 0 0 4px #000, 0 0 0 5px #005566, 0 5px 0 5px #003344, 0 0 14px rgba(0,229,255,0.25)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 2px #00ff41, 0 0 0 4px #000, 0 0 0 5px #004d00, 0 5px 0 5px #002200, 0 0 20px rgba(0,255,65,0.35)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 2px #00e5ff, 0 0 0 4px #000, 0 0 0 5px #005566, 0 5px 0 5px #003344, 0 0 14px rgba(0,229,255,0.25)'
              }}
            >
              ▶ LAUNCH SIMULATION
            </button>
          </div>
        </div>
      </section>
      </main>
    </div>
  )
}
