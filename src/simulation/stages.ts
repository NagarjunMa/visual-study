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
    whenHappens: 'Early in application development. Traffic is low and predictable. One server handles everything.',
    whatCondition: 'A single process serves web requests, runs business logic, and queries the database. No redundancy. At this stage, 100 RPS at 15% CPU is comfortable headroom.',
    howToResolve: 'This is the healthy baseline. Problems emerge when traffic grows. Subsequent stages show architectural issues and solutions.',
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
    whenHappens: 'When user auth data is held in server memory. Works fine with one server, breaks under load balancing or horizontal scaling.',
    whatCondition: 'Every incoming request triggers an in-memory session lookup on the server. At 5K RPS, this adds 30% CPU overhead. At 1M concurrent users, you cannot add servers without breaking auth.',
    howToResolve: 'Move session storage to Redis/Session Store. Server becomes stateless. Any replica handles any request. No sticky routing needed.',
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
    whenHappens: 'After achieving stateless servers. But without traffic filtering, bots and malformed requests still hit servers.',
    whatCondition: 'Unfiltered 13K RPS hits stateless server directly. Bots, malformed requests, no rate limiting. Server CPU spikes to 95%. Error rate climbs above 20%.',
    howToResolve: 'Add API Gateway as single entry point. Validates format, checks auth, enforces rate limits. Blocks bad traffic at the edge. Server handles only legitimate requests.',
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
      whatCondition: '12K attempted RPS. Gateway validates, rate limits, rejects 20% (bots, malformed). Only 9.6K clean requests reach server at 38% CPU.',
      howToResolve: 'Gateway is single entry point. All traffic validated, filtered, rate-limited before reaching server.',
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
    whenHappens: 'Traffic continues to grow beyond single server capacity. Vertical scaling has limits. Horizontal scaling required.',
    whatCondition: '10K RPS overwhelms single server. CPU at 95%. If server dies, all traffic fails. No redundancy.',
    howToResolve: 'Add multiple servers horizontally. But traffic distribution matters. Without load balancer, routing is uneven (hotspots). Solution: Load balancer distributes evenly + health checks.',
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
      whatCondition: '9K RPS, 3 servers, but gateway routes 70% to server-1 (hotspot). Server-2 and Server-3 idle at 15%.',
      howToResolve: 'Add a Load Balancer between gateway and servers. LB distributes traffic evenly and detects dead servers.',
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
      whatCondition: '9K RPS via LB: 3K per server, 30% CPU each. Health checks auto-remove dead servers. Zero errors.',
      howToResolve: 'LB solves hotspot + provides fault tolerance. Combined with API GW = solid multi-tier foundation.',
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
  { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway' as const, x: 200, y: 220 },
  { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer' as const, x: 350, y: 220 },
  { id: 'server-1', label: 'Server 1', type: 'server' as const, x: 490, y: 110 },
  { id: 'server-2', label: 'Server 2', type: 'server' as const, x: 490, y: 220 },
  { id: 'server-3', label: 'Server 3', type: 'server' as const, x: 490, y: 330 },
  { id: 'session-store', label: 'Session Store', type: 'session-store' as const, x: 640, y: 420 },
  { id: 'cache-1', label: 'Cache 1', type: 'cache' as const, x: 760, y: 110 },
  { id: 'cache-2', label: 'Cache 2', type: 'cache' as const, x: 760, y: 220 },
  { id: 'cache-3', label: 'Cache 3', type: 'cache' as const, x: 760, y: 330 },
  { id: 'database', label: 'Database', type: 'database' as const, x: 1060, y: 220 },
]

// Redis cluster nodes (used by stage5 fix3)
const cacheClusterNodes = [
  { id: 'client', label: 'Client', type: 'client' as const, x: 60, y: 220 },
  { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway' as const, x: 200, y: 220 },
  { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer' as const, x: 350, y: 220 },
  { id: 'server-1', label: 'Server 1', type: 'server' as const, x: 490, y: 110 },
  { id: 'server-2', label: 'Server 2', type: 'server' as const, x: 490, y: 220 },
  { id: 'server-3', label: 'Server 3', type: 'server' as const, x: 490, y: 330 },
  { id: 'session-store', label: 'Session Store', type: 'session-store' as const, x: 640, y: 420 },
  { id: 'cache-1', label: 'Node 1', type: 'cache-cluster' as const, x: 760, y: 110 },
  { id: 'cache-2', label: 'Node 2', type: 'cache-cluster' as const, x: 760, y: 220 },
  { id: 'cache-3', label: 'Node 3', type: 'cache-cluster' as const, x: 760, y: 330 },
  { id: 'database', label: 'Database', type: 'database' as const, x: 1060, y: 220 },
]

const cacheEdges = [
  { id: 'client-gw', from: 'client', to: 'api-gateway' },
  { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
  { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
  { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
  { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
  { id: 's1-store', from: 'server-1', to: 'session-store' },
  { id: 's2-store', from: 'server-2', to: 'session-store' },
  { id: 's3-store', from: 'server-3', to: 'session-store' },
  { id: 's1-cache1', from: 'server-1', to: 'cache-1' },
  { id: 's1-cache2', from: 'server-1', to: 'cache-2' },
  { id: 's2-cache1', from: 'server-2', to: 'cache-1' },
  { id: 's2-cache2', from: 'server-2', to: 'cache-2' },
  { id: 's2-cache3', from: 'server-2', to: 'cache-3' },
  { id: 's3-cache2', from: 'server-3', to: 'cache-2' },
  { id: 's3-cache3', from: 'server-3', to: 'cache-3' },
  { id: 'cache1-db', from: 'cache-1', to: 'database' },
  { id: 'cache2-db', from: 'cache-2', to: 'database' },
  { id: 'cache3-db', from: 'cache-3', to: 'database' },
]

const cacheViewBox = '0 0 1200 470'

// DB replication nodes (used by stage6 fix)
const dbReplicationNodes = [
  { id: 'client', label: 'Client', type: 'client' as const, x: 60, y: 220 },
  { id: 'api-gateway', label: 'API Gateway', type: 'api-gateway' as const, x: 200, y: 220 },
  { id: 'load-balancer', label: 'Load Balancer', type: 'load-balancer' as const, x: 350, y: 220 },
  { id: 'server-1', label: 'Server 1', type: 'server' as const, x: 490, y: 110 },
  { id: 'server-2', label: 'Server 2', type: 'server' as const, x: 490, y: 220 },
  { id: 'server-3', label: 'Server 3', type: 'server' as const, x: 490, y: 330 },
  { id: 'session-store', label: 'Session Store', type: 'session-store' as const, x: 640, y: 420 },
  { id: 'cache-1', label: 'Node 1', type: 'cache-cluster' as const, x: 760, y: 110 },
  { id: 'cache-2', label: 'Node 2', type: 'cache-cluster' as const, x: 760, y: 220 },
  { id: 'cache-3', label: 'Node 3', type: 'cache-cluster' as const, x: 760, y: 330 },
  { id: 'db-primary', label: 'DB Primary', type: 'database' as const, x: 1060, y: 110 },
  { id: 'db-replica-1', label: 'Replica 1', type: 'db-replica' as const, x: 1060, y: 255 },
  { id: 'db-replica-2', label: 'Replica 2', type: 'db-replica' as const, x: 1060, y: 380 },
]

// DB replication edges (used by stage6 fix)
const dbReplicationEdges = [
  { id: 'client-gw', from: 'client', to: 'api-gateway' },
  { id: 'gw-lb', from: 'api-gateway', to: 'load-balancer' },
  { id: 'lb-s1', from: 'load-balancer', to: 'server-1' },
  { id: 'lb-s2', from: 'load-balancer', to: 'server-2' },
  { id: 'lb-s3', from: 'load-balancer', to: 'server-3' },
  { id: 's1-store', from: 'server-1', to: 'session-store' },
  { id: 's2-store', from: 'server-2', to: 'session-store' },
  { id: 's3-store', from: 'server-3', to: 'session-store' },
  { id: 's1-cache1', from: 'server-1', to: 'cache-1' },
  { id: 's1-cache2', from: 'server-1', to: 'cache-2' },
  { id: 's2-cache1', from: 'server-2', to: 'cache-1' },
  { id: 's2-cache2', from: 'server-2', to: 'cache-2' },
  { id: 's2-cache3', from: 'server-2', to: 'cache-3' },
  { id: 's3-cache2', from: 'server-3', to: 'cache-2' },
  { id: 's3-cache3', from: 'server-3', to: 'cache-3' },
  // Cache misses → read replicas, writes → primary
  { id: 'cache1-dbp', from: 'cache-1', to: 'db-primary' },
  { id: 'cache2-r1', from: 'cache-2', to: 'db-replica-1' },
  { id: 'cache3-r2', from: 'cache-3', to: 'db-replica-2' },
  // Async replication from primary to replicas
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
    whenHappens: 'When request rate outpaces database ability to handle concurrent connections. Typically at 10K+ RPS with multiple application servers.',
    whatCondition: 'All 3 servers hit same DB simultaneously. Connection pool climbs to 95%. New queries wait in queue. Latency jumps from 45ms to 250ms. Servers healthy. Database is the bottleneck.',
    howToResolve: 'Add a cache layer (Redis) between servers and DB. 80% of reads are repetitive hot data. Serving from cache eliminates 80% of DB queries instantly.',
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
      whatCondition: '10K RPS. 80% cache hits served in <5ms. Only 20% reach DB. Pool usage drops from 95% to 25%.',
      howToResolve: 'Cache works — but it is a single point of failure. One cache node dies and hit rate collapses. Click to simulate.',
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
      whenHappens: 'Cache nodes are in-memory systems. Without redundancy, single failure floods database with misses.',
      whatCondition: 'Cache-2 fails (shown as dead with red X). All keys on that node miss. Hit rate drops 80%→40%. DB pool spikes back to 85%. Latency climbs to 180ms. Same bottleneck returns.',
      howToResolve: 'Use Redis Cluster with replication. Keys distributed across nodes with replicas. One node loss = ~33% miss rate, not 50%. Automatic recovery.',
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
      whenHappens: 'At scale, cache becomes critical. Single cache node failure must not degrade performance.',
      whatCondition: '10K RPS. Cluster nodes (labeled Node 1/2/3) handle requests. Replication means one node loss = 33% keys affected (not 50%). Hit rate stable at 85%. DB pool stays at 18%. Zero errors.',
      howToResolve: 'Redis Cluster + replication factor 2 is production standard. Eliminates cache as single failure domain. Keys hash-distributed across nodes.',
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
    { id: 's1-store', from: 'server-1', to: 'session-store' },
    { id: 's2-store', from: 'server-2', to: 'session-store' },
    { id: 's3-store', from: 'server-3', to: 'session-store' },
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
    whenHappens: 'At 15K RPS with 85% cache hit rate, the remaining 15% of cache misses and all write operations (2,250+ queries/sec) overwhelm a single database server. Writes cannot be cached — every write hits the DB directly.',
    whatCondition: 'DB connection pool saturates at 100%. Response time spikes to 800ms+. Cache misses pile up behind the DB queue, causing hit rate to degrade from 85% to 62%. Error rate climbs to 5%. All other layers healthy — the database tier is the single point of failure.',
    howToResolve: 'Add database replication: one Primary DB handles all writes, Read Replicas handle all read queries. Cache misses route to read replicas. Primary asynchronously replicates data to replicas. Load is distributed across 3 DB nodes.',
  },
  fixModes: [
    {
      nodes: dbReplicationNodes,
      edges: dbReplicationEdges,
      viewBox: cacheViewBox,
      engineId: 'stage-db-replica',
      enterLabel: 'Add DB Replication',
      description: 'Primary DB for writes. 2 Read Replicas for reads. Async replication. Pool drops to 18%.',
      technicalTerm: 'Primary-Replica Database Replication',
      whenHappens: 'When read traffic overwhelms a single DB. Separate write path (Primary) from read path (Replicas). Each replica handles a fraction of read load.',
      whatCondition: '15K RPS. Writes → DB Primary. Cache misses → Read Replicas. DB Primary replicates to Replica 1 & 2 asynchronously. Pool usage drops from 100% to 18% per node. Latency returns to 28ms. Zero errors. 85% cache hit rate stable.',
      howToResolve: 'This is the full production architecture: API Gateway → LB → App Servers → Redis Cluster (cache) → Read Replicas. Primary DB handles writes only. Built to scale to 1M+ users.',
    },
  ],
  nodes: cacheClusterNodes,
  edges: cacheEdges,
  viewBox: cacheViewBox,
}

export const stages: Stage[] = [
  stage1,
  stage2,
  stage3,
  stage4,
  stage5,
  stage6,
]
