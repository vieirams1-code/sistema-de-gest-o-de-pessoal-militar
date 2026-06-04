## 2024-06-04 - Optimize Historico Comportamento N+1 Queries
**Learning:** Sequential `await` in loops for database updates causes severe N+1 latency, particularly observable during batch enrichments. We can observe up to 40x speedups when batching mock 10ms queries.
**Action:** Use Promise accumulation (`Array.push(promise.catch(e => ...))`) and `Promise.allSettled()` / `Promise.all()` to resolve updates concurrently. For exceptionally large datasets, batching/chunking should also be considered.
## 2023-10-27 - Parallelized Entity Fetching

**Learning:** When executing multiple independent operations sequentially in a loop (like fetching or updating different unrelated entities), execution time can grow linearly with the number of entities due to repeated network/DB latencies.
**Action:** Replace `for...of` loops containing independent async operations with `await Promise.all(array.map(async item => { ... }))` to parallelize requests and significantly reduce overall latency.

## 2025-05-22 - Parallelized Scope ID Resolution
**Learning:** Sequential N+1 reads during nested resource resolution (e.g., fetching sub-groups then their members) creates a massive performance bottleneck. In `listarMilitarIdsDoEscopo`, we observed ~83% latency reduction by parallelizing both the outer loop of access records and the inner loop of filters.
**Action:** Always check if loops containing `await` can be refactored into `Promise.all` maps. For early-exit logic (like `admin` checks), perform a preliminary synchronous check (e.g., `array.some(...)`) before initiating parallel async tasks.
