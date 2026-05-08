export interface KafkaBroker {
  id: number
  alive: boolean
}

export interface KafkaMessage {
  key: string
  value: string
  offset: number
  partition: number
  timestamp: number
}

export interface KafkaPartition {
  id: number
  topicName: string
  leaderId: number
  replicas: number[]
  isr: number[]
  messages: KafkaMessage[]
  hwm: number   // high water mark — consumers can read up to here
  leo: number   // log end offset — latest offset on leader
}

export interface KafkaConsumer {
  id: string
  assignedPartitions: number[]
}

export interface ConsumerGroup {
  id: string
  consumers: KafkaConsumer[]
  offsets: Record<number, number>  // partitionId → committed offset
  isRebalancing: boolean
}

export interface RecentEvent {
  id: number
  text: string
  color: string
}

export interface KafkaState {
  brokers: KafkaBroker[]
  partitions: KafkaPartition[]
  consumerGroups: ConsumerGroup[]
  controllerId: number
  isElecting: boolean
  acksMode: 'acks-1' | 'acks-all'
  lastOp: string
  messageCounter: number
  recentEvents: RecentEvent[]  // rolling log of last N events
  pendingHwm: { partitionId: number; targetHwm: number } | null  // acks=all delayed commit
}
