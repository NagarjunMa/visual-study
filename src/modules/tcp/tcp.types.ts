export type TCPState =
  | 'CLOSED'
  | 'SYN_SENT'
  | 'SYN_RECEIVED'
  | 'ESTABLISHED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'TIME_WAIT'
  | 'CLOSE_WAIT'
  | 'LAST_ACK'

export interface Packet {
  id: string
  flags: string        // 'SYN' | 'SYN-ACK' | 'ACK' | 'FIN' | 'FIN-ACK' | 'RST' | 'DATA'
  seq: number
  ack: number
  from: 'client' | 'server'
  progress: number     // 0→1 animation progress
  color: string
  label: string        // Display text like "SYN seq=100"
}

export interface TCPConnection {
  clientState: TCPState
  serverState: TCPState
  clientSeq: number
  serverSeq: number
  packets: Packet[]
  nextPacketId: number
  phase: TCPPhase
  established: boolean
  dataPacketsSent: number
  lastOp: string
  retryCount: number
  timeWaitRemaining: number
}

export type TCPPhase =
  | 'idle'
  | 'syn-sent'
  | 'syn-ack-received'
  | 'established'
  | 'data-transfer'
  | 'fin-sent'
  | 'fin-ack'
  | 'time-wait'
  | 'closed'
  | 'syn-timeout'
  | 'rst-received'
