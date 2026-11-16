# URL Shortener: Deep-Dive System Design & Staff-Level Interview Playbook

> **Target Audience**: Backend Engineer / Senior Backend / System Design Interviews.  
> **Scope**: Advanced caching dynamics, low-level Redis memory mechanics, concurrency guarantees, scale calculations, and deep-dive architectural answers to critical distributed systems failure modes.

---

## Table of Contents
1. [Core Architectural Trade-Offs (Why This Over That)](#1-core-architectural-trade-offs-why-this-over-that)
   - [Caching: Redis Hashes vs. Strings vs. Memcached vs. Local In-Memory](#11-caching-redis-hashes-vs-strings-vs-memcached-vs-local-in-memory)
   - [TTL Dynamics: Fixed vs. Bounded Dynamic vs. Sliding](#12-ttl-dynamics-fixed-vs-bounded-dynamic-vs-sliding)
   - [Rate Limiting: Fixed Window vs. Sliding Window Log vs. Token Bucket vs. Leaky Bucket](#13-rate-limiting-algorithms-in-depth)
   - [View-Once: Eventual Background Invalidation vs. Atomic Lua vs. Redis Transactions](#14-view-once-guarantees-under-concurrency)
2. [Quantitative Capacity Planning & Math Calculations](#2-quantitative-capacity-planning--math-calculations)
   - [Scale Assumptions & Write/Read Ratios](#21-scale-assumptions--writeread-ratios)
   - [Throughput (QPS / TPS) Computations](#22-throughput-qps--tps-computations)
   - [Storage & Memory Sizing (Postgres vs. Redis 80/20 Rule)](#23-storage--memory-sizing-postgres-vs-redis-8020-rule)
   - [Network Bandwidth Estimations](#24-network-bandwidth-estimations)
   - [Key Generation Collision Math (Hex vs. Base62 vs. Base64)](#25-key-generation-collision-math)
3. [Deep-Dive Solutions to Senior/Staff Interview System Design Questions](#3-deep-dive-solutions-to-seniorstaff-interview-system-design-questions)
   - [Q1: How would you scale this URL shortener to 10 million users?](#q1-how-would-you-scale-this-url-shortener-to-10-million-users)
   - [Q2: What if one shortened URL receives 1 million requests per minute (Hot Key)?](#q2-what-if-one-shortened-url-receives-1-million-requests-per-minute-hot-key)
   - [Q3: How would you distribute traffic across multiple backend instances?](#q3-how-would-you-distribute-traffic-across-multiple-backend-instances)
   - [Q4: What if Redis becomes unavailable (Degradation & Circuit Breaking)?](#q4-what-if-redis-becomes-unavailable)
   - [Q5: How would you prevent cache stampedes (Thundering Herd)?](#q5-how-would-you-prevent-cache-stampedes)
   - [Q6: How would you handle database read replicas?](#q6-how-would-you-handle-database-read-replicas)
   - [Q7: How would you handle extremely high write throughput?](#q7-how-would-you-handle-extremely-high-write-throughput)
   - [Q8: How would you guarantee only one successful view-once URL consumption?](#q8-how-would-you-guarantee-only-one-successful-view-once-url-consumption)
   - [Q9: How would you implement distributed rate limiting?](#q9-how-would-you-implement-distributed-rate-limiting)
   - [Q10: How would you make the system highly available (HA)?](#q10-how-would-you-make-the-system-highly-available)
   - [Q11: How would you monitor the application in production?](#q11-how-would-you-monitor-the-application-in-production)
   - [Q12: How would you prevent malicious URL redirection?](#q12-how-would-you-prevent-malicious-url-redirection)

---

## 1. Core Architectural Trade-Offs (Why This Over That)

### 1.1. Caching: Redis Hashes vs. Strings vs. Memcached vs. Local In-Memory

```
+------------------+---------------------+-------------------+---------------------+
| Strategy         | Memory Overhead     | Mutation Granularity| Cluster / Concurrency |
+------------------+---------------------+-------------------+---------------------+
| Redis Hash       | Lowest (Ziplist)    | Field-level (HSET)| Multi-threaded I/O  |
| Redis String     | Higher (SDS alloc)  | Full object overwrite| Multi-threaded I/O|
| Memcached        | Low (Slab alloc)    | Full object overwrite| Multi-threaded Engine|
| Local App Cache  | Zero Network Hop    | In-process memory | Per-node Isolated   |
+------------------+---------------------+-------------------+---------------------+
```

#### Why Redis Hash was chosen:
1. **Memory Internals (`ziplist` / `listpack`)**:
   - Redis strings encapsulate payload in `robj` (Redis Object) metadata plus Simple Dynamic String (SDS) headers. Storing 10M keys as standalone JSON strings incurs ~150-200 bytes of overhead per key solely in Redis internal pointer book-keeping.
   - When a Redis Hash has fewer fields than `hash-max-ziplist-entries` (default 512), Redis encodes the hash as a continuous linear memory chunk (`ziplist`/`listpack`). Pointer overhead disappears, slashing memory usage by 40–60%.
2. **Partial Updates without Write-Amplification**:
   - Marking a link inactive requires only `HSET url:{alias} active False` (modifying 1 byte), avoiding JSON deserialization, mutation, serialization, and network push.
3. **Why Not Memcached?**
   - Memcached is purely an in-memory key-value cache lacking complex types (Hashes, Sets, Sorted Sets), disk persistence (RDB/AOF), and server-side atomic scripts (Lua), making rate-limiting and atomic consumption significantly more complex.
4. **Why Not Local In-Memory Cache (e.g., Python `cachetools` / Guava)?**
   - In distributed deployments with horizontal pods, local caches suffer from **Cache Inconsistency**: Pod A deactivates a view-once link, but Pod B still serves it from local memory. Local caching is reserved exclusively for immutable, non-expiring hyper-hot metadata.

---

### 1.2. TTL Dynamics: Fixed vs. Bounded Dynamic vs. Sliding

#### The Algorithm:
$$\text{TTL} = \max\Big(1, \min\big(600, (\text{expire\_at} - \text{current\_time})\big)\Big)$$

#### Why This Exact Formula?
1. **The Stale-Read Disaster of Static TTL**:
   - If a link is set to expire in 10 seconds, but cached with a fixed 600s TTL, any system relying solely on cache existence would serve an expired link for an extra 590 seconds.
2. **Memory Waste on Impending Expirations**:
   - If a link expires in 5 seconds, holding it in Redis for 600s wastes valuable RAM.
3. **Upper Bound Capping (`min(600, ...)`):**
   - If an alias expires in 1 year, we do not want it sitting in RAM for 1 year. The 600s ceiling ensures cold links are naturally evicted by TTL, adhering to the LRU principle.
4. **Lower Bound Guard (`max(1, ...)`):**
   - Prevents passing $\le 0$ seconds to Redis `EXPIRE` (which causes immediate key destruction or command syntax errors depending on version).

---

### 1.3. Rate Limiting Algorithms in Depth

```
Fixed Window               Sliding Window Log             Token Bucket
[||||||||||] [||||||||||]     [ | | | | | | | | ]          ( ~ ~ ~ ) Drops/Refill
  Window 1     Window 2        Window rolls with request     Bursty traffic handled
```

| Algorithm | Pros | Cons | Ideal Use Case |
|---|---|---|---|
| **Fixed Window Counter** (`INCR` + `EXPIRE`) | $O(1)$ memory, lowest latency, minimal CPU | Allows $2\times$ burst at boundary edge | Basic protection against brute-force DDoS |
| **Sliding Window Log** (Redis Sorted Set) | $100\%$ accurate, zero boundary burst | $O(N)$ memory (stores every timestamp) | Low-volume, high-security endpoints (Login, Payments) |
| **Sliding Window Counter** (Weighted hybrid) | Low memory ($O(1)$), smooths boundary burst | Approximation ($\approx 99\%$ accuracy) | High-throughput API gateways |
| **Token Bucket** (Redis Hash / Lua) | Supports controlled bursts, steady replenishment | Requires state (tokens + timestamp) | Public API rate limits |

#### Implementation in This Project:
This project uses **Atomic Fixed Window Counter** (`INCR` + conditional `EXPIRE`).
- `INCR` guarantees atomic addition across concurrent requests without lock acquisition.
- By triggering `EXPIRE` **only when counter returns 1**, we prevent the "Sliding Expiration Bug" where persistent traffic repeatedly delays key expiration, permanently locking a user out.

---

### 1.4. View-Once Guarantees Under Concurrency

#### The Concurrency Race Condition:
If 100 requests hit `GET /{alias}` simultaneously for a view-once link:
1. All 100 hit Redis `HGETALL url:{alias}`.
2. All 100 read `active: True`.
3. All 100 dispatch background tasks to sync to DB and redirect.
4. Result: 100 people viewed a "view-once" link.

#### Architectural Evaluation:

| Approach | Latency | Consistency | Fault Tolerance |
|---|---|---|---|
| **Background Task Sync (Current)** | ~1ms | Eventual (Broken under concurrent burst) | High |
| **Database Pessimistic Lock (`SELECT FOR UPDATE`)** | 20–50ms | Strict Serializability | Low (DB Bottleneck) |
| **Atomic Lua Script (`HEXISTS` + `HDEL`)** | **~1-2ms** | **Strict Linearizability** | **High** |

#### Staff-Level Recommendation (Atomic Lua Script):
The only way to guarantee exact-once delivery in sub-millisecond redirect time:
```lua
-- Atomic View-Once Consumption
local key = KEYS[1]
local active = redis.call('HGET', key, 'active')
local view_once = redis.call('HGET', key, 'view_once')

if not active or active == "False" then
    return -1 -- Inactive or does not exist
end

if view_once == "True" then
    -- Atomically disable and evict
    redis.call('HDEL', key, 'original', 'active', 'view_once', 'expire_at')
    return 1 -- Valid, consumed!
else
    return 2 -- Valid, permanent link
end
```
Because Redis executes Lua scripts **atomically in a single-threaded execution context**, exactly one request will receive `1`; all subsequent concurrent requests immediately receive `-1`.

---

## 2. Quantitative Capacity Planning & Math Calculations

Interviewers love candidates who design systems grounded in concrete numbers rather than abstract concepts.

### 2.1. Scale Assumptions & Write/Read Ratios
- **Registered Active Users**: 10 Million.
- **New URLs Created Daily (Writes)**: $1 \text{ Million links/day}$.
- **Read-to-Write Ratio**: $100 : 1$ (typical URL shortener traffic profile).
- **URL Redirects Daily (Reads)**: $100 \times 1 \text{M} = 100 \text{ Million redirects/day}$.
- **Data Retention**: 5 years.

---

### 2.2. Throughput (QPS / TPS) Computations

#### Write QPS:
$$\text{Average Write QPS} = \frac{1,000,000 \text{ writes}}{86,400 \text{ seconds}} \approx 11.6 \approx 12 \text{ writes/sec}$$
$$\text{Peak Write QPS} = 12 \times 3 \approx 36 \text{ writes/sec}$$

#### Read QPS (Redirects):
$$\text{Average Read QPS} = \frac{100,000,000 \text{ reads}}{86,400 \text{ seconds}} \approx 1,160 \text{ reads/sec}$$
$$\text{Peak Read QPS} = 1,160 \times 3 \approx 3,500 \text{ reads/sec}$$

*Insight*: A single PostgreSQL instance can easily handle 36 writes/sec. However, peak 3,500 reads/sec with low latency demands in-memory caching (Redis) so the database is never saturated.

---

### 2.3. Storage & Memory Sizing (Postgres vs. Redis 80/20 Rule)

#### Database Storage Calculation (5-Year Horizon):
- Average original URL size: 500 bytes.
- Shortened alias: 7 bytes.
- Metadata (User ID, timestamps, flags, clicks): ~100 bytes.
- Total per row: ~600 bytes.
- Indexes (alias, user_id, created_at): ~200 bytes per row.
- **Total per record**: ~800 bytes.

$$\text{Total Records in 5 Years} = 1 \text{M/day} \times 365 \times 5 = 1.825 \text{ Billion records}$$
$$\text{Total Disk Storage} = 1.825 \times 10^9 \times 800 \text{ bytes} \approx 1.46 \text{ Terabytes}$$
*Conclusion*: 1.5 TB over 5 years is manageable on modern SSDs (e.g., AWS EBS gp3) without aggressive database sharding.

#### Redis Memory Calculation (Pareto Principle / 80-20 Rule):
- Cache the top **20%** of daily active URLs, which generate **80%** of traffic.
- Active daily URLs to cache: $20\% \times 100 \text{M reads} \approx 20 \text{M unique URLs/day}$ (or roughly 2 days of creations).
- Redis Hash size per record:
  - Key: `url:aB3x9Q` (~12 bytes)
  - Fields: `original` (500 bytes), `active` (5 bytes), `view_once` (5 bytes), `expire_at` (30 bytes)
  - Dict / Hash overhead: ~150 bytes
  - Total per cached URL: ~700 bytes

$$\text{RAM Required} = 20,000,000 \times 700 \text{ bytes} \approx 14 \text{ Gigabytes}$$
*Buffer for Rate Limiter Keys & Redis OS overhead*: Add $50\%$ headroom.
$$\text{Total Redis Cluster RAM Sizing} = 14 \text{ GB} \times 1.5 \approx 21 \text{ GB}$$
*Conclusion*: A modest 3-node Redis cluster (each node with 8–16 GB RAM) can effortlessly hold the entire hot working set.

---

### 2.4. Network Bandwidth Estimations

- **Incoming Redirect Traffic**: $3,500 \text{ req/sec} \times 500 \text{ bytes/request} = 1.75 \text{ MB/s} = 14 \text{ Mbps}$.
- **Outgoing Redirect Traffic (HTTP 307 Header)**: $3,500 \text{ req/sec} \times 600 \text{ bytes (Headers + Location)} = 2.1 \text{ MB/s} = 16.8 \text{ Mbps}$.
- Network throughput is minimal and well within standard AWS EC2/Gigabit ethernet network cards.

---

### 2.5. Key Generation Collision Math

```
Alphabet Options:
- Hexadecimal [0-9, a-f]         : 16 chars  -> 16^6 = 16.7 Million
- Base62 [0-9, a-z, A-Z]         : 62 chars  -> 62^6 = 56.8 Billion
- Base64 [0-9, a-z, A-Z, -, _]   : 64 chars  -> 64^6 = 68.7 Billion
```

#### Collision Probability (Birthday Paradox):
The probability $P$ of at least one collision after generating $k$ keys in a universe of size $N$:
$$P(k) \approx 1 - e^{-\frac{k^2}{2N}}$$

- For **Hex (length 6)**: $N = 16^6 \approx 1.67 \times 10^7$.
  - At just $k = 5,000$ keys, probability of collision is:
    $$P \approx 1 - e^{-\frac{25 \times 10^6}{3.35 \times 10^7}} \approx 1 - e^{-0.74} \approx 52\%$$
  - *Hex length 6 collapses under real-world scale!*

- For **Base62 (length 7)**: $N = 62^7 \approx 3.52 \times 10^{12}$ (3.52 Trillion).
  - After generating $1,000,000$ URLs:
    $$P \approx 1 - e^{-\frac{10^{12}}{7.04 \times 10^{12}}} \approx 1 - e^{-0.14} \approx 13\%$$
  - At length 8 ($62^8 \approx 218 \text{ Trillion}$), collision chance is virtually zero ($< 0.0002\%$).

---

## 3. Deep-Dive Solutions to Senior/Staff Interview System Design Questions

---

### Q1: How would you scale this URL shortener to 10 million users?

#### Architecture Evolution:
1. **Application Tier**:
   - Containerize FastAPI app with Docker and deploy across Kubernetes (EKS/GKE) across multiple Availability Zones (AZs).
   - Configure **Horizontal Pod Autoscaling (HPA)** based on CPU utilization and incoming HTTP request queue length.
2. **Caching Tier**:
   - Deploy a multi-node **Redis Cluster** with automatic hash-slot sharding across 16,384 slots.
   - Deploy Redis master-replica nodes across availability zones with automatic failover via Redis Sentinel or AWS ElastiCache Multi-AZ.
3. **Database Tier**:
   - Split database into **1 Primary (Write)** and **3 Read Replicas**. Route all `GET` queries to replicas; route `POST`, `PUT`, `DELETE` to primary.
   - Implement database connection pooling via **PgBouncer** to handle tens of thousands of concurrent connections without exhausting Postgres backend processes.
4. **Edge Layer**:
   - Place **Cloudflare CDN / AWS CloudFront** in front of the backend. Cache static redirects (permanent, non-view-once, non-expired links) at the edge closest to the user.

---

### Q2: What if one shortened URL receives 1 million requests per minute (Hot Key)?

A rate of $1\text{M req/min} \approx 16,666 \text{ QPS}$. In a standard Redis cluster, a single key (`url:viral_code`) maps to **one specific hash slot on a single Redis node**, causing that node's CPU core to hit 100% (Hot Key saturation).

```
Single Hot Key Saturation:
[Client Requests (16.6k QPS)] ----> [Node 2 (Hash Slot 4500) -> 100% CPU Crash]

Solution: Key Salting / Read Replicas / Local L1 Cache:
[Client Requests] ----> [L1 Cache (In-Memory app)] -> 95% hits
                  ----> [Node 1: url:viral_code_1]
                  ----> [Node 2: url:viral_code_2]
                  ----> [Node 3: url:viral_code_3]
```

#### Multi-Tier Solution:
1. **L1 / L2 Tiered Caching (Near-Cache Pattern)**:
   - Implement an in-memory L1 cache inside each FastAPI instance (e.g., using `cachetools` or Go's `sync.Map`) with a 5-to-10 second TTL.
   - 95% of hot traffic is intercepted in process memory before ever touching the network or Redis.
2. **Key Salting / Replication across Redis Slots**:
   - Detect hot keys automatically via Redis `redis-cli --hotkeys` or application metrics.
   - Replicate the hot key across multiple shards by appending random salt suffixes: `url:viral_link:1`, `url:viral_link:2`, `url:viral_link:3`.
   - The application randomly queries `url:viral_link:${rand(1, N)}`, distributing 16,666 QPS evenly across all Redis nodes.
3. **Edge Short-Circuiting**:
   - Push the redirect to Cloudflare Edge Cache using a `Cache-Control: public, max-age=60` header. The request never reaches the backend origin servers.

---

### Q3: How would you distribute traffic across multiple backend instances?

1. **Global Traffic Management (DNS Level)**:
   - Use Route 53 or Cloudflare Geo-DNS with Anycast routing to direct user requests to the nearest AWS Region.
2. **Layer 7 Load Balancing (ALB / NGINX)**:
   - Deploy **AWS Application Load Balancer (ALB)** or **Envoy Proxy**.
   - Use **Least Outstanding Requests** algorithm instead of simple Round-Robin, ensuring instances processing heavy DB queries are not overwhelmed by incoming traffic.
3. **Health Checking**:
   - Expose an unauthenticated lightweight endpoint `GET /health` that performs shallow checks (process alive) and deep checks (Redis ping, DB ping). Remove failing pods automatically from target groups.
4. **Graceful Shutdown**:
   - Handle `SIGTERM` signals in FastAPI/Uvicorn to complete ongoing redirects before terminating pods during scaling events.

---

### Q4: What if Redis becomes unavailable?

If Redis crashes and every request falls back to PostgreSQL, the database will suffer an immediate cascading connection pool collapse (**Catastrophic Failover**).

#### Resiliency Architecture:
```
           +-----------------------------+
           | Incoming Request GET /alias |
           +--------------+--------------+
                          |
            [Circuit Breaker Open?]
              /                  \
          Yes/                    \No
            v                      v
[Fast-Fallback: Read DB     [Try Redis HGETALL]
 with Strict Semaphore]            |
                                [Success?]
                                 /      \
                             Yes/        \No (Timeout / ConnError)
                               v          v
                       [Return Cached]  [Trip Circuit Breaker -> Fallback DB]
```

1. **Circuit Breaker Pattern (Netflix Hystrix / Tenacity / pybreaker)**:
   - If Redis connection attempts fail 5 times consecutively within 10 seconds, trip the circuit to **OPEN**.
   - While OPEN, stop calling Redis immediately; do not let requests block on network socket timeouts.
2. **Graceful Degradation with Bulkheading (Concurrency Limiter)**:
   - Database queries during Redis failure must be bounded using an `asyncio.Semaphore(100)` or thread pool limit.
   - If 100 database queries are already in flight, drop excessive requests with `HTTP 503 Service Unavailable` rather than letting DB connection pool exhaust and crash the entire PostgreSQL server.
3. **Failover Topology**:
   - Use AWS ElastiCache / Redis Sentinel with automated failover: Replica promoted to Master in $< 15$ seconds with zero data loss if AOF fsync is configured.

---

### Q5: How would you prevent cache stampedes (Thundering Herd)?

When a high-traffic key expires from cache, thousands of concurrent requests miss cache simultaneously and pound the database.

#### The Three Best Defenses:

1. **Mutex Locking (Distributed Lock via Redis `SETNX`)**:
   - On a cache miss, a worker must acquire a lock before querying DB:
     ```python
     lock = rconn.set(f"lock:{alias}", "1", nx=True, ex=5)
     if lock:
         # Only this single thread queries PostgreSQL
         data = fetch_from_db(alias)
         populate_redis(alias, data)
         rconn.delete(f"lock:{alias}")
     else:
         # Other threads sleep 50ms and re-check Redis
         await asyncio.sleep(0.05)
         return get_from_cache(alias)
     ```
2. **Probabilistic Early Expiration (XFetch Algorithm)**:
   - Instead of letting the key expire, recalculate and refresh cache in the background *before* expiration based on a probabilistic function:
     $$\Delta \times \beta \times \ln(\text{rand}()) > \text{TTL}$$
     *(Where $\Delta$ is computing time, $\beta$ is greediness constant).*
3. **Never-Expire Strategy with Background Refresh**:
   - Store the true TTL *inside* the hash payload, but set no Redis TTL. If a worker detects internal expiration, it returns the stale value immediately to the user while spawning a background task to refresh the value from DB.

---

### Q6: How would you handle database read replicas?

1. **Read/Write Splitting at ORM / Session Level**:
   - Configure SQLAlchemy with an **Engine Routing Dispatcher**:
     - `get_read_db()`: Uses round-robin DNS across read-replica connection strings.
     - `get_write_db()`: Connects strictly to the primary writer node.
2. **Handling Replication Lag (The "Read-Your-Own-Writes" Problem)**:
   - *Problem*: User creates a custom link `GET /urls/` or `POST /urls/` and is immediately redirected to Dashboard. If replication lag between Primary and Replica is 100ms, the replica has not received the row yet, and user sees an empty dashboard.
   - *Solution (Session Sticking / Monotonic Read Consistency)*:
     - After any write operation, write a cookie or token `just_modified=True` for 2 seconds.
     - Any request carrying this token bypasses replicas and reads directly from Primary.

---

### Q7: How would you handle extremely high write throughput?

If millions of users create short URLs simultaneously (e.g., mass marketing campaigns), relational row insertion locks will become a bottleneck.

```
High Write Pipeline:
[POST /urls] -> [FastAPI App] -> [Redis Token Buffer / Queue] 
                                         |
                                (Async Consumer Workers)
                                         v
                         [PostgreSQL Batch INSERT (1000 rows/batch)]
```

1. **Pre-Generated Token Pools (Key Generation Service - KGS)**:
   - Instead of generating and checking random strings on every write (`db.scalar(select...)`), run a standalone **KGS**.
   - KGS pre-generates millions of unique Base62 strings and loads them into a fast Redis Set (`SPOP`).
   - Link creation becomes $O(1)$ without any duplicate check query against the DB!
2. **Asynchronous Write Buffering via Message Queue**:
   - Write requests publish payload to an **Apache Kafka topic** or **RabbitMQ**.
   - FastAPI returns `HTTP 202 Accepted` with the pre-allocated alias immediately.
   - Background batch consumers consume messages and perform bulk operations:
     ```sql
     INSERT INTO urls (original, alias, user_id) VALUES (...), (...), (...) 
     ON CONFLICT DO NOTHING;
     ```
   - Bulk insertions convert thousands of individual random disk writes into high-speed sequential disk I/O.

---

### Q8: How would you guarantee only one successful view-once URL consumption?

Under distributed environments, database transactions alone can suffer deadlocks or high latency, while background tasks suffer race conditions.

#### The Definitive Dual-Tier Mechanism:

```
Step 1: In-Memory Atomic Gatekeeper (Redis Lua)
[Request A] ──┐
[Request B] ──┼─> [Redis Lua: HDEL url:alias] ──> Request A gets 1 (Wins!)
[Request C] ──┘                               ──> Request B & C get 0 (Denied!)

Step 2: Database Atomic Transition
[Request A] ──> UPDATE urls SET active = false 
                WHERE alias = :alias AND active = true;
                (Rows affected == 1 -> Deliver Payload)
```

1. **Phase 1: Redis Gatekeeper**:
   - Use an atomic Lua script that checks if `view_once == "True"` and `active == "True"`.
   - If true, it deletes the key in the same atomic instruction and returns success.
   - All competing concurrent requests fail at the Redis layer with zero database overhead.
2. **Phase 2: Database Atomic Guard**:
   - When updating PostgreSQL, use optimistic conditional execution:
     ```python
     stmt = (
         update(models.Url)
         .where(models.Url.alias == alias, models.Url.active == True)
         .values(active=False)
     )
     result = db.execute(stmt)
     db.commit()
     if result.rowcount == 0:
         raise HTTPException(status_code=410, detail="Already consumed")
     ```
   - Even if Redis were completely bypassed, PostgreSQL's MVCC and row-level write locks ensure that **exactly one transaction receives `rowcount == 1`**.

---

### Q9: How would you implement distributed rate limiting?

1. **The Multi-Instance Problem**:
   - In-memory rate limiting within Python cannot coordinate across 20 container instances.
   - A single Redis node running `INCR` + `EXPIRE` works up to ~50k QPS, but becomes a single point of failure and bottleneck beyond that.
2. **Distributed Sliding Window using Redis Sorted Sets (ZSET)**:
   - For every request, execute via Lua script:
     ```lua
     local key = KEYS[1]
     local now = tonumber(ARGV[1])
     local window = tonumber(ARGV[2])
     local limit = tonumber(ARGV[3])
     local clear_before = now - window

     -- Remove entries older than window
     redis.call('ZREMRANGEBYSCORE', key, 0, clear_before)
     local current_requests = redis.call('ZCARD', key)

     if current_requests < limit then
         redis.call('ZADD', key, now, now)
         redis.call('EXPIRE', key, window)
         return 1 -- Allowed
     else
         return 0 -- Rejected
     end
     ```
3. **High-Scale Solution (Local Batching + Centralized Sync)**:
   - At extreme scale (500k QPS), hitting Redis on every request wastes network I/O.
   - Use **Local Token Bucket with Periodic Sync**:
     - Instances maintain local token buckets.
     - Synchronize counters with Redis asynchronously every 500ms using Redis `INCRBY`.

---

### Q10: How would you make the system highly available (HA)?

High Availability (HA) guarantees $99.999\%$ uptime ("five nines" $\le 5.26\text{ minutes downtime/year}$).

```
Multi-Region Active-Active Topology:
         [Route 53 Latency-Based Routing / Anycast]
                 /                               \
        (Region: US-East)              (Region: EU-West)
      [ALB -> K8s Pods]                [ALB -> K8s Pods]
      [Redis Multi-AZ Cluster]         [Redis Multi-AZ Cluster]
              \                                /
        [Aurora Global Database (Multi-Region Replication)]
```

1. **Multi-AZ & Multi-Region Redundancy**:
   - Deploy backend pods across 3 independent Availability Zones in a primary cloud region.
   - Use **AWS Aurora Global Database** with cross-region read replicas. Write latency is localized, and storage replication happens under 1 second globally.
2. **Zero-Downtime Deployments**:
   - Use **Rolling Updates** or **Blue/Green Deployments** with Kubernetes.
   - Database schema migrations managed via Alembic must only apply **backward-compatible migrations** (e.g., add nullable columns first, deploy code, backfill data, add constraints later).
3. **Data Durability & Backup**:
   - PostgreSQL continuous archiving (WAL) to Amazon S3 with Point-In-Time-Recovery (PITR).
   - Redis configured with both **AOF (Append Only File) every-sec sync** for minimal data loss and daily **RDB snapshots**.

---

### Q11: How would you monitor the application in production?

#### The Three Pillars of Observability:

1. **Metrics (Prometheus & Grafana)**:
   - **RED Method**:
     - **Rate**: Requests/sec partitioned by HTTP status code (`2xx`, `3xx`, `4xx`, `5xx`).
     - **Errors**: Percentage of 5xx errors (Alert threshold $> 0.1\%$).
     - **Duration**: Latency percentiles (P50, P95, **P99**, P99.9). Target P99 redirect latency $< 5\text{ms}$.
   - **Infrastructure Metrics**:
     - Redis cache hit/miss ratio (Alert if hit ratio $< 80\%$).
     - Database connection pool utilization and replication lag.
2. **Distributed Tracing (OpenTelemetry + Jaeger / AWS X-Ray)**:
   - Inject trace headers (`traceparent`) at the API Gateway.
   - Trace individual requests through FastAPI middleware $\to$ Redis command execution $\to$ PostgreSQL queries to detect long-tail tail latencies.
3. **Centralized Structured Logging (ELK / Datadog)**:
   - Log all events in structured JSON format with `correlation_id`, `user_id`, `client_ip`, and `elapsed_time_ms`.
   - Never log sensitive original URL queries that contain OAuth tokens or passwords.
4. **Synthetic Monitoring**:
   - Automated heartbeat canary bots hitting canary short links every 30 seconds globally to verify real-world redirect functionality.

---

### Q12: How would you prevent malicious URL redirection?

A public URL shortener is a prime target for phishing, malware distribution, command-and-control servers, and bypass of email spam filters.

#### Defense-in-Depth Pipeline:

```
[User Submits Long URL]
         │
         ▼
[1. Domain Blocklist Check] ──> (Internal DB / Spamhaus / SURBL)
         │ (Clean)
         ▼
[2. Anti-Recursion Check]   ──> (Reject our own domain / Shortener loops)
         │ (Clean)
         ▼
[3. Real-Time Security API] ──> (Google Safe Browsing / VirusTotal via Async Queue)
         │ (Clean)
         ▼
[4. Final Approval & Alias Generation]
```

1. **Prevent Shortener Loops & Recursive Redirection**:
   - Reject any submitted URL whose domain matches the shortener's own domain or known shortening services (Bitly, TinyURL) to prevent infinite loops and attribution masking.
2. **Reputation Lookup (Google Safe Browsing API / VirusTotal)**:
   - On `POST /urls/`, execute a real-time lookup against the Google Safe Browsing API or an offline synchronized local Bloom Filter of dangerous domains.
   - If flag status is suspicious, reject with `HTTP 400 Bad Request: Malicious destination detected`.
3. **Delayed Async Scanning (Post-Creation Webhooks)**:
   - Attackers often submit a clean URL and later configure it to point to a malicious payload. Run a background cron worker that periodically re-scans active links using headless browsers (Playwright/Puppeteer) to check destination page content for phishing login forms.
4. **Interstitials / Disclaimers for High-Risk Domains**:
   - For links flagged with low trust scores, display an intermediate warning page:
     *"You are being redirected to external site X. Click here to proceed."*
5. **Report & Takedown API**:
   - Provide an automated abuse-reporting endpoint (`POST /urls/{alias}/report`). If an alias receives $> 5$ independent user reports, automatically set `active = False` pending administrative review.
