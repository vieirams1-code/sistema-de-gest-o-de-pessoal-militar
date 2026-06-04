## 2024-06-04 - Optimize Historico Comportamento N+1 Queries
**Learning:** Sequential `await` in loops for database updates causes severe N+1 latency, particularly observable during batch enrichments. We can observe up to 40x speedups when batching mock 10ms queries.
**Action:** Use Promise accumulation (`Array.push(promise.catch(e => ...))`) and `Promise.allSettled()` / `Promise.all()` to resolve updates concurrently. For exceptionally large datasets, batching/chunking should also be considered.
## 2023-10-27 - Parallelized Entity Fetching

**Learning:** When executing multiple independent operations sequentially in a loop (like fetching or updating different unrelated entities), execution time can grow linearly with the number of entities due to repeated network/DB latencies.
**Action:** Replace `for...of` loops containing independent async operations with `await Promise.all(array.map(async item => { ... }))` to parallelize requests and significantly reduce overall latency.

## 2026-06-04 - Concurrency and Deduplication in Hook Scoping
**Learning:** Sequential I/O inside loops for multi-field entity filtering (e.g., checking multiple emails against multiple database columns) compounds network overhead. Combining `Promise.all` with `flatMap` reduces total latency to the duration of the single longest query rather than the sum.
**Action:** Refactor sequential await loops into concurrent `Promise.all` batches. Always deduplicate input identifiers (like emails) using `new Set()` to avoid redundant concurrent requests for the same data.
