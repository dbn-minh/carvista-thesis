# Scalability and Concurrent Request Handling

CarVista now uses **rate limiting**, **Redis cache**, and a **BullMQ background queue** to handle multiple user requests more safely.

This is a **Level 3 thesis/demo enhancement**, not a full production rewrite.

Important design rule:

- **MySQL stays the source of truth**
- **Redis only stores temporary cached data and queue jobs**
- **The app still works without Redis**

## What each part does

| Component | Purpose | Uses Redis? | Uses MySQL? | Required to run app? |
|---|---|---:|---:|---:|
| Rate limit | Protect expensive or sensitive APIs | No | No | No |
| Cache | Reduce repeated reads for catalog/listing/TCO/price APIs | Yes | Reads source data from MySQL | No |
| Queue | Move notification jobs out of the main request path | Yes | Worker may read/write MySQL | No |
| MySQL | Source of truth for all business data | No | Yes | Yes |
| Worker | Processes BullMQ jobs in background | Yes | Usually yes | No for basic app, yes for background jobs |

## Why this helps in CarVista

- Many users can open catalog pages at the same time.
- Expensive AI-related endpoints should not be spammed.
- Viewing-request notifications should not slow down the main API response.
- The system should still run in demo mode even if Redis is not installed.

## Text diagrams

### Cache flow

```text
User opens catalog or listing page
→ Backend checks Redis cache
→ Cache hit: return cached data immediately
→ Cache miss: query MySQL
→ Save result to Redis with TTL
→ Return response to frontend
```

### Notification queue flow

```text
Buyer sends viewing request
→ Backend validates request
→ Backend saves request to MySQL
→ Backend adds notification job to BullMQ
→ API returns success immediately
→ Worker processes job in background
→ Notification record / email is created later
```

### Rate-limit flow

```text
User sends request
→ Rate limit middleware checks request count
→ If within limit: continue to API
→ If exceeded: return 429 Too Many Requests
```

### Final architecture flow

```text
Frontend
→ Rate Limit Middleware
→ Backend API
→ Cache Check
   ├─ Cache hit → Return cached response
   └─ Cache miss → Query MySQL → Store in Redis → Return response
→ For notification tasks: Add job to BullMQ
→ Worker processes job in background
```

Short explanation:

```text
MySQL remains the source of truth. Redis only stores temporary cached data and
queue jobs. If Redis is unavailable, the app falls back to direct MySQL/API behavior.
```

## What Redis is used for in this project

Redis is used for **2 things only**:

1. **Cache**
   - Catalog makes/models/variants
   - Vehicle detail
   - Listing search
   - Listing detail
   - TCO API result
   - Price outlook API result

2. **BullMQ queue backend**
   - Viewing request created notification
   - Viewing request updated notification
   - Price drop alert notification

Redis does **not** replace MySQL.

## What BullMQ is used for in this project

BullMQ is used to move notification work into the background.

Example:

```text
Before:
Create viewing request
→ Save request
→ Create notification
→ Send email
→ Return response

After:
Create viewing request
→ Save request
→ Queue notification job
→ Return response
→ Worker sends notification later
```

This makes the main API response faster and safer when multiple users act at the same time.

## What rate limiting is used for in this project

Rate limiting protects the backend from too many requests in a short time.

Current use in CarVista:

- **General limiter** on `/api`
- **Auth limiter** on login/register/OTP endpoints
- **AI limiter** on AI endpoints such as compare, price outlook, TCO, advisor chat
- **Action limiter** on create listing and viewing request creation

## What is done by code vs what you must do manually

| Done by code | You must do manually |
|---|---|
| Read env flags | Start Redis if you want cache/queue |
| Bypass cache when disabled | Add `REDIS_URL` to env |
| Bypass queue when disabled | Run the notification worker |
| Cache catalog/listing/TCO/price reads | Call APIs and inspect logs |
| Invalidate listing cache after writes | Test 429 responses |
| Enqueue notification jobs | Choose a managed Redis service when deploying |
| Inline fallback when queue is unavailable | Host the worker as a separate background process if needed |

## Environment variables

Add these to your backend environment:

```env
REDIS_URL=redis://localhost:6379

CACHE_ENABLED=true
QUEUE_ENABLED=true

CACHE_TTL_SECONDS=300
CATALOG_CACHE_TTL_SECONDS=1800
VEHICLE_DETAIL_CACHE_TTL_SECONDS=900
LISTING_SEARCH_CACHE_TTL_SECONDS=180
LISTING_DETAIL_CACHE_TTL_SECONDS=180
TCO_CACHE_TTL_SECONDS=3600
PRICE_OUTLOOK_CACHE_TTL_SECONDS=1800

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
AI_RATE_LIMIT_MAX=20
AUTH_RATE_LIMIT_MAX=10
```

Meaning:

- `CACHE_ENABLED=false` means go straight to MySQL
- `QUEUE_ENABLED=false` means do notifications inline
- TTL values are in **seconds**
- Rate-limit values control how many requests are allowed per time window

## Step-by-step Redis Docker setup

### A. Check Docker

Install Docker Desktop first if needed, then run:

```powershell
docker --version
```

### B. Start Redis container

```powershell
docker run -d --name carvista-redis -p 6379:6379 redis:7
```

### C. Check Redis container

```powershell
docker ps
```

You should see a container named `carvista-redis`.

### D. Check Redis logs

```powershell
docker logs carvista-redis
```

### E. Test Redis CLI

```powershell
docker exec -it carvista-redis redis-cli ping
```

Expected result:

```text
PONG
```

### F. Stop Redis

```powershell
docker stop carvista-redis
```

### G. Start Redis again

```powershell
docker start carvista-redis
```

### H. Remove Redis container if needed

```powershell
docker rm -f carvista-redis
```

## Optional Docker Compose snippet

If you want a very small local compose setup, this is enough:

```yaml
services:
  redis:
    image: redis:7
    container_name: carvista-redis
    ports:
      - "6379:6379"
```

This is optional. The project does not require Docker Compose.

## How to run the backend and worker

### 1. Start backend

```powershell
npm run dev
```

Or production-like run:

```powershell
npm run start
```

### 2. Start notification worker in another terminal

```powershell
npm run worker:notification
```

Expected worker log:

```text
[worker:notification] ready
```

## How to confirm cache hit/miss from logs

Call the same read-heavy API twice.

Examples:

```text
GET /api/catalog/makes
GET /api/listings
GET /api/listings/:id
POST /api/ai/predict-price
POST /api/ai/tco
```

Expected behavior:

- First request: usually `miss`
- Second request: usually `hit`

Look for logs like:

```text
[cache] miss
[cache] set
[cache] hit
```

You can also inspect the response header:

```text
X-Cache-Status: miss
X-Cache-Status: hit
X-Cache-Status: bypass
```

## How to confirm rate limit works

Repeat login or AI requests many times within one minute.

Examples:

```text
POST /api/auth/login
POST /api/ai/chat
POST /api/ai/predict-price
```

Expected result after the threshold is exceeded:

```text
429 Too Many Requests
```

Response body:

```json
{
  "error": "Too many requests. Please try again later."
}
```

## How to confirm notification queue works

### Viewing request flow

```text
Create viewing request
→ API should return success immediately
→ Backend log should show notification job queued
→ Worker log should show job processed
```

Expected logs:

```text
[queue] notification job queued
[worker:notification] processing job
[worker:notification] job completed
```

### Price drop alert flow

```text
Admin inserts lower variant market price
→ API saves price point
→ Price drop job is queued or falls back inline
→ Worker creates notifications for watchers
```

## Manual test checklist

| Scenario | Expected result |
|---|---|
| `CACHE_ENABLED=false` | API still works, cache is bypassed |
| Redis is stopped | API still works, cache/queue fall back |
| Call catalog endpoint twice | First miss, second hit |
| Call listing detail twice | First miss, second hit |
| Exceed AI limiter | Receive 429 response |
| Exceed auth limiter | Receive 429 response |
| Create viewing request with Redis up | Request succeeds, job is queued, worker handles notification |
| Create viewing request with Redis down | Request still succeeds, inline fallback handles notification |
| Update viewing request status | Main request succeeds, buyer notification is queued or falls back |
| Insert admin price drop | Price alert job is queued or falls back inline |
| Update/delete listing | Listing cache is invalidated |
| Upload/delete/reorder listing images | Listing cache is invalidated |

## Notes about cache invalidation

Current invalidation is kept intentionally simple for thesis/demo safety.

Implemented:

- Delete listing detail cache by listing ID
- Clear listing search namespace after listing writes
- Clear price-outlook namespace for related variant after listing/admin price changes
- Delete vehicle detail cache by variant ID when variant price admin write happens

Known limitation:

- Pattern-based invalidation is namespace-oriented, not perfectly field-precise
- This is acceptable here because TTL values are short for frequently changing data

## What happens if Redis is not running

The app should still run.

Behavior:

```text
Cache
→ bypass

Queue
→ fallback to inline notification behavior

MySQL
→ still handles normal business data
```

If you do not want warnings, you can disable Redis-based features:

```env
CACHE_ENABLED=false
QUEUE_ENABLED=false
```

## Deployment / hosting Redis

For local development, Redis can run in Docker.

For deployment, use a managed Redis service such as:

- Upstash Redis
- Redis Cloud
- Railway Redis
- Render Redis, if available on your plan/platform

Deployment steps:

1. Create a Redis instance on your provider
2. Copy the Redis connection URL
3. Set `REDIS_URL` in backend environment variables
4. Set `CACHE_ENABLED=true`
5. Set `QUEUE_ENABLED=true`
6. Deploy backend API
7. Run the worker as a separate process if your platform supports it

Example deployment processes:

```text
Process 1: npm run start
Process 2: npm run worker:notification
```

Important:

- The backend API process and worker process are **different**
- If your hosting platform supports only one web service, you may need:
  - a separate background worker service
  - a second deployment for the worker
  - or `QUEUE_ENABLED=false` for demo hosting

## What is not changed by this enhancement

- No microservices
- No Redis as primary database
- No MySQL schema rewrite
- No change to AI source-of-truth rules
- No queue-based async AI chat
- No production-grade distributed architecture claim

## Short technical summary

```text
Rate limit
→ protects sensitive and expensive endpoints

Redis cache
→ reduces repeated database reads on read-heavy endpoints

BullMQ queue
→ moves notifications out of the main request path

Fallback mode
→ keeps CarVista usable even when Redis is disabled or unavailable
```
