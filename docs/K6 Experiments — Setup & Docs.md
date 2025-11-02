---

title: "k6 Experiments — Setup & Docs"
description: "How k6 is integrated into the E‑commerce backend repo, where files live, how to run baseline vs cached experiments, how to parse and persist results into the Experiment database model, and convenient scripts/makefile to automate the flow."
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# k6 Experiments — Setup & Docs

This doc explains the k6 experiment workflow in the repo: where files live, environment variables to set, how to run baseline and cached tests, how we parse k6 summary JSON and persist experiment results to the database using the `Experiment` model, and convenient helper commands.

> **Goal:** make reproducible performance experiments easy: run, collect p50/p95/RPS, and save a compact record in the `experiments` table for the analytics frontend.

---

## 1) Files & folders (what you already added)

```
repo-root/
 ┣ k6/
 ┃  ┗ product_read_test.js        # k6 scenario for product read endpoint
 ┣ scripts/
 ┃  ┗ report_k6_result.js        # parse k6 summary JSON and POST to backend
 ┣ src/
 ┃  ┗ modules/experiments/       # NestJS module to accept experiment reports
 ┣ prisma/
 ┃  ┗ schema.prisma               # contains Experiment model (see schema below)
 ┗ docs/
   ┗ quickstart-k6.mdx            # this MDX (you are viewing)
```

Keep `k6/` and `scripts/` in the repo root so CI and team members can find them quickly.

---

## 2) Experiment DB schema (Prisma model)

This repo uses the following `Experiment` model (Prisma). It stores a single metric record per insertion. Use this for A/B tests, micro‑experiments, and manual performance runs.

```prisma
// Experiment model - tracks A/B tests and performance experiments
// Used to persist experiment results for frontend analytics dashboard
model Experiment {
  id          String   @id @default(uuid())
  name        String   // Experiment name (e.g., "lru_cache_vs_redis")
  description String?  @db.Text
  variant     String   // Variant name (e.g., "baseline", "with_cache")
  metric      String   // Metric name (e.g., "avg_response_time", "cache_hit_rate")
  value       Decimal  @db.Decimal(10, 4) // Metric value
  metadata    Json?    // Additional experiment metadata
  createdAt   DateTime @default(now())

  @@index([name])
  @@index([variant])
  @@index([metric])
  @@index([createdAt])
  @@map("experiments")
}
```

**Notes:**

* Each call to `/experiments/report` should insert **one or more** rows depending on how you prefer to represent metrics. The provided `report_k6_result.js` POSTs a compact JSON summary; the backend can unpack that summary into multiple `Experiment` rows (e.g., one row for `p50_ms`, one for `p95_ms`, one for `rps`).
* Use `metadata` for context: test duration, VUs, productId, environment, k6 raw file path, or git SHA.

---

## 3) k6 script details

**File:** `k6/product_read_test.js`

Minimal script purpose: hammer `GET /products/:id` at configurable concurrency (VUs) and duration, then export a JSON summary using `--summary-export`.

Important environment variables used when running:

* `BASE_URL` — base URL for the API (default `http://localhost:3000`)
* `PRODUCT_ID` — product ID to target
* `VUS` — virtual users
* `DURATION` — runtime duration (e.g. `30s`, `1m`)

Example CLI runs (copy/paste):

```bash
# baseline run (cold cache)
BASE_URL=http://localhost:3000 PRODUCT_ID=123 VUS=20 DURATION=30s \
  k6 run --summary-export=./results_baseline.json k6/product_read_test.js

# cached run (warm cache)
BASE_URL=http://localhost:3000 PRODUCT_ID=123 VUS=20 DURATION=30s \
  k6 run --summary-export=./results_cached.json k6/product_read_test.js
```

**Tip:** to warm cache before the cached run, do a small warm-up: `VUS=5 DURATION=10s` or call the endpoint repeatedly with `curl`/Postman.

---

## 4) The reporter script

**File:** `scripts/report_k6_result.js`

Purpose: parse the `--summary-export` JSON produced by k6, extract useful fields (p50, p95, avg, requests_count, rps), and POST a compact report to your backend's `/experiments/report` endpoint.

Usage:

```bash
node scripts/report_k6_result.js <k6_summary.json> <backend_base_url> <api_token_or_key> "experiment-name" "optional notes"
```

Example:

```bash
node scripts/report_k6_result.js ./results_baseline.json http://localhost:3000 $ADMIN_TOKEN "lru_cache_baseline" "cold cache baseline"
```

What the script sends (example payload):

```json
{
  "name": "lru_cache_baseline",
  "date": "2025-11-01T...",
  "notes": "cold cache baseline",
  "metricsSummary": {
    "p50_ms": 120,
    "p95_ms": 350,
    "avg_ms": 140.2,
    "requests_count": 600,
    "rps": 20
  },
  "rawFile": "./results_baseline.json"
}
```

The backend endpoint should validate the caller (auth) and then persist the metrics into the `experiments` table. Two approaches:

1. **One row per metric:** create multiple `Experiment` rows per POST (e.g., one for `p50_ms`, one for `p95_ms`, one for `rps`) with `variant` set to `baseline` or `cached`.
2. **Single JSON row:** persist the whole `metricsSummary` in `metadata`/`Json` and store an aggregated `value` (e.g., pick `p95_ms` or store `avg_ms` as `value`) — simpler but less queryable.

Both are valid; choose one and be consistent.

---

## 5) Backend `/experiments/report` contract (recommendation)

**Endpoint:** `POST /experiments/report`
**Auth:** Bearer token or `x-api-key` header (protect it)
**Body:** the reporter JSON above.

**Server behavior (recommended):**

1. Validate auth.
2. Validate `metricsSummary` contains expected keys.
3. For each metric you care about (p50_ms, p95_ms, rps), insert an `Experiment` row with:

   * `name`: experiment name
   * `variant`: e.g., `baseline` or `with_cache` (you can encode variant in the `name` if preferred)
   * `metric`: e.g., `p95_ms`
   * `value`: metric numeric value
   * `description` or `metadata`: store `rawFile`, `VUS`, `duration`, `productId`, etc.
4. Return HTTP 201 and the saved IDs.

This makes SQL queries for trends, comparisons, and frontend dashboards straightforward.

---

## 6) Quick Makefile (optional) — automate the flow

Add this `Makefile` at repo root for convenience.

```makefile
PRODUCT_ID ?= 123
BASE_URL ?= http://localhost:3000
TOKEN ?= $(shell echo $ADMIN_TOKEN)

.PHONY: baseline cached report

baseline:
	BASE_URL=$(BASE_URL) PRODUCT_ID=$(PRODUCT_ID) VUS=20 DURATION=30s \
	k6 run --summary-export=./results_baseline.json k6/product_read_test.js

warm:
	# simple warmup (low VUs)
	BASE_URL=$(BASE_URL) PRODUCT_ID=$(PRODUCT_ID) VUS=5 DURATION=10s \
	k6 run --summary-export=/dev/null k6/product_read_test.js

cached: warm
	BASE_URL=$(BASE_URL) PRODUCT_ID=$(PRODUCT_ID) VUS=20 DURATION=30s \
	k6 run --summary-export=./results_cached.json k6/product_read_test.js

report-baseline:
	node scripts/report_k6_result.js ./results_baseline.json $(BASE_URL) $(TOKEN) "lru_cache_baseline" "cold cache"

report-cached:
	node scripts/report_k6_result.js ./results_cached.json $(BASE_URL) $(TOKEN) "lru_cache_cached" "warm cache"
```

Use:

```bash
make baseline PRODUCT_ID=... BASE_URL=... TOKEN=...   # runs baseline
make cached PRODUCT_ID=... BASE_URL=... TOKEN=...     # warms then runs cached
make report-baseline TOKEN=...                         # send baseline results to backend
```

---

## 7) Postman integration & experiments workflow

1. Use the imported Postman collection to create a product and obtain `productId`.
2. Run `make baseline` (or the k6 CLI above) and get `results_baseline.json`.
3. Warm cache (run the warm step or hit the endpoint a few times via Postman). Then `make cached`.
4. Run `make report-baseline` / `make report-cached` or call `node scripts/report_k6_result.js` manually to persist results.
5. Open Prisma Studio or query `experiments` table to verify records.
6. Build frontend charts or dashboards reading `experiments` table to show p50/p95 and trends.

---

## 8) Tips & best practices

* **One variable per experiment:** keep experiment `name` and `variant` consistent. e.g., name `product_read_cache` variants `baseline` and `lru_cache`.
* **Keep metadata rich:** include VUs, duration, productId, git SHA; this makes later filtering easy.
* **Repeat runs:** run baseline and cached experiments multiple times and average or use medians to avoid noisy single runs.
* **Automate in CI:** run k6 in a staging environment on PRs or nightly and persist results; alert on regressions.

---

## 9) Troubleshooting checklist

* If k6 can't reach `localhost` from a container, run k6 on the host or use `host.docker.internal` hostname.
* If `results_*.json` lacks `med` or `p(95)`, open it and inspect `metrics.http_req_duration` shape; the reporter script is defensive but inspect manually when needed.
* If POST to `/experiments/report` returns 401, ensure token is valid; for dev you can add a lightweight `x-api-key` auth to the controller.

---

## 10) Next actions (suggested)

* Implement server-side conversion of the reporter payload into multiple `Experiment` rows (p50/p95/rps) with metadata. I can generate the NestJS controller/service code for this if you want.
* Add a small frontend page that queries `/experiments` (new API) to visualize trends (p50/p95 over time). I can scaffold a simple Next.js page for this.

---

*End of k6 Experiments docs.*
