import type { Stage } from './types'

// Stage 1: Baseline
export const stage1: Stage = {
  id: 'stage-1',
  title: 'Baseline',
  subtitle: 'Single Server — Healthy Metrics',
  insight: 'Server at 15% CPU — comfortable headroom.',
  displayTitle: 'Baseline Architecture',
  description: 'Single server handling all traffic. Healthy metrics at low load.',
  components: ['Client', 'Server', 'Database'],
  infoCard: {
    technicalTerm: 'Monolithic Single-Server',
    whenHappens: 'Early in development. Low, predictable traffic on a single server.',
    whatCondition: '100 RPS at 15% CPU. One process handles web, logic, and DB with room to spare.',
    howToResolve: 'Healthy baseline. Problems emerge as traffic grows — subsequent stages show what breaks first.',
  },
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 150, y: 200 },
    { id: 'server', label: 'Server', type: 'server', x: 450, y: 200 },
    { id: 'database', label: 'Database', type: 'database', x: 750, y: 200 },
  ],
  edges: [
    { id: 'client-server', from: 'client', to: 'server' },
    { id: 'server-db', from: 'server', to: 'database' },
  ],
  viewBox: '0 0 900 400',
}

// Stage 2: Stateful Auth with Fix
export const stage2: Stage = {
  id: 'stage-2',
  title: 'Stateful Auth',
  subtitle: 'In-Memory Auth — CPU Spikes at 5K RPS',
  insight: 'Server checks auth in-memory. CPU jumps to 75%.',
  displayTitle: 'Stateful Authentication Problem',
  description: 'Server stores session data in memory. Auth check runs in-process per request, causing CPU overhead.',
  components: ['Client', 'Server', 'Database'],
  infoCard: {
    technicalTerm: 'Stateful Server',
    whenHappens: 'User auth lives in server memory. Works on one server; breaks under horizontal scaling.',
    whatCondition: '5K RPS adds 30% CPU overhead from in-memory session lookups. Cannot scale out without sticky routing.',
    howToResolve: 'Move sessions to Redis. Server becomes stateless — any replica handles any request.',
  },
  fixModes: [
    {
      nodes: [
        { id: 'client', label: 'Client', type: 'client', x: 120, y: 220 },
        { id: 'server', label: 'Server', type: 'server', x: 420, y: 220 },
        { id: 'session-store', label: 'Session Store', type: 'session-store', x: 420, y: 360 },
        { id: 'database', label: 'Database', type: 'database', x: 820, y: 220 },
      ],
      edges: [
        { id: 'client-server', from: 'client', to: 'server' },
        { id: 'server-store', from: 'server', to: 'session-store' },
        { id: 'server-db', from: 'server', to: 'database' },
      ],
      viewBox: '0 0 1000 440',
      engineId: 'stage-3',
      enterLabel: 'Apply Fix: Go Stateless',
      description: 'Sessions offloaded to Redis. Server CPU drops to 45%. No sticky sessions needed.',
    },
  ],
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 150, y: 200 },
    { id: 'server', label: 'Server', type: 'server', x: 450, y: 200 },
    { id: 'database', label: 'Database', type: 'database', x: 750, y: 200 },
  ],
  edges: [
    { id: 'client-server', from: 'client', to: 'server' },
    { id: 'server-db', from: 'server', to: 'database' },
  ],
  viewBox: '0 0 900 400',
}

// Stage 3: API Gateway & Rate Limiting
export const stage3: Stage = {
  id: 'stage-api-gw',
  title: 'API Gateway',
  subtitle: 'Validate & Rate-Limit Incoming Requests',
  insight: 'Stateless server healthy but unfiltered traffic causes CPU spike. Gateway filters bad requests.',
  displayTitle: 'API Gateway & Rate Limiting',
  description: 'Server is stateless but all raw traffic hits it. Add API Gateway to filter, validate, and rate-limit.',
  components: ['Client', 'Server', 'API Gateway', 'Session Store', 'Database'],
  infoCard: {
    technicalTerm: 'API Gateway & Rate Limiting',
    whenHappens: 'Stateless servers are ready, but unfiltered traffic hits them directly.',
    whatCondition: '13K RPS hits server without filtering. Bots + malformed requests spike CPU to 95% with 20%+ error rate.',
    howToResolve: 'Add API Gateway as single entry point — validates, rate-limits, and rejects bad traffic at the edge.',
  },
  fixModes: [
    {
      nodes: [
        { id: 'client', label: 'Client', type: 'client', x: 100, y: 220 },
        { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 300, y: 220 },
        { id: 'server', label: 'Server', type: 'server', x: 560, y: 220 },
        { id: 'session-store', label: 'Session Store', type: 'session-store', x: 560, y: 360 },
        { id: 'database', label: 'Database', type: 'database', x: 920, y: 220 },
      ],
      edges: [
        { id: 'client-gw', from: 'client', to: 'api-gateway' },
        { id: 'gw-server', from: 'api-gateway', to: 'server' },
        { id: 'server-store', from: 'server', to: 'session-store' },
        { id: 'server-db', from: 'server', to: 'database' },
      ],
      viewBox: '0 0 1100 440',
      engineId: 'stage-agw-fix',
      enterLabel: 'Add API Gateway',
      description: 'API Gateway filters bad traffic. 20% rejected, server CPU drops to 38%.',
      whatCondition: '12K attempted RPS. Gateway rejects 20% (bots, malformed). 9.6K clean requests reach server at 38% CPU.',
      howToResolve: 'Gateway acts as traffic filter. Servers handle only validated, rate-limited requests.',
    },
  ],
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 120, y: 220 },
    { id: 'server', label: 'Server', type: 'server', x: 420, y: 220 },
    { id: 'session-store', label: 'Session Store', type: 'session-store', x: 420, y: 360 },
    { id: 'database', label: 'Database', type: 'database', x: 820, y: 220 },
  ],
  edges: [
    { id: 'client-server', from: 'client', to: 'server' },
    { id: 'server-store', from: 'server', to: 'session-store' },
    { id: 'server-db', from: 'server', to: 'database' },
  ],
  viewBox: '0 0 1000 440',
}

// Stage 4: Load Balancer & Health Checks
export const stage4: Stage = {
  id: 'stage-loadbalancer',
  title: 'Load Balancer',
  subtitle: 'Distribute Load & Detect Failures',
  insight: 'API Gateway with single server can\'t handle 10K RPS. Need horizontal scaling.',
  displayTitle: 'Horizontal Scaling & Load Balancing',
  description: 'Single server can\'t scale further. Add more servers, then add load balancer to distribute evenly.',
  components: ['Client', 'API Gateway', 'Load Balancer', 'Server ×3', 'Session Store', 'Database'],
  infoCard: {
    technicalTerm: 'Horizontal Scaling & Load Balancing',
    whenHappens: 'Traffic exceeds single server capacity. Vertical scaling hits limits.',
    whatCondition: '10K RPS overwhelms single server at 95% CPU. One server dying takes down all traffic.',
    howToResolve: 'Add servers horizontally. Load balancer distributes evenly and health-checks routing around failures.',
  },
  fixModes: [
    {
      nodes: [
        { id: 'client', label: 'Client', type: 'client', x: 80, y: 220 },
        { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 280, y: 220 },
        { id: 'server-1', label: 'Server 1', type: 'server', x: 500, y: 110 },
        { id: 'server-2', label: 'Server 2', type: 'server', x: 500, y: 220 },
        { id: 'server-3', label: 'Server 3', type: 'server', x: 500, y: 330 },
        { id: 'session-store', label: 'Session Store', type: 'session-store', x: 750, y: 380 },
        { id: 'database', label: 'Database', type: 'database', x: 950, y: 220 },
      ],
      edges: [
        { id: 'client-gw', from: 'client', to: 'api-gateway' },
        { id: 'gw-s1', from: 'api-gateway', to: 'server-1' },
        { id: 'gw-s2', from: 'api-gateway', to: 'server-2' },
        { id: 'gw-s3', from: 'api-gateway', to: 'server-3' },
        { id: 's1-store', from: 'server-1', to: 'session-store' },
        { id: 's2-store', from: 'server-2', to: 'session-store' },
        { id: 's3-store', from: 'server-3', to: 'session-store' },
        { id: 's1-db', from: 'server-1', to: 'database' },
        { id: 's2-db', from: 'server-2', to: 'database' },
        { id: 's3-db', from: 'server-3', to: 'database' },
      ],
      viewBox: '0 0 1150 460',
      engineId: 'stage-lb-hotspot',
      enterLabel: 'Add More Servers',
      description: '3 servers added but no LB. Gateway routes unevenly. Server-1 hotspot at 72% CPU.',
      whatCondition: '9K RPS, 3 servers, but 70% routes to server-1. Servers 2 and 3 idle at 15%.',
      howToResolve: 'Add Load Balancer to distribute evenly and route around failed servers.',
    },
    {
      nodes: [
        { id: 'client', label: 'Client', type: 'client', x: 80, y: 220 },
        { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 280, y: 220 },
        { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer', x: 460, y: 220 },
        { id: 'server-1', label: 'Server 1', type: 'server', x: 650, y: 110 },
        { id: 'server-2', label: 'Server 2', type: 'server', x: 650, y: 220 },
        { id: 'server-3', label: 'Server 3', type: 'server', x: 650, y: 330 },
        { id: 'session-store', label: 'Session Store', type: 'session-store', x: 850, y: 380 },
        { id: 'database', label: 'Database', type: 'database', x: 1050, y: 220 },
      ],
      edges: [
        { id: 'client-gw', from: 'client', to: 'api-gateway' },
        { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
        { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
        { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
        { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
        { id: 's1-store', from: 'server-1', to: 'session-store' },
        { id: 's2-store', from: 'server-2', to: 'session-store' },
        { id: 's3-store', from: 'server-3', to: 'session-store' },
        { id: 's1-db', from: 'server-1', to: 'database' },
        { id: 's2-db', from: 'server-2', to: 'database' },
        { id: 's3-db', from: 'server-3', to: 'database' },
      ],
      viewBox: '0 0 1250 460',
      engineId: 'stage-lb-balanced',
      enterLabel: 'Add Load Balancer',
      description: 'LB distributes evenly. Health checks detect failures. Each server 30% CPU.',
      whatCondition: '9K RPS via LB: 3K per server, 30% CPU each. Dead servers auto-removed by health checks.',
      howToResolve: 'LB + API Gateway = solid multi-tier foundation with fault tolerance.',
    },
  ],
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 100, y: 220 },
    { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 300, y: 220 },
    { id: 'server', label: 'Server', type: 'server', x: 560, y: 220 },
    { id: 'session-store', label: 'Session Store', type: 'session-store', x: 560, y: 360 },
    { id: 'database', label: 'Database', type: 'database', x: 920, y: 220 },
  ],
  edges: [
    { id: 'client-gw', from: 'client', to: 'api-gateway' },
    { id: 'gw-server', from: 'api-gateway', to: 'server' },
    { id: 'server-store', from: 'server', to: 'session-store' },
    { id: 'server-db', from: 'server', to: 'database' },
  ],
  viewBox: '0 0 1100 440',
}

// Shared cache node positions (used by stage5 fix1, stage6)
const cacheNodes = [
  { id: 'client', label: 'Client', type: 'client' as const, x: 60, y: 220 },
  { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway' as const, x: 180, y: 220 },
  { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer' as const, x: 310, y: 220 },
  { id: 'server-1', label: 'Server 1', type: 'server' as const, x: 440, y: 110 },
  { id: 'server-2', label: 'Server 2', type: 'server' as const, x: 440, y: 220 },
  { id: 'server-3', label: 'Server 3', type: 'server' as const, x: 440, y: 330 },
  { id: 'session-store', label: 'Session Store', type: 'session-store' as const, x: 560, y: 400 },
  { id: 'cache-1', label: 'Cache 1', type: 'cache' as const, x: 620, y: 110 },
  { id: 'cache-2', label: 'Cache 2', type: 'cache' as const, x: 620, y: 220 },
  { id: 'cache-3', label: 'Cache 3', type: 'cache' as const, x: 620, y: 330 },
  { id: 'database', label: 'Database', type: 'database' as const, x: 800, y: 220 },
]

// Redis cluster nodes (used by stage5 fix3)
const cacheClusterNodes = [
  { id: 'client', label: 'Client', type: 'client' as const, x: 60, y: 220 },
  { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway' as const, x: 180, y: 220 },
  { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer' as const, x: 310, y: 220 },
  { id: 'server-1', label: 'Server 1', type: 'server' as const, x: 440, y: 110 },
  { id: 'server-2', label: 'Server 2', type: 'server' as const, x: 440, y: 220 },
  { id: 'server-3', label: 'Server 3', type: 'server' as const, x: 440, y: 330 },
  { id: 'session-store', label: 'Session Store', type: 'session-store' as const, x: 560, y: 400 },
  { id: 'cache-1', label: 'Node 1', type: 'cache-cluster' as const, x: 620, y: 110 },
  { id: 'cache-2', label: 'Node 2', type: 'cache-cluster' as const, x: 620, y: 220 },
  { id: 'cache-3', label: 'Node 3', type: 'cache-cluster' as const, x: 620, y: 330 },
  { id: 'database', label: 'Database', type: 'database' as const, x: 800, y: 220 },
]

const cacheEdges = [
  { id: 'client-gw', from: 'client', to: 'api-gateway' },
  { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
  { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
  { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
  { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
  { id: 's2-store', from: 'server-2', to: 'session-store' },
  // Direct one-to-one server → cache (no cross-connections)
  { id: 's1-cache1', from: 'server-1', to: 'cache-1' },
  { id: 's2-cache2', from: 'server-2', to: 'cache-2' },
  { id: 's3-cache3', from: 'server-3', to: 'cache-3' },
  // Cache → DB misses
  { id: 'cache1-db', from: 'cache-1', to: 'database' },
  { id: 'cache2-db', from: 'cache-2', to: 'database' },
  { id: 'cache3-db', from: 'cache-3', to: 'database' },
]

const cacheViewBox = '0 0 1200 470'
const replicaViewBox = '0 0 950 470'

// DB replication nodes (used by stage6 fix)
const dbReplicationNodes = [
  { id: 'client', label: 'Client', type: 'client' as const, x: 60, y: 220 },
  { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway' as const, x: 180, y: 220 },
  { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer' as const, x: 310, y: 220 },
  { id: 'server-1', label: 'Server 1', type: 'server' as const, x: 440, y: 110 },
  { id: 'server-2', label: 'Server 2', type: 'server' as const, x: 440, y: 220 },
  { id: 'server-3', label: 'Server 3', type: 'server' as const, x: 440, y: 330 },
  { id: 'session-store', label: 'Session Store', type: 'session-store' as const, x: 560, y: 400 },
  { id: 'cache-1', label: 'Node 1', type: 'cache-cluster' as const, x: 620, y: 110 },
  { id: 'cache-2', label: 'Node 2', type: 'cache-cluster' as const, x: 620, y: 220 },
  { id: 'cache-3', label: 'Node 3', type: 'cache-cluster' as const, x: 620, y: 330 },
  { id: 'db-primary', label: 'DB Primary', type: 'database' as const, x: 820, y: 150 },
  { id: 'db-replica-1', label: 'Replica 1', type: 'db-replica' as const, x: 820, y: 290 },
  { id: 'db-replica-2', label: 'Replica 2', type: 'db-replica' as const, x: 820, y: 400 },
]

// DB replication edges (used by stage6 fix)
const dbReplicationEdges = [
  { id: 'client-gw', from: 'client', to: 'api-gateway' },
  { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
  { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
  { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
  { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
  { id: 's2-store', from: 'server-2', to: 'session-store' },
  // Direct one-to-one server → cache cluster (no cross-connections)
  { id: 's1-cache1', from: 'server-1', to: 'cache-1' },
  { id: 's2-cache2', from: 'server-2', to: 'cache-2' },
  { id: 's3-cache3', from: 'server-3', to: 'cache-3' },
  // Cache → DB/replicas (one cache per replica for clarity)
  { id: 'cache1-dbp', from: 'cache-1', to: 'db-primary' },
  { id: 'cache2-r1', from: 'cache-2', to: 'db-replica-1' },
  { id: 'cache3-r2', from: 'cache-3', to: 'db-replica-2' },
  // Async replication from primary to replicas (vertical)
  { id: 'dbp-r1', from: 'db-primary', to: 'db-replica-1' },
  { id: 'dbp-r2', from: 'db-primary', to: 'db-replica-2' },
]

// Stage 5: DB Bottleneck → Cache Layer → Cache Failure → Cache Cluster
export const stage5: Stage = {
  id: 'stage-7',
  title: 'DB & Cache',
  subtitle: 'DB Bottleneck → Cache → Cache Failure → Redis Cluster',
  insight: '3 servers hammer DB. Add cache. Cache fails. Add cluster.',
  displayTitle: 'Database & Cache Layer',
  description: '3 servers saturate DB. Add cache layer. Then experience cache failure. Finally: Redis Cluster.',
  components: ['Client', 'API Gateway', 'Load Balancer', 'Server ×3', 'Cache ×3', 'Session Store', 'Database'],
  infoCard: {
    technicalTerm: 'Database Connection Pool Exhaustion',
    whenHappens: '10K+ RPS with multiple servers all querying the same database.',
    whatCondition: 'All 3 servers hit DB simultaneously. Pool climbs to 95%. Latency spikes 45ms→250ms. DB is the bottleneck.',
    howToResolve: 'Add Redis cache. 80% of reads are hot data — cache eliminates 80% of DB queries instantly.',
  },
  fixModes: [
    {
      // Fix 1: Add cache layer
      nodes: cacheNodes,
      edges: cacheEdges,
      viewBox: cacheViewBox,
      engineId: 'stage-cache-layer',
      enterLabel: 'Add Cache Layer',
      description: 'Redis cache added. 80% reads from cache. DB pool drops to 25%. Latency 35ms.',
      whatCondition: '10K RPS. 80% cache hits served in <5ms. Only 20% reach DB. Pool drops 95%→25%.',
      howToResolve: 'Cache works — but single node is a failure point. One crash floods the DB. Click to simulate.',
    },
    {
      // Fix 2: Cache node failure — hit rate degrades
      nodes: cacheNodes,
      edges: cacheEdges,
      viewBox: cacheViewBox,
      engineId: 'stage-9',
      enterLabel: 'Simulate Cache Failure',
      description: 'Cache-2 node dies. Hit rate degrades 80%→40%. DB overwhelmed again.',
      technicalTerm: 'Cache Node Failure / Cache Stampede',
      whenHappens: 'Cache nodes are in-memory. Without redundancy, a single failure floods the database.',
      whatCondition: 'Cache-2 fails (red X). Hit rate drops 80%→40%. DB pool spikes back to 85%.',
      howToResolve: 'Use Redis Cluster. Keys distributed with replicas — one loss ≈ 33% miss rate, not 50%. Auto-recovery.',
    },
    {
      // Fix 3: Redis Cluster — resilient final state
      nodes: cacheClusterNodes,
      edges: cacheEdges,
      viewBox: cacheViewBox,
      engineId: 'stage-cache-cluster',
      enterLabel: 'Add Redis Cluster',
      description: 'Redis Cluster with replication. Node failure only affects 33% of keys. Auto-recovery.',
      technicalTerm: 'Redis Cluster with Replication',
      whenHappens: 'At scale, cache becomes critical. Node failure must not degrade performance.',
      whatCondition: '10K RPS. 3 cluster nodes with replication. Hit rate stable at 85%. DB pool stays at 18%.',
      howToResolve: 'Redis Cluster + replication factor 2 is production standard. Eliminates cache as single failure domain.',
    },
  ],
  nodes: [
    { id: 'client', label: 'Client', type: 'client', x: 80, y: 220 },
    { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway', x: 280, y: 220 },
    { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer', x: 460, y: 220 },
    { id: 'server-1', label: 'Server 1', type: 'server', x: 650, y: 110 },
    { id: 'server-2', label: 'Server 2', type: 'server', x: 650, y: 220 },
    { id: 'server-3', label: 'Server 3', type: 'server', x: 650, y: 330 },
    { id: 'session-store', label: 'Session Store', type: 'session-store', x: 850, y: 390 },
    { id: 'database', label: 'Database', type: 'database', x: 1050, y: 220 },
  ],
  edges: [
    { id: 'client-gw', from: 'client', to: 'api-gateway' },
    { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
    { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
    { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
    { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
    { id: 's2-store', from: 'server-2', to: 'session-store' },
    { id: 's1-db', from: 'server-1', to: 'database' },
    { id: 's2-db', from: 'server-2', to: 'database' },
    { id: 's3-db', from: 'server-3', to: 'database' },
  ],
  viewBox: '0 0 1220 450',
}

// Stage 6: Data Replication
export const stage6: Stage = {
  id: 'stage-10',
  title: 'Data Replication',
  subtitle: 'DB Bottleneck → Primary + Read Replicas',
  insight: 'Even with cache, single DB fails at 15K RPS. Replication solves it.',
  displayTitle: 'Database Replication',
  description: '15K RPS overwhelms single DB despite 85% cache hit rate. Add Primary + Read Replicas for full resilience.',
  components: ['Client', 'API Gateway', 'Load Balancer', 'Server ×3', 'Redis Cluster', 'Session Store', 'DB Primary', 'DB Replicas ×2'],
  infoCard: {
    technicalTerm: 'Single Database Bottleneck / Write Amplification',
    whenHappens: 'At 15K RPS, writes and cache misses (2,250+ q/s) overwhelm a single DB. Writes cannot be cached.',
    whatCondition: 'Pool hits 100%. Latency spikes to 800ms. Hit rate degrades 85%→62%. Error rate 5%.',
    howToResolve: 'Add read replicas: Primary handles writes, Replicas handle reads. Load distributed across 3 DB nodes.',
  },
  fixModes: [
    {
      nodes: dbReplicationNodes,
      edges: dbReplicationEdges,
      viewBox: replicaViewBox,
      engineId: 'stage-db-replica',
      enterLabel: 'Add DB Replication',
      description: 'Primary DB for writes. 2 Read Replicas for reads. Async replication. Pool drops to 18%.',
      technicalTerm: 'Primary-Replica Database Replication',
      whenHappens: 'Read traffic overwhelms a single DB. Separate writes (Primary) from reads (Replicas).',
      whatCondition: 'Writes → Primary. Cache misses → Replicas. Pool drops 100%→18%. Latency 800ms→28ms. Zero errors.',
      howToResolve: 'Primary handles writes only. Replicas handle reads. Async replication keeps them in sync.',
    },
  ],
  nodes: cacheClusterNodes,
  edges: cacheEdges,
  viewBox: replicaViewBox,
}

// Stage 7: Redis Key-Value Store
export const stageRedis: Stage = {
  id: 'stage-redis-kv',
  title: 'Redis Key-Value Store',
  subtitle: 'Hash Table + LRU Cache — Volatile vs Persistent',
  insight: 'Data stored in RAM only. Crash = total loss. Persistence modes protect data.',
  displayTitle: 'Redis KV Store Internals',
  description: 'Hash table with LRU eviction. See how persistence modes (RDB/AOF) prevent data loss.',
  components: ['Client', 'Redis', 'Hash Table', 'LRU List', 'Disk'],
  moduleType: 'redis-kv',
  infoCard: {
    technicalTerm: 'Redis Hash Table + LRU Eviction',
    whenHappens: 'Every SET writes to RAM. LRU evicts oldest entry when capacity exceeded. GET checks key.',
    whatCondition: 'No persistence: crash = complete data loss. RDB: snapshot to disk (periodic). AOF: write log (full recovery).',
    howToResolve: 'Enable persistence. RDB for snapshots (fast recovery, some loss), AOF for durability (replay all writes).',
  },
  fixModes: [
    {
      engineId: 'redis-rdb',
      enterLabel: 'Enable RDB',
      description: 'RDB snapshots — periodic backups to disk. Faster, but lose writes since last snapshot.',
      nodes: [], edges: [], viewBox: '0 0 1200 600',
      whatCondition: 'RDB snapshot saves all data to dump.rdb. On crash, replay from last snapshot. Data since snapshot is lost.',
      howToResolve: 'RDB is fast recovery. Trade: data loss window = time since last snapshot (~30 seconds in production).',
    },
    {
      engineId: 'redis-aof',
      enterLabel: 'Enable AOF',
      description: 'AOF (Append-Only File) — log every write. Full recovery but slower.',
      nodes: [], edges: [], viewBox: '0 0 1200 600',
      whatCondition: 'AOF appends every SET command to appendonly.aof. On crash, replay entire log = full recovery (or near-full).',
      howToResolve: 'AOF is durable. Trade: write amplification — every SET is a disk write. Can use fsync=everysec for balance.',
    },
  ],
  nodes: [],
  edges: [],
  viewBox: '0 0 1200 600',
}

export const stageLSM: Stage = {
  id: 'stage-lsm',
  title: 'Cassandra LSM Tree',
  subtitle: 'Log-Structured Merge Tree — Write Path, Compaction, Bloom Filters',
  insight: 'Memtable → L0 SSTables → L1. Bloom filters speed up reads. Compaction removes duplicates.',
  displayTitle: 'Cassandra LSM Tree Internals',
  description: 'Write-Ahead Log, in-memory Memtable, immutable SSTables, Bloom filters, compaction.',
  components: ['Client', 'Cassandra', 'WAL', 'Memtable', 'SSTables', 'Disk'],
  moduleType: 'lsm',
  infoCard: {
    technicalTerm: 'LSM Tree (Memtable + SSTables)',
    whenHappens: 'Every SET goes to WAL + Memtable. Memtable flush creates immutable SSTable. Compaction merges SSTables.',
    whatCondition: 'Memtable capacity exceeded → flush to L0. L0 accumulates SSTables → compaction to L1. Bloom filters skip SSTable checks on misses.',
    howToResolve: 'Flush often (keep Memtable small). Compact SSTables (reduces read amplification). Bloom filters eliminate false seeks.',
  },
  fixModes: [
    {
      engineId: 'lsm-bloom',
      enterLabel: 'Bloom Filter Optimization',
      description: 'Bloom filters allow quick negative lookups without SSTable access',
      nodes: [],
      edges: [],
      viewBox: '0 0 1200 580',
      whatCondition: 'GET checks Memtable, then L0/L1 SSTables. Bloom filter says "no" → skip; "maybe" → check entries.',
      howToResolve: 'Bloom filter reduces disk seeks on key misses. Probabilistic false positives acceptable.',
    },
    {
      engineId: 'lsm-compaction',
      enterLabel: 'Compaction Strategy',
      description: 'Compaction merges SSTables, removing duplicate keys and tombstones',
      nodes: [],
      edges: [],
      viewBox: '0 0 1200 580',
      whatCondition: 'L0 accumulates many SSTables. Compaction merges into L1, keeping newest version of each key.',
      howToResolve: 'Compaction reduces read amplification but increases write amplification. Balance with flush rate.',
    },
  ],
  nodes: [],
  edges: [],
  viewBox: '0 0 1200 580',
}

export const stageBTree: Stage = {
  id: 'stage-btree',
  title: 'PostgreSQL B+ Tree',
  subtitle: 'B+ Tree Index — Insert, Split, Range Scan',
  insight: 'B+ Tree maintains sorted keys. Leaf chain enables O(K) range scans. Splits rebalance the tree.',
  displayTitle: 'PostgreSQL B+ Tree Internals',
  description: 'Watch a B+ Tree index grow. See page splits, leaf linking, and efficient range scans.',
  components: ['Client', 'PostgreSQL', 'B+ Tree Index', 'Heap'],
  moduleType: 'btree',
  infoCard: {
    technicalTerm: 'B+ Tree Index',
    whenHappens: 'Every INSERT updates the B+ Tree. Index lookup uses tree traversal. Range queries scan leaf chain.',
    whatCondition: 'Leaf page overflow (> 3 keys) triggers split. Median key pushed to parent. Parent may overflow → root split → height increases.',
    howToResolve: 'Splits are O(log N) amortized. Leaf chain enables O(K) range scans. Tree stays balanced automatically.',
  },
  fixModes: [
    {
      engineId: 'btree-search',
      enterLabel: 'Efficient Range Scan',
      description: 'Leaf chain enables O(K) range scan without re-traversing tree',
      nodes: [],
      edges: [],
      viewBox: '0 0 1100 560',
      whatCondition: 'Range query [lo, hi] finds leftmost matching leaf, scans right via leaf links.',
      howToResolve: 'Leaf chain = O(results) scan. No re-traversal needed. Efficient for range queries.',
    },
  ],
  nodes: [],
  edges: [],
  viewBox: '0 0 1100 560',
}

export const stages: Stage[] = [
  stage1,
  stage2,
  stage3,
  stage4,
  stage5,
  stage6,
  stageRedis,
  stageLSM,
  stageBTree,
]
