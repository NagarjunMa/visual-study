import type { ReactNode } from 'react'

export interface LearningTraceStep {
  title: string
  detail: string
  meta?: string
  color?: string
}

export interface LearningEvent {
  id: string | number
  text: string
  color?: string
}

interface LearningModuleShellProps {
  visual: ReactNode
  traceTitle?: string
  traceMeta?: string
  traceSteps: LearningTraceStep[]
  stateTitle?: string
  stateBody: ReactNode
  eventsTitle?: string
  events: LearningEvent[]
  emptyEventText?: string
  latestKey?: string
  controls: ReactNode
  minVisualHeight?: number
}

const CREAM = '#F0F0E8'
const CREAM_ALT = '#E8E6D8'
const BORDER = '#B0B09A'
const MUTED = '#7A7A6E'
const TEXT = '#2A2A28'
const CORAL = '#D4654A'

export function LearningModuleShell({
  visual,
  traceTitle = 'REQUEST DECISION TRACE',
  traceMeta,
  traceSteps,
  stateTitle = 'WHAT IS MONITORED',
  stateBody,
  eventsTitle = 'EVENT DISPLAY',
  events,
  emptyEventText = 'Run a step to see the event log.',
  latestKey,
  controls,
  minVisualHeight = 220,
}: LearningModuleShellProps) {
  return (
    <div
      className="grid h-full min-h-0 overflow-hidden"
      style={{ gridTemplateRows: `minmax(${minVisualHeight}px, 1fr) auto auto` }}
    >
      <div className="relative overflow-hidden min-h-0" style={{ background: CREAM }}>
        {visual}
      </div>

      <div
        className="grid grid-rows-[auto_1fr] gap-3 px-3 py-3"
        style={{ background: CREAM_ALT, borderTop: `2px solid ${BORDER}` }}
      >
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="font-pixel" style={{ color: CORAL, fontSize: '8px', letterSpacing: '0.08em' }}>
              {traceTitle}
            </div>
            {traceMeta && (
              <div className="font-mono-clean text-xs" style={{ color: MUTED }}>
                {traceMeta}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {traceSteps.map(step => (
              <div
                key={step.title}
                className="min-w-0"
                style={{
                  background: CREAM,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `4px solid ${step.color ?? '#4A6FA5'}`,
                  borderRadius: '4px',
                  padding: '10px',
                  minHeight: '88px',
                }}
              >
                <div className="font-pixel mb-2" style={{ color: step.color ?? '#4A6FA5', fontSize: '7px', letterSpacing: '0.06em' }}>
                  {step.title}
                </div>
                <div className="font-mono-clean" style={{ color: TEXT, fontSize: '12px', lineHeight: '1.3' }}>
                  {step.detail}
                </div>
                {step.meta && (
                  <div className="font-terminal mt-2" style={{ color: MUTED, fontSize: '14px', lineHeight: '1.05' }}>
                    {step.meta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-3">
          <div
            className="min-w-0"
            style={{
              background: CREAM,
              border: `1px solid ${BORDER}`,
              borderRadius: '4px',
              padding: '10px',
            }}
          >
            <div className="font-pixel mb-2" style={{ color: '#4A6FA5', fontSize: '7px', letterSpacing: '0.06em' }}>
              {stateTitle}
            </div>
            <div className="font-mono-clean" style={{ color: TEXT, fontSize: '12px', lineHeight: '1.4' }}>
              {stateBody}
            </div>
          </div>

          <div
            className="min-w-0"
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', overflow: 'hidden' }}
          >
            <div className="font-pixel" style={{ color: '#93c5fd', fontSize: '7px', letterSpacing: '0.06em', padding: '8px 10px 4px' }}>
              {eventsTitle}
            </div>
            <div style={{ maxHeight: '76px', overflowY: 'auto', padding: '0 10px 8px' }}>
              {events.length > 0 ? events.map(event => (
                <div key={event.id} style={{ color: event.color ?? '#cbd5e1', fontSize: '13px', fontFamily: "'VT323', monospace", lineHeight: '15px' }}>
                  {event.text}
                </div>
              )) : (
                <div style={{ color: MUTED, fontSize: '13px', fontFamily: "'VT323', monospace" }}>
                  {emptyEventText}
                </div>
              )}
              {latestKey && (
                <div style={{ color: '#cbd5e1', fontSize: '12px', fontFamily: "'VT323', monospace", lineHeight: '14px', marginTop: '4px' }}>
                  latest key: {latestKey}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap px-3 py-2" style={{ background: CREAM_ALT, borderTop: `1px solid ${BORDER}`, minHeight: '48px' }}>
        {controls}
      </div>
    </div>
  )
}
