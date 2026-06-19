import { useState, useEffect, useMemo, useRef } from 'react'
import type { Stage } from '../simulation/types'

interface LandingPageProps {
  stages: Stage[]
  currentStageIndex: number
  onLaunch: (stageIndex: number) => void
  skipHero?: boolean
}

interface Track {
  name: string
  description: string
  stageIndices: number[]
}

const DB_TYPES = new Set(['redis-kv', 'lsm', 'btree'])
const NET_TYPES = new Set(['tcp'])
const MSG_TYPES = new Set(['kafka'])
const RL_TYPES = new Set(['rate-limiter'])
const AUDIO_TYPES = new Set(['shazam'])
const DIST_TYPES = new Set(['sharding'])

function getTracks(stages: Stage[]): Track[] {
  const sysDesign: number[] = []
  const database: number[] = []
  const ai: number[] = []
  const networking: number[] = []
  const messaging: number[] = []
  const rateLimiting: number[] = []
  const audio: number[] = []
  const distributed: number[] = []

  stages.forEach((stage, idx) => {
    if (stage.moduleType === 'transformer') ai.push(idx)
    else if (stage.moduleType && DB_TYPES.has(stage.moduleType)) database.push(idx)
    else if (stage.moduleType && NET_TYPES.has(stage.moduleType)) networking.push(idx)
    else if (stage.moduleType && MSG_TYPES.has(stage.moduleType)) messaging.push(idx)
    else if (stage.moduleType && RL_TYPES.has(stage.moduleType)) rateLimiting.push(idx)
    else if (stage.moduleType && AUDIO_TYPES.has(stage.moduleType)) audio.push(idx)
    else if (stage.moduleType && DIST_TYPES.has(stage.moduleType)) distributed.push(idx)
    else if (!stage.moduleType) sysDesign.push(idx)
  })

  const tracks: Track[] = [
    { name: 'SYSTEM DESIGN', description: `${sysDesign.length} simulations — scaling distributed systems`, stageIndices: sysDesign },
    { name: 'DATABASE MECHANISMS', description: `${database.length} simulations — storage engine internals`, stageIndices: database },
    { name: 'TRANSFORMER / AI', description: `${ai.length} simulation — LLM inference pipeline`, stageIndices: ai },
  ]

  if (networking.length > 0) {
    tracks.push({ name: 'NETWORKING', description: `${networking.length} simulation — protocol internals`, stageIndices: networking })
  }

  if (messaging.length > 0) {
    tracks.push({ name: 'MESSAGE BROKERS', description: `${messaging.length} simulation — distributed messaging`, stageIndices: messaging })
  }

  if (rateLimiting.length > 0) {
    tracks.push({ name: 'RATE LIMITING', description: `${rateLimiting.length} simulation — request throttling algorithms`, stageIndices: rateLimiting })
  }

  if (audio.length > 0) {
    tracks.push({ name: 'AUDIO / SIGNAL PROCESSING', description: `${audio.length} simulation — audio fingerprinting`, stageIndices: audio })
  }

  if (distributed.length > 0) {
    tracks.push({ name: 'DISTRIBUTED DATA', description: `${distributed.length} simulation — sharding vs partitioning side-by-side`, stageIndices: distributed })
  }

  return tracks
}

// FAQ data
const FAQ_ITEMS = [
  {
    q: 'What is a system design simulator?',
    a: 'An interactive tool that lets you watch distributed system architectures operate in real time. See requests flow through load balancers, caches, and databases — then break things and apply fixes to understand scaling patterns.',
  },
  {
    q: 'How does a load balancer distribute traffic?',
    a: 'Our simulation shows health-check pings from the load balancer to each server. When a server dies, traffic reroutes. Compare hotspot routing vs balanced distribution and watch metrics change.',
  },
  {
    q: 'What is an LSM tree and how does compaction work?',
    a: 'LSM trees write to an in-memory Memtable, then flush to sorted SSTables on disk. Compaction merges overlapping SSTables, removing duplicates and tombstones. Our Cassandra module visualizes the entire write path.',
  },
  {
    q: 'How do B+ trees handle page splits?',
    a: 'When a leaf page overflows (>3 keys in our order-3 tree), it splits at the median. The median key pushes up to the parent. If the parent overflows, it splits too — potentially creating a new root and increasing tree height.',
  },
  {
    q: 'How do LLM transformers predict the next word?',
    a: 'Input text is tokenized, embedded into vectors, then passed through attention layers (Q×Kᵀ/√d → softmax → ×V) and feed-forward networks (GELU activation). The final hidden state is projected to vocabulary logits, then softmax produces probabilities.',
  },
  {
    q: 'Is this free? Do I need to create an account?',
    a: 'Completely free. No signup, no paywall, no tracking. Everything runs client-side in your browser. No data is sent to any server.',
  },
  {
    q: 'What technologies does this simulator cover?',
    a: '15 interactive simulations across 9 tracks: system design, database internals, AI/ML, networking, message brokers, rate limiting, audio fingerprinting, and distributed-data trade-offs.',
  },
]

export function LandingPage({ stages, currentStageIndex, onLaunch, skipHero }: LandingPageProps) {
  const [selectedIndex, setSelectedIndex] = useState(currentStageIndex)
  const [selectorVisible, setSelectorVisible] = useState(skipHero ?? false)
  const [openTracks, setOpenTracks] = useState<Set<number>>(new Set())
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set())
  const selectorRef = useRef<HTMLDivElement>(null)
  const tracks = useMemo(() => getTracks(stages), [stages])

  useEffect(() => {
    if (skipHero && selectorRef.current) {
      selectorRef.current.scrollIntoView({ behavior: 'instant' })
      setSelectorVisible(true)
      tracks.forEach((track, i) => {
        if (track.stageIndices.includes(currentStageIndex)) {
          setOpenTracks(new Set([i]))
        }
      })
    }
  }, [currentStageIndex, skipHero, tracks])

  // Shared IntersectionObserver for all scroll-triggered animations
  useEffect(() => {
    const animatedEls = document.querySelectorAll('[data-animate]')

    // skipHero: reveal everything immediately
    if (skipHero) {
      animatedEls.forEach(el => el.classList.add('revealed'))
      setSelectorVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            // Also trigger selector visibility for folder tree section
            if (entry.target.getAttribute('data-animate') === 'selector') {
              setSelectorVisible(true)
            }
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )

    animatedEls.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [skipHero])

  function toggleTrack(trackIdx: number) {
    setOpenTracks(prev => {
      const next = new Set(prev)
      if (next.has(trackIdx)) next.delete(trackIdx)
      else next.add(trackIdx)
      return next
    })
  }

  function toggleFaq(idx: number) {
    setOpenFaqs(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function scrollToSelector() {
    selectorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing-overlay fixed inset-0 z-50 overflow-y-auto" style={{ background: 'var(--retro-bg)' }}>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="section hero relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden" style={{ background: 'var(--retro-bg)' }}>
        <div className="hero-content relative z-30 text-center max-w-3xl px-8">
          <div className="boot-sequence mb-10">
            <div className="boot-line animate-boot-appear" style={{ color: 'var(--retro-muted)' }}>&gt; INITIALIZING VISUAL LEARNING ENGINE v2.0...</div>
            <div className="boot-line animate-boot-appear" style={{ animationDelay: '0.4s', color: 'var(--retro-muted)' }}>&gt; LOADING 15 INTERACTIVE MODULES........... [OK]</div>
            <div className="boot-line animate-boot-appear" style={{ animationDelay: '0.8s', color: 'var(--retro-muted)' }}>&gt; SPAWNING SIMULATION ENGINE.............. [OK]</div>
            <div className="boot-line animate-boot-appear" style={{ animationDelay: '1.2s', color: 'var(--retro-text)' }}>&gt; READY.</div>
          </div>

          <h1 className="hero-title font-pixel text-3xl md:text-4xl leading-tight mb-6 opacity-0" style={{ color: 'var(--retro-text)', animationDelay: '1.6s' }}>
            SEE HOW SYSTEMS<br />ACTUALLY WORK
          </h1>

          <p className="hero-subtitle font-mono-clean text-lg md:text-xl mb-10 opacity-0" style={{ color: 'var(--retro-accent)', animationDelay: '2s', letterSpacing: '0.08em' }}>
            INTERACTIVE SIMULATIONS FOR SYSTEM DESIGN, DATABASES & AI
          </p>

          <p className="hero-prompt font-pixel text-xs opacity-0" style={{ color: 'var(--retro-muted)', animationDelay: '2.4s' }}>
            ▼ SCROLL TO EXPLORE ▼
          </p>
        </div>

        <div className="scroll-cue absolute bottom-9 left-1/2 -translate-x-1/2 text-center z-30 opacity-0 animate-blink" style={{ animationDelay: '2.8s', color: 'var(--retro-border)' }}>
          SCROLL<br /><span className="text-lg">▼</span>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* VALUE PROPOSITION — See It / Break It / Fix It                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="section scroll-reveal relative w-full py-20 flex flex-col items-center" data-animate="valueprop" style={{ background: 'var(--retro-bg)' }}>
        <h2 className="font-pixel text-xs tracking-widest mb-4 stagger-child" style={{ color: 'var(--retro-muted)', letterSpacing: '0.2em' }}>
          // HOW IT WORKS
        </h2>

        <div className="retro-progress w-full max-w-4xl mx-6"></div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full px-6">
          {/* SEE IT */}
          <div className="retro-window window-stagger">
            <div className="window-titlebar" style={{ background: 'var(--retro-blue)' }}>
              <span className="font-pixel text-white" style={{ fontSize: '8px', letterSpacing: '0.1em' }}>SEE IT</span>
              <div className="flex gap-1.5">
                <span className="window-control" style={{ width: 10, height: 10 }}></span>
                <span className="window-control" style={{ width: 10, height: 10 }}></span>
                <span className="window-control" style={{ width: 10, height: 10 }}></span>
              </div>
            </div>
            <div className="p-5">
              <p className="font-mono-clean text-sm font-bold mb-3" style={{ color: 'var(--retro-text)' }}>
                Watch 5,000 requests/sec flow through load balancers, caches, and databases in real time.
              </p>
              <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--retro-border)' }}>
                <p className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>
                  Not diagrams. Not videos. Live animated particles.
                </p>
              </div>
            </div>
          </div>

          {/* BREAK IT */}
          <div className="retro-window window-stagger">
            <div className="window-titlebar" style={{ background: 'var(--retro-accent)' }}>
              <span className="font-pixel text-white" style={{ fontSize: '8px', letterSpacing: '0.1em' }}>BREAK IT</span>
              <div className="flex gap-1.5">
                <span className="window-control" style={{ width: 10, height: 10 }}></span>
                <span className="window-control" style={{ width: 10, height: 10 }}></span>
                <span className="window-control" style={{ width: 10, height: 10 }}></span>
              </div>
            </div>
            <div className="p-5">
              <p className="font-mono-clean text-sm font-bold mb-3" style={{ color: 'var(--retro-text)' }}>
                CPU spikes to 95%. Connection pools exhaust. Servers go dark. See every failure mode.
              </p>
              <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--retro-border)' }}>
                <p className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>
                  Not hypothetical. Watch systems crash in real time.
                </p>
              </div>
            </div>
          </div>

          {/* FIX IT */}
          <div className="retro-window window-stagger">
            <div className="window-titlebar" style={{ background: '#4CAF50' }}>
              <span className="font-pixel text-white" style={{ fontSize: '8px', letterSpacing: '0.1em' }}>FIX IT</span>
              <div className="flex gap-1.5">
                <span className="window-control" style={{ width: 10, height: 10 }}></span>
                <span className="window-control" style={{ width: 10, height: 10 }}></span>
                <span className="window-control" style={{ width: 10, height: 10 }}></span>
              </div>
            </div>
            <div className="p-5">
              <p className="font-mono-clean text-sm font-bold mb-3" style={{ color: 'var(--retro-text)' }}>
                Add a cache layer. Latency drops from 250ms to 35ms. Watch metrics recover instantly.
              </p>
              <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--retro-border)' }}>
                <p className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>
                  Not theory. Apply the fix, see numbers change.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* WHO IS THIS FOR                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="section scroll-reveal relative w-full py-20 flex flex-col items-center" data-animate="personas" style={{ background: 'var(--retro-bg)' }}>
        <h2 className="font-pixel text-xs tracking-widest mb-12" style={{ color: 'var(--retro-muted)', letterSpacing: '0.2em' }}>
          // WHO IS THIS FOR
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full px-6">
          {[
            {
              label: 'INTERVIEW PREP',
              text: 'System design round in 2 weeks? See every scaling pattern visually before you explain it on a whiteboard.',
              border: 'var(--retro-blue)',
              icon: '⎔',
            },
            {
              label: 'CS STUDENTS',
              text: 'Database course feels abstract? Watch LSM compaction merge SSTables. See B+ tree splits propagate to the root.',
              border: 'var(--retro-gold)',
              icon: '◈',
            },
            {
              label: 'CURIOUS ENGINEERS',
              text: 'You use Redis daily. Ever seen how LRU eviction actually works? Watch hash buckets fill and entries get evicted.',
              border: 'var(--retro-accent)',
              icon: '⬡',
            },
          ].map((persona, i) => (
            <div
              key={i}
              className="p-5 rounded stagger-child"
              style={{
                background: 'var(--retro-surface)',
                border: `2px solid ${persona.border}`,
                boxShadow: '2px 2px 0 var(--retro-border)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg" style={{ color: persona.border }}>{persona.icon}</span>
                <span className="font-pixel" style={{ color: persona.border, fontSize: '8px', letterSpacing: '0.1em' }}>
                  {persona.label}
                </span>
              </div>
              <p className="font-mono-clean text-sm leading-relaxed" style={{ color: 'var(--retro-text)' }}>
                {persona.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SIMULATION SELECTOR (folder tree)                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section ref={selectorRef} className="section scroll-reveal selector relative w-full py-20 flex flex-col items-center justify-center" data-animate="selector" style={{ background: 'var(--retro-bg)' }}>
        <h2 className={`section-label font-pixel text-xs tracking-widest mb-2 ${selectorVisible ? 'visible' : ''}`} style={{ color: 'var(--retro-muted)' }}>
          // SELECT YOUR SIMULATION
        </h2>

        <div className="loading-text mb-6">&gt; LOADING MODULES...</div>

        <div className={`retro-window relative w-full max-w-3xl ${selectorVisible ? 'visible' : ''}`}>
          <div className="window-titlebar">
            <span className="font-pixel text-xs text-white tracking-widest">SIMULATION SELECT</span>
            <div className="flex gap-2">
              <span className="window-control"></span>
              <span className="window-control"></span>
              <span className="window-control"></span>
            </div>
          </div>

          <div className="p-0">
            {tracks.map((track, trackIdx) => {
              const isOpen = openTracks.has(trackIdx)
              return (
                <div key={trackIdx} className="folder-item">
                  <div className="folder-header" onClick={() => toggleTrack(trackIdx)}>
                    <span className={`folder-arrow font-mono-clean ${isOpen ? 'open' : ''}`}>▶</span>
                    <div className="flex-1">
                      <div className="font-pixel text-xs" style={{ color: 'var(--retro-text)', letterSpacing: '0.1em' }}>
                        {track.name}
                      </div>
                      <div className="font-mono-clean text-xs mt-1" style={{ color: 'var(--retro-muted)' }}>
                        {track.description}
                      </div>
                    </div>
                    <span className="font-pixel text-xs" style={{ color: 'var(--retro-border-dark)' }}>
                      [{track.stageIndices.length}]
                    </span>
                  </div>

                  {isOpen && (
                    <div className="folder-children">
                      {track.stageIndices.map((stageIdx, i) => {
                        const stage = stages[stageIdx]
                        const isSelected = selectedIndex === stageIdx
                        return (
                          <div
                            key={stageIdx}
                            className={`sim-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedIndex(stageIdx)}
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-pixel text-xs" style={{ color: 'var(--retro-muted)', fontSize: '7px' }}>
                                  {String(stageIdx + 1).padStart(2, '0')}
                                </span>
                                <span className="font-mono-clean text-sm font-bold" style={{ color: isSelected ? 'var(--retro-accent)' : 'var(--retro-text)' }}>
                                  {stage.displayTitle}
                                </span>
                              </div>
                              <div className="font-mono-clean text-xs mt-1" style={{ color: 'var(--retro-muted)', paddingLeft: '24px' }}>
                                {stage.description}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2" style={{ paddingLeft: '24px' }}>
                                {stage.components.map(comp => (
                                  <span
                                    key={comp}
                                    className="font-mono-clean px-2 py-0.5 rounded text-xs"
                                    style={{
                                      color: 'var(--retro-blue)',
                                      background: 'rgba(74,111,165,0.08)',
                                      border: '1px solid rgba(74,111,165,0.2)',
                                      fontSize: '10px',
                                    }}
                                  >
                                    {comp}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {isSelected && (
                              <span className="font-pixel text-sm" style={{ color: 'var(--retro-accent)' }}>▶</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="p-5 flex justify-center" style={{ borderTop: '2px solid var(--retro-border)' }}>
            <button onClick={() => onLaunch(selectedIndex)} className="retro-btn retro-btn--accent">
              ▶ LAUNCH SIMULATION
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 font-mono-clean text-xs px-4" style={{ color: 'var(--retro-muted)' }}>
          <span>15 SIMULATIONS</span>
          <span style={{ color: 'var(--retro-border)' }}>·</span>
          <span>9 LEARNING TRACKS</span>
          <span style={{ color: 'var(--retro-border)' }}>·</span>
          <span>30+ SCENARIOS</span>
          <span style={{ color: 'var(--retro-border)' }}>·</span>
          <span>100% FREE</span>
          <span style={{ color: 'var(--retro-border)' }}>·</span>
          <span>NO SIGNUP</span>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FAQ                                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="section relative w-full py-20 flex flex-col items-center" style={{ background: 'var(--retro-bg)' }}>
        <h2 className="font-pixel text-xs tracking-widest mb-8" style={{ color: 'var(--retro-muted)', letterSpacing: '0.2em' }}>
          // FREQUENTLY ASKED
        </h2>

        <div className="retro-window flicker-reveal w-full max-w-3xl" data-animate="faq">
          <div className="window-titlebar">
            <span className="font-pixel text-xs text-white tracking-widest">FAQ.TXT</span>
            <div className="flex gap-2">
              <span className="window-control"></span>
              <span className="window-control"></span>
              <span className="window-control"></span>
            </div>
          </div>

          <div className="p-0">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqs.has(idx)
              return (
                <div key={idx} className="folder-item">
                  <div className="folder-header" onClick={() => toggleFaq(idx)}>
                    <span className={`folder-arrow font-mono-clean ${isOpen ? 'open' : ''}`}>▶</span>
                    <span className="font-mono-clean text-sm font-bold" style={{ color: 'var(--retro-text)' }}>
                      {item.q}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="folder-children" style={{ padding: '0 16px 16px 42px' }}>
                      <p className="font-mono-clean text-sm leading-relaxed" style={{ color: 'var(--retro-muted)' }}>
                        {item.a}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FINAL CTA                                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="section relative w-full py-20 flex flex-col items-center" style={{ background: 'var(--retro-bg)' }}>
        <div className="retro-window scroll-reveal scanline-sweep w-full max-w-2xl" data-animate="cta">
          <div className="window-titlebar">
            <span className="font-pixel text-xs text-white tracking-widest">READY?</span>
            <div className="flex gap-2">
              <span className="window-control"></span>
              <span className="window-control"></span>
              <span className="window-control"></span>
            </div>
          </div>

          <div className="p-10 text-center">
            <p className="font-pixel text-sm md:text-base mb-6" style={{ color: 'var(--retro-text)', letterSpacing: '0.05em' }}>
              SEE HOW SYSTEMS ACTUALLY WORK
            </p>
            <button onClick={scrollToSelector} className="retro-btn retro-btn--accent" style={{ fontSize: '12px', padding: '14px 36px' }}>
              ▶ START LEARNING — FREE
            </button>
            <p className="font-mono-clean text-xs mt-6" style={{ color: 'var(--retro-muted)' }}>
              No signup. No paywall. Just simulations.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FOOTER                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <footer className="section scroll-reveal relative w-full py-12" data-animate="footer" style={{ background: '#B8B99E', borderTop: '2px solid var(--retro-border)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Simulations column */}
            <div>
              <div className="font-pixel mb-4" style={{ color: 'var(--retro-text)', fontSize: '8px', letterSpacing: '0.1em' }}>SIMULATIONS</div>
              <div className="space-y-1">
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>├── System Design (6)</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>├── Database Internals (3)</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>├── Transformer / AI (1)</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>├── Networking (1)</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>├── Message Brokers (1)</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>├── Rate Limiting (1)</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>├── Audio Signal (1)</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>└── Distributed Data (1)</div>
              </div>
            </div>

            {/* Built with column */}
            <div>
              <div className="font-pixel mb-4" style={{ color: 'var(--retro-text)', fontSize: '8px', letterSpacing: '0.1em' }}>BUILT WITH</div>
              <div className="space-y-1">
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>React 19 · TypeScript</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>Framer Motion · Tailwind CSS</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>SVG · Vite</div>
              </div>
            </div>

            {/* Links column */}
            <div>
              <div className="font-pixel mb-4" style={{ color: 'var(--retro-text)', fontSize: '8px', letterSpacing: '0.1em' }}>LINKS</div>
              <div className="space-y-1">
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>100% client-side</div>
                <div className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>No data collected</div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 text-center" style={{ borderTop: '1px solid var(--retro-border)' }}>
            <span className="font-mono-clean text-xs" style={{ color: 'var(--retro-muted)' }}>
              Visual Learning — Interactive System Design Simulator
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
