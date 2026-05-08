import type { KafkaState, KafkaMessage, RecentEvent } from './kafka.types'

export const BROKER_COUNT = 3
export const PARTITION_COUNT = 3
export const REPLICATION_FACTOR = 2
export const MAX_EVENTS = 6

export const PARTITION_COLORS = ['#2563eb', '#047857', '#7c3aed']

function djb2Hash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

export function getPartitionForKey(key: string, count: number = PARTITION_COUNT): number {
  return djb2Hash(key) % count
}

let eventCounter = 0
function addEvent(state: KafkaState, text: string, color: string): RecentEvent[] {
  const evt: RecentEvent = { id: ++eventCounter, text, color }
  return [...state.recentEvents, evt].slice(-MAX_EVENTS)
}

// ─── Mode-aware initial state ─────────────────────────────────────────────────
export function createInitialKafkaState(mode: number = -1): KafkaState {
  eventCounter = 0

  if (mode <= -1) {
    // Base mode: 1 partition, no brokers concept, 1 consumer
    return {
      brokers: [{ id: 0, alive: true }],
      partitions: [{
        id: 0, topicName: 'events', leaderId: 0,
        replicas: [0], isr: [0], messages: [], hwm: 0, leo: 0,
      }],
      consumerGroups: [{
        id: 'app', consumers: [{ id: 'C0', assignedPartitions: [0] }],
        offsets: { 0: 0 }, isRebalancing: false,
      }],
      controllerId: 0, isElecting: false, acksMode: 'acks-1',
      lastOp: 'Topic "events" ready. Produce a message to start.',
      messageCounter: 0, recentEvents: [], pendingHwm: null,
    }
  }

  if (mode === 0) {
    // Partitions mode: 3 partitions, still single logical broker, 1 consumer
    return {
      brokers: [{ id: 0, alive: true }],
      partitions: Array.from({ length: PARTITION_COUNT }, (_, i) => ({
        id: i, topicName: 'events', leaderId: 0,
        replicas: [0], isr: [0], messages: [], hwm: 0, leo: 0,
      })),
      consumerGroups: [{
        id: 'app', consumers: [{ id: 'C0', assignedPartitions: [0, 1, 2] }],
        offsets: { 0: 0, 1: 0, 2: 0 }, isRebalancing: false,
      }],
      controllerId: 0, isElecting: false, acksMode: 'acks-1',
      lastOp: 'Topic "events" with 3 partitions. Try different keys.',
      messageCounter: 0, recentEvents: [], pendingHwm: null,
    }
  }

  // Mode 1+ : Full cluster with brokers + replication
  const brokers = Array.from({ length: BROKER_COUNT }, (_, i) => ({ id: i, alive: true }))
  const partitions = Array.from({ length: PARTITION_COUNT }, (_, i) => ({
    id: i, topicName: 'events',
    leaderId: i % BROKER_COUNT,
    replicas: [i % BROKER_COUNT, (i + 1) % BROKER_COUNT],
    isr: [i % BROKER_COUNT, (i + 1) % BROKER_COUNT],
    messages: [], hwm: 0, leo: 0,
  }))

  const consumerCount = mode >= 3 ? 1 : 1
  const consumers = Array.from({ length: consumerCount }, (_, i) => ({
    id: `C${i}`, assignedPartitions: mode >= 3 ? [0, 1, 2] : [0, 1, 2],
  }))

  return {
    brokers, partitions,
    consumerGroups: [{
      id: 'app', consumers,
      offsets: { 0: 0, 1: 0, 2: 0 }, isRebalancing: false,
    }],
    controllerId: 0, isElecting: false, acksMode: 'acks-1',
    lastOp: `Kafka cluster: ${BROKER_COUNT} brokers, ${PARTITION_COUNT} partitions, RF=${REPLICATION_FACTOR}.`,
    messageCounter: 0, recentEvents: [], pendingHwm: null,
  }
}

// ─── Produce (works for all modes) ────────────────────────────────────────────
export function kafkaProduce(state: KafkaState, key: string, value: string): KafkaState {
  const partCount = state.partitions.length
  const partitionId = getPartitionForKey(key, partCount)
  const partition = state.partitions[partitionId]

  if (partition.leaderId < 0 || !state.brokers[partition.leaderId]?.alive) {
    const events = addEvent(state, `✗ P${partitionId} no leader — produce failed`, '#ef4444')
    return { ...state, recentEvents: events, lastOp: `FAILED — P${partitionId} unavailable` }
  }

  const offset = partition.leo
  const msg: KafkaMessage = { key, value, offset, partition: partitionId, timestamp: Date.now() }

  const newPartitions = state.partitions.map((p, i) => {
    if (i !== partitionId) return p
    const newLeo = p.leo + 1
    const newHwm = state.acksMode === 'acks-1' ? newLeo : p.hwm
    return { ...p, messages: [...p.messages.slice(-15), msg], leo: newLeo, hwm: newHwm }
  })

  const routeInfo = partCount > 1 ? ` hash("${key}")%${partCount}=P${partitionId}` : ''
  const evtText = `→ P${partitionId} "${key}":"${value}" off=${offset}${routeInfo}`
  const events = addEvent(state, evtText, PARTITION_COLORS[partitionId] || '#2563eb')

  const pendingHwm = state.acksMode === 'acks-all' ? { partitionId, targetHwm: partition.leo + 1 } : null

  return {
    ...state, partitions: newPartitions,
    messageCounter: state.messageCounter + 1,
    recentEvents: events, pendingHwm,
    lastOp: `PRODUCED → P${partitionId}${routeInfo} offset=${offset}${state.acksMode === 'acks-all' ? ' [replicating...]' : ''}`,
  }
}

// ─── Commit pending (acks=all delay) ──────────────────────────────────────────
export function kafkaCommitPending(state: KafkaState): KafkaState {
  if (!state.pendingHwm) return state
  const { partitionId, targetHwm } = state.pendingHwm
  const partition = state.partitions[partitionId]

  const allIsrAlive = partition.isr.every(bId => state.brokers[bId]?.alive)
  if (!allIsrAlive) {
    const events = addEvent(state, `✗ P${partitionId} ISR incomplete — NOT committed`, '#d97706')
    return { ...state, pendingHwm: null, recentEvents: events, lastOp: `P${partitionId} ISR incomplete — data at risk!` }
  }

  const newPartitions = state.partitions.map((p, i) => i === partitionId ? { ...p, hwm: targetHwm } : p)
  const events = addEvent(state, `✓ P${partitionId} replicated → hwm=${targetHwm}`, '#047857')
  return { ...state, partitions: newPartitions, pendingHwm: null, recentEvents: events, lastOp: `P${partitionId} committed (hwm=${targetHwm})` }
}

// ─── Consume ──────────────────────────────────────────────────────────────────
export function kafkaConsume(state: KafkaState, groupId: string): KafkaState {
  const groupIdx = state.consumerGroups.findIndex(g => g.id === groupId)
  if (groupIdx === -1) return state

  const group = state.consumerGroups[groupIdx]
  if (group.isRebalancing) return { ...state, lastOp: 'BLOCKED — rebalancing in progress' }

  let consumed = 0
  const newOffsets = { ...group.offsets }
  const details: string[] = []

  for (const consumer of group.consumers) {
    for (const pId of consumer.assignedPartitions) {
      const partition = state.partitions[pId]
      if (!partition || partition.leaderId < 0) continue
      const cur = newOffsets[pId] ?? 0
      const avail = partition.hwm - cur
      if (avail > 0) {
        newOffsets[pId] = partition.hwm
        consumed += avail
        details.push(`${consumer.id}←P${pId}(${avail})`)
      }
    }
  }

  const newGroups = state.consumerGroups.map((g, i) => i === groupIdx ? { ...g, offsets: newOffsets } : g)
  const events = consumed > 0 ? addEvent(state, `← ${details.join(' ')}`, '#047857') : state.recentEvents

  return {
    ...state, consumerGroups: newGroups, recentEvents: events,
    lastOp: consumed > 0 ? `CONSUMED ${consumed}: ${details.join(', ')}` : 'All caught up.',
  }
}

// ─── Kill Broker ──────────────────────────────────────────────────────────────
export function kafkaKillBroker(state: KafkaState, brokerId: number): KafkaState {
  if (!state.brokers[brokerId]?.alive) return state

  const newBrokers = state.brokers.map(b => b.id === brokerId ? { ...b, alive: false } : b)
  const log: string[] = []
  const newPartitions = state.partitions.map(p => {
    const newIsr = p.isr.filter(id => id !== brokerId)
    if (p.leaderId === brokerId) {
      const newLeader = newIsr.find(id => newBrokers[id].alive)
      if (newLeader !== undefined) {
        log.push(`P${p.id}→B${newLeader}`)
        return { ...p, leaderId: newLeader, isr: newIsr }
      }
      log.push(`P${p.id}→NONE`)
      return { ...p, leaderId: -1, isr: [] }
    }
    return { ...p, isr: newIsr }
  })

  let ctrl = state.controllerId
  if (brokerId === ctrl) {
    const nc = newBrokers.find(b => b.alive)
    ctrl = nc?.id ?? -1
  }

  const events = addEvent(state, `☠ B${brokerId} DOWN. Elections: ${log.join(', ')}`, '#ef4444')
  return { ...state, brokers: newBrokers, partitions: newPartitions, controllerId: ctrl, isElecting: true, recentEvents: events, lastOp: `BROKER ${brokerId} KILLED. ${log.join('; ')}` }
}

// ─── Resurrect Broker ─────────────────────────────────────────────────────────
export function kafkaResurrectBroker(state: KafkaState, brokerId: number): KafkaState {
  if (state.brokers[brokerId]?.alive) return state

  const newBrokers = state.brokers.map(b => b.id === brokerId ? { ...b, alive: true } : b)
  const newPartitions = state.partitions.map(p => {
    if (p.replicas.includes(brokerId) && !p.isr.includes(brokerId)) {
      if (p.leaderId < 0) return { ...p, leaderId: brokerId, isr: [brokerId] }
      return { ...p, isr: [...p.isr, brokerId].sort() }
    }
    return p
  })

  const events = addEvent(state, `✓ B${brokerId} REVIVED`, '#047857')
  return { ...state, brokers: newBrokers, partitions: newPartitions, isElecting: false, recentEvents: events, lastOp: `BROKER ${brokerId} RESURRECTED` }
}

// ─── Consumer group operations ────────────────────────────────────────────────
export function kafkaAddConsumer(state: KafkaState, groupId: string): KafkaState {
  const gi = state.consumerGroups.findIndex(g => g.id === groupId)
  if (gi === -1) return state
  const group = state.consumerGroups[gi]
  const newId = `C${group.consumers.length}`
  const all = [...group.consumers, { id: newId, assignedPartitions: [] as number[] }]
  const rebal = all.map(c => ({ ...c, assignedPartitions: [] as number[] }))
  for (let p = 0; p < state.partitions.length; p++) rebal[p % rebal.length].assignedPartitions.push(p)
  const assign = rebal.map(c => `${c.id}→[${c.assignedPartitions}]`).join(' ')
  const newGroups = state.consumerGroups.map((g, i) => i === gi ? { ...g, consumers: rebal, isRebalancing: true } : g)
  const events = addEvent(state, `⟳ +${newId} REBALANCING: ${assign}`, '#d97706')
  return { ...state, consumerGroups: newGroups, recentEvents: events, lastOp: `ADDED ${newId}. REBALANCING...` }
}

export function kafkaRemoveConsumer(state: KafkaState, groupId: string, consumerId: string): KafkaState {
  const gi = state.consumerGroups.findIndex(g => g.id === groupId)
  if (gi === -1) return state
  const group = state.consumerGroups[gi]
  if (group.consumers.length <= 1) return { ...state, lastOp: 'Cannot remove last consumer' }
  const remaining = group.consumers.filter(c => c.id !== consumerId)
  const rebal = remaining.map(c => ({ ...c, assignedPartitions: [] as number[] }))
  for (let p = 0; p < state.partitions.length; p++) rebal[p % rebal.length].assignedPartitions.push(p)
  const assign = rebal.map(c => `${c.id}→[${c.assignedPartitions}]`).join(' ')
  const newGroups = state.consumerGroups.map((g, i) => i === gi ? { ...g, consumers: rebal, isRebalancing: true } : g)
  const events = addEvent(state, `⟳ -${consumerId} REBALANCING: ${assign}`, '#d97706')
  return { ...state, consumerGroups: newGroups, recentEvents: events, lastOp: `REMOVED ${consumerId}. REBALANCING...` }
}

export function kafkaClearRebalance(state: KafkaState): KafkaState {
  const newGroups = state.consumerGroups.map(g => ({ ...g, isRebalancing: false }))
  const events = addEvent(state, `✓ Rebalance complete`, '#047857')
  return { ...state, consumerGroups: newGroups, recentEvents: events }
}

export function kafkaSetAcks(state: KafkaState, mode: 'acks-1' | 'acks-all'): KafkaState {
  const events = addEvent(state, `⚙ acks → ${mode === 'acks-1' ? '1' : 'all'}`, '#7A7A6E')
  return { ...state, acksMode: mode, recentEvents: events, lastOp: `acks → ${mode}` }
}
