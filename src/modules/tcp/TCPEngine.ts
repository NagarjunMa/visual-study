import type { TCPConnection, Packet } from './tcp.types'

let packetCounter = 0

function makePacket(
  flags: string,
  seq: number,
  ack: number,
  from: 'client' | 'server',
  color: string,
): Packet {
  const label = flags === 'DATA'
    ? `DATA seq=${seq}`
    : `${flags} seq=${seq}${ack > 0 ? ` ack=${ack}` : ''}`
  return {
    id: `pkt-${++packetCounter}`,
    flags,
    seq,
    ack,
    from,
    progress: 0,
    color,
    label,
  }
}

export function createInitialTCPState(): TCPConnection {
  packetCounter = 0
  return {
    clientState: 'CLOSED',
    serverState: 'CLOSED',
    clientSeq: 1000,
    serverSeq: 2000,
    packets: [],
    nextPacketId: 0,
    phase: 'idle',
    established: false,
    dataPacketsSent: 0,
    lastOp: 'Click CONNECT to start 3-way handshake',
    retryCount: 0,
    timeWaitRemaining: 0,
  }
}

// Advance packet animations — called on each tick
export function tickPackets(conn: TCPConnection): TCPConnection {
  const packets = conn.packets
    .map(p => ({ ...p, progress: Math.min(1, p.progress + 0.04) }))
    .filter(p => p.progress < 1.2) // keep briefly after arriving
  return { ...conn, packets }
}

// Step 1: Client sends SYN
export function sendSyn(conn: TCPConnection): TCPConnection {
  const pkt = makePacket('SYN', conn.clientSeq, 0, 'client', '#3b82f6')
  return {
    ...conn,
    clientState: 'SYN_SENT',
    phase: 'syn-sent',
    packets: [...conn.packets, pkt],
    lastOp: `Client → SYN (seq=${conn.clientSeq}). Waiting for server...`,
  }
}

// Step 2: Server responds SYN-ACK
export function sendSynAck(conn: TCPConnection): TCPConnection {
  const pkt = makePacket('SYN-ACK', conn.serverSeq, conn.clientSeq + 1, 'server', '#f59e0b')
  return {
    ...conn,
    serverState: 'SYN_RECEIVED',
    phase: 'syn-ack-received',
    packets: [...conn.packets, pkt],
    lastOp: `Server → SYN-ACK (seq=${conn.serverSeq}, ack=${conn.clientSeq + 1})`,
  }
}

// Step 3: Client sends ACK — connection established
export function sendAck(conn: TCPConnection): TCPConnection {
  const pkt = makePacket('ACK', conn.clientSeq + 1, conn.serverSeq + 1, 'client', '#22c55e')
  return {
    ...conn,
    clientState: 'ESTABLISHED',
    serverState: 'ESTABLISHED',
    clientSeq: conn.clientSeq + 1,
    serverSeq: conn.serverSeq + 1,
    phase: 'established',
    established: true,
    packets: [...conn.packets, pkt],
    lastOp: `Client → ACK (seq=${conn.clientSeq + 1}, ack=${conn.serverSeq + 1}). ESTABLISHED!`,
  }
}

// Send data packet
export function sendData(conn: TCPConnection): TCPConnection {
  const seq = conn.clientSeq + conn.dataPacketsSent + 1
  const pkt = makePacket('DATA', seq, conn.serverSeq, 'client', '#06b6d4')
  return {
    ...conn,
    dataPacketsSent: conn.dataPacketsSent + 1,
    packets: [...conn.packets, pkt],
    lastOp: `Client → DATA (seq=${seq}). ${conn.dataPacketsSent + 1} packets sent.`,
  }
}

// Connection close: Client sends FIN
export function sendFin(conn: TCPConnection): TCPConnection {
  const seq = conn.clientSeq + conn.dataPacketsSent + 1
  const pkt = makePacket('FIN', seq, conn.serverSeq, 'client', '#ef4444')
  return {
    ...conn,
    clientState: 'FIN_WAIT_1',
    phase: 'fin-sent',
    packets: [...conn.packets, pkt],
    lastOp: `Client → FIN (seq=${seq}). Initiating close.`,
  }
}

// Server ACKs FIN
export function sendFinAck(conn: TCPConnection): TCPConnection {
  const pkt = makePacket('FIN-ACK', conn.serverSeq, conn.clientSeq + conn.dataPacketsSent + 2, 'server', '#f59e0b')
  return {
    ...conn,
    clientState: 'FIN_WAIT_2',
    serverState: 'CLOSE_WAIT',
    phase: 'fin-ack',
    packets: [...conn.packets, pkt],
    lastOp: `Server → FIN-ACK. Server closing...`,
  }
}

// Server sends its FIN
export function sendServerFin(conn: TCPConnection): TCPConnection {
  const pkt = makePacket('FIN', conn.serverSeq, conn.clientSeq + conn.dataPacketsSent + 2, 'server', '#ef4444')
  return {
    ...conn,
    serverState: 'LAST_ACK',
    packets: [...conn.packets, pkt],
    lastOp: `Server → FIN. Waiting for final ACK.`,
  }
}

// Client sends final ACK, enters TIME_WAIT
export function sendFinalAck(conn: TCPConnection): TCPConnection {
  const pkt = makePacket('ACK', conn.clientSeq + conn.dataPacketsSent + 2, conn.serverSeq + 1, 'client', '#22c55e')
  return {
    ...conn,
    clientState: 'TIME_WAIT',
    serverState: 'CLOSED',
    phase: 'time-wait',
    timeWaitRemaining: 60,
    packets: [...conn.packets, pkt],
    lastOp: `Client → ACK. TIME_WAIT (2×MSL). Server CLOSED.`,
  }
}

// TIME_WAIT expires
export function timeWaitExpire(conn: TCPConnection): TCPConnection {
  return {
    ...conn,
    clientState: 'CLOSED',
    phase: 'closed',
    established: false,
    lastOp: `TIME_WAIT expired. Client CLOSED. Connection fully terminated.`,
  }
}

// SYN timeout (fix mode 0)
export function synTimeout(conn: TCPConnection): TCPConnection {
  return {
    ...conn,
    phase: 'syn-timeout',
    retryCount: conn.retryCount + 1,
    lastOp: `SYN timeout! Retry #${conn.retryCount + 1} with backoff ${Math.pow(2, conn.retryCount + 1)}s`,
  }
}

// RST received (fix mode 1)
export function sendRst(conn: TCPConnection): TCPConnection {
  const pkt = makePacket('RST', conn.serverSeq, 0, 'server', '#ef4444')
  return {
    ...conn,
    serverState: 'CLOSED',
    clientState: 'CLOSED',
    phase: 'rst-received',
    established: false,
    packets: [...conn.packets, pkt],
    lastOp: `Server → RST. Connection refused. Port closed or service unavailable.`,
  }
}
